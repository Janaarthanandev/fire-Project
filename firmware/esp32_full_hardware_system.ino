#include <Wire.h>
#include <Adafruit_AMG88xx.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ==============================================================================
// 🔑 CONFIGURATION KEYS
// ==============================================================================
const char* WIFI_SSID     = "iQOO Z11x 5G";              // Wi-Fi Network Name
const char* WIFI_PASS     = "9363199453";                // Wi-Fi Network Password
const char* SUPABASE_URL  = "https://kcvbagkwmttglvjoztsu.supabase.co/rest/v1/sensor_readings";
const char* SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdmJhZ2t3bXR0Z2x2am96dHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NDkzOTcsImV4cCI6MjEwNDAyNTM5N30.BnleXdqYhPGRCpZ24bJcJ5_C7luMqQxOFHMqr12ntqE";

// ---------- PIN DEFINITIONS ----------
#define BUZZER_PIN       4     // Active Piezo Buzzer
#define LED_PIN          2     // Status Alarm LED
#define POWER_RELAY_PIN  27    // Power Cutoff Relay (Active HIGH Relay)
#define VENT_FAN_PIN     25    // Ventilation Cooling Fan (Direct Pin: HIGH = ON, LOW = OFF)
#define SERVO_PIN        13    // Extinguisher Powder Servo Motor
#define FLAME_PIN        18    // IR Flame Sensor Module
#define MQ2_PIN          36    // MQ-2 Gas Sensor (VP)
#define MQ135_PIN        39    // MQ-135 Gas Sensor (VN)
#define DHT_IN_PIN       16    // Inside DHT22 Sensor
#define DHT_OUT_PIN      17    // Outside DHT22 Sensor

// Module polarity definitions
#define RELAY_ON_LEVEL     HIGH  // HIGH = Relay Energized -> COM moves to NO -> Power CUT
#define RELAY_OFF_LEVEL    LOW   // LOW  = Relay OFF -> COM stays at NC -> Normal Power ON
#define FLAME_ACTIVE_LEVEL LOW   // LOW  = Flame Detected (Standard LM393 Module)

// ---------- THRESHOLDS & TIMERS ----------
#define TEMP_MODERATE_MIN     50.0f  // 50°C to 60°C = MODERATE state
#define TEMP_CRITICAL_MIN     60.0f  // > 60°C = CRITICAL state
#define MQ2_CRITICAL_MAX      2800.0f // MQ-2 Gas PPM >= 2800 = CRITICAL state
#define MQ135_CRITICAL_MAX    2000.0f // MQ-135 Gas PPM >= 2000 = CRITICAL state
#define CRITICAL_HOLD_MS      15000  // 15 Seconds Critical Hold duration
#define SAMPLE_MS             1000   // Sensor sampling interval (1 sec)
#define BEEP_INTERVAL_MS      200    // Fast 200ms ON / 200ms OFF beep & blink loop (1 0 1 0 pattern)

// ---- Startup false-trigger protection ----
#define STARTUP_GRACE_MS      8000   // Ignore readings for first 8s (AMG8833 warm-up)
#define DEBOUNCE_COUNT        3      // Need 3 consecutive hot/gas readings before CRITICAL trips

Adafruit_AMG88xx amg;
DHT dhtIn(DHT_IN_PIN, DHT22);
DHT dhtOut(DHT_OUT_PIN, DHT22);
Servo valve;

enum SystemState { STATE_NORMAL, STATE_MODERATE, STATE_CRITICAL };
volatile SystemState currentState = STATE_NORMAL;
SystemState lastAppliedState = STATE_NORMAL;
bool manualOverride = false; // Manual test override from Serial Monitor

float frames[3][64];
float smoothPx[64];
int frameIdx = 0, frameCount = 0;

volatile float tIn = 30.0f, tOut = 30.0f, hIn = 50.0f, hOut = 50.0f;
unsigned long lastDht = 0, lastSample = 0;
unsigned long criticalStartTime = 0;
unsigned long bootTime = 0;
int criticalStreak = 0;
volatile bool ventFanActive = false;
bool criticalTriggered = false;

// Shared volatile variables for non-blocking FreeRTOS Telemetry Task on Core 0
volatile float g_tempZ1 = 0.0f, g_tempZ2 = 0.0f, g_tempZ3 = 0.0f, g_tempZ4 = 0.0f;
volatile float g_flameVal = 0.0f, g_mq2 = 0.0f, g_mq135 = 0.0f;

void setPowerRelay(bool cut) {
  // cut = true  -> HIGH (Relay Energized -> COM moves to NO -> Power CUT)
  // cut = false -> LOW  (Relay OFF -> COM stays at NC -> Normal Power ON)
  digitalWrite(POWER_RELAY_PIN, cut ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
}

void setVentFan(bool enable) {
  ventFanActive = enable;
  digitalWrite(VENT_FAN_PIN, enable ? HIGH : LOW);
}

// Calculate max temperature of an 4x4 sub-quadrant in the 8x8 matrix
float zoneMax(int r0, int c0) {
  float m = -100.0f;
  for (int r = r0; r < r0 + 4; r++) {
    for (int c = c0; c < c0 + 4; c++) {
      if (smoothPx[r * 8 + c] > m) m = smoothPx[r * 8 + c];
    }
  }
  return m;
}

// ------------------------------------------------------------------------------
// 🔊 OUTPUT CONTROL: Crisp Non-Blocking 1 0 1 0 Beep & Blink Loop
// ------------------------------------------------------------------------------
void updateOutputs() {
  bool patternOn = (millis() / BEEP_INTERVAL_MS) % 2 == 0;

  if (currentState != lastAppliedState) {
    if (currentState == STATE_CRITICAL) {
      valve.write(90);       // Open Extinguisher Valve (90°)
      setPowerRelay(true);   // Cut Main Power (Relay Energized -> HIGH)
      Serial.println("⚡ [Relay Action] POWER CUT (Relay Energized - HIGH)");
    } else if (currentState == STATE_MODERATE) {
      valve.write(0);        // Close Valve (0°)
      setPowerRelay(false);  // Normal Power ON (Relay OFF - LOW)
      Serial.println("⚡ [Relay Action] NORMAL POWER (Relay OFF - LOW)");
    } else { // STATE_NORMAL
      valve.write(0);        // Close Valve (0°)
      setPowerRelay(false);  // Normal Power ON (Relay OFF - LOW)
      Serial.println("⚡ [Relay Action] NORMAL POWER (Relay OFF - LOW)");
    }
    lastAppliedState = currentState;
  }

  if (currentState == STATE_NORMAL) {
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
  } else { // STATE_MODERATE or STATE_CRITICAL
    digitalWrite(LED_PIN, patternOn ? HIGH : LOW);
    digitalWrite(BUZZER_PIN, patternOn ? HIGH : LOW);
  }
}

// ------------------------------------------------------------------------------
// ☁️ CLOUD TELEMETRY FUNCTION — Runs on Core 0 (Completely Non-Blocking)
// ------------------------------------------------------------------------------
void sendCloudTelemetry(float tempZ1, float tempZ2, float tempZ3, float tempZ4, float flameVal, float gasMQ2, float gasMQ135) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  HTTPClient http;
  http.begin(SUPABASE_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer", "return=minimal");

  StaticJsonDocument<2048> doc;
  doc["temp_z1"] = tempZ1;
  doc["temp_z2"] = tempZ2;
  doc["temp_z3"] = tempZ3;
  doc["temp_z4"] = tempZ4;
  doc["temp_inside"] = isnan(tIn) ? 30.0 : tIn;
  doc["humidity_inside"] = isnan(hIn) ? 50.0 : hIn;
  doc["temp_outside"] = isnan(tOut) ? 30.0 : tOut;
  doc["humidity_outside"] = isnan(hOut) ? 50.0 : hOut;
  doc["mq2_val"] = gasMQ2;
  doc["mq135_val"] = gasMQ135;
  doc["flame_val"] = flameVal;
  doc["fan_status"] = ventFanActive;

  if (currentState == STATE_NORMAL) doc["system_state"] = "NORMAL";
  else if (currentState == STATE_MODERATE) doc["system_state"] = "MODERATE";
  else doc["system_state"] = "CRITICAL";

  JsonArray grid = doc.createNestedArray("thermal_grid");
  for (int i = 0; i < 64; i++) grid.add((double)smoothPx[i]);

  String jsonPayload;
  if (serializeJson(doc, jsonPayload) == 0) {
    http.end();
    return;
  }

  int httpCode = http.POST(jsonPayload);
  Serial.printf("[Cloud Core 0] POST -> HTTP Status: %d\n", httpCode);
  http.end();
}

void telemetryTask(void * pvParameters) {
  for (;;) {
    vTaskDelay(3000 / portTICK_PERIOD_MS);
    if (WiFi.status() == WL_CONNECTED) {
      sendCloudTelemetry(g_tempZ1, g_tempZ2, g_tempZ3, g_tempZ4, g_flameVal, g_mq2, g_mq135);
    }
  }
}

void sense() {
  amg.readPixels(frames[frameIdx]);
  frameIdx = (frameIdx + 1) % 3;
  if (frameCount < 3) frameCount++;
  for (int i = 0; i < 64; i++) {
    float s = 0;
    for (int f = 0; f < frameCount; f++) s += frames[f][i];
    smoothPx[i] = s / frameCount;
  }

  float tempZ1 = zoneMax(0, 0);  // Zone 1 (Top-Left)
  float tempZ2 = zoneMax(0, 4);  // Zone 2 (Top-Right)
  float tempZ3 = zoneMax(4, 0);  // Zone 3 (Bottom-Left)
  float tempZ4 = zoneMax(4, 4);  // Zone 4 (Bottom-Right)

  float maxThermal = tempZ1;
  if (tempZ2 > maxThermal) maxThermal = tempZ2;
  if (tempZ3 > maxThermal) maxThermal = tempZ3;
  if (tempZ4 > maxThermal) maxThermal = tempZ4;

  bool flameDetected = (digitalRead(FLAME_PIN) == FLAME_ACTIVE_LEVEL);
  float flameVal = flameDetected ? 1.0f : 0.0f;
  float a2 = analogRead(MQ2_PIN);
  float a135 = analogRead(MQ135_PIN);

  g_tempZ1 = tempZ1; g_tempZ2 = tempZ2; g_tempZ3 = tempZ3; g_tempZ4 = tempZ4;
  g_flameVal = flameVal; g_mq2 = a2; g_mq135 = a135;

  if (millis() - lastDht > 2500) {
    lastDht = millis();
    float curTIn = dhtIn.readTemperature();
    float curHIn = dhtIn.readHumidity();
    float curTOut = dhtOut.readTemperature();
    float curHOut = dhtOut.readHumidity();
    if (!isnan(curTIn)) tIn = curTIn;
    if (!isnan(curHIn)) hIn = curHIn;
    if (!isnan(curTOut)) tOut = curTOut;
    if (!isnan(curHOut)) hOut = curHOut;

    // Exhaust Fan Direct Control (ON when inside temp > 35.0°C)
    if (tIn > 35.0f) {
      setVentFan(true);  // Fan ON
    } else {
      setVentFan(false); // Fan OFF
    }
  }

  // ---- Automatic State Machine (Only active when manual override is OFF) ----
  if (!manualOverride) {
    bool inGrace = (millis() - bootTime < STARTUP_GRACE_MS);

    if (!criticalTriggered) {
      // Direct Triggers: Temperature > 60°C OR IR Flame Detected OR MQ-2 > 400 PPM OR MQ-135 > 350 PPM
      bool wantCritical = (maxThermal >= TEMP_CRITICAL_MIN) ||
                          flameDetected ||
                          (a2 >= MQ2_CRITICAL_MAX) ||
                          (a135 >= MQ135_CRITICAL_MAX);

      if (inGrace) {
        currentState = STATE_NORMAL;
        criticalStreak = 0;
      }
      else if (wantCritical) {
        criticalStreak++;
        if (criticalStreak >= DEBOUNCE_COUNT) {
          currentState = STATE_CRITICAL;
          criticalTriggered = true;
          criticalStartTime = millis();
          Serial.printf("\n🔥 [EDGE TRIP!] CRITICAL FIRE/GAS DETECTED! Tmax=%.1fC Flame=%d MQ2=%.0f MQ135=%.0f. Power Cut + Actuators Locked ON.\n",
                        maxThermal, flameDetected, a2, a135);
        }
      }
      else if (maxThermal >= TEMP_MODERATE_MIN || a2 >= 2500.0f || a135 >= 1500.0f) {
        currentState = STATE_MODERATE;
        criticalStreak = 0;
        Serial.println("\n⚠️ [HOTSPOT/GAS DRIFT] Moderate conditions detected.");
      }
      else {
        currentState = STATE_NORMAL;
        criticalStreak = 0;
      }
    }
    else {
      // ⏱️ 15-SECOND CRITICAL AUTO-RESET LOOP
      if (millis() - criticalStartTime >= CRITICAL_HOLD_MS) {
        if (maxThermal < TEMP_CRITICAL_MIN && !flameDetected && a2 < MQ2_CRITICAL_MAX && a135 < MQ135_CRITICAL_MAX) {
          if (maxThermal >= TEMP_MODERATE_MIN || a2 >= 2500.0f || a135 >= 1500.0f) {
            currentState = STATE_MODERATE;
            Serial.println("\n⚠️ [AUTO-RESET] 15s Critical loop completed. Conditions moderate. Transition to MODERATE!");
          } else {
            currentState = STATE_NORMAL;
            Serial.println("\n✅ [AUTO-RESET] 15s Critical loop completed & hazard cleared. Reset to NORMAL!");
          }
          criticalTriggered = false;
          criticalStreak = 0;
        } else {
          criticalStartTime = millis();
          Serial.println("\n⚠️ [CRITICAL HOLD] 15s elapsed but heat/flame/gas still present. Extending CRITICAL!");
        }
      }
    }
  }

  Serial.printf("Z1:%.1f°C Z2:%.1f°C Z3:%.1f°C Z4:%.1f°C | In:%.1f°C Out:%.1f°C | MQ2:%.0f MQ135:%.0f | Flame:%.0f | Fan:%s | Relay:%s | Mode:%s | State:%s\n",
                tempZ1, tempZ2, tempZ3, tempZ4, tIn, tOut, a2, a135, flameVal,
                ventFanActive ? "ON" : "OFF",
                (currentState == STATE_CRITICAL) ? "POWER_CUT(HIGH)" : "POWER_ON(LOW)",
                manualOverride ? "MANUAL_TEST" : "AUTO",
                currentState == STATE_NORMAL ? "NORMAL" : (currentState == STATE_MODERATE ? "MODERATE" : "CRITICAL"));
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(POWER_RELAY_PIN, OUTPUT);
  pinMode(VENT_FAN_PIN, OUTPUT);
  pinMode(FLAME_PIN, INPUT_PULLUP);

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  setPowerRelay(false);  // Normal power ON (Pin 27 LOW -> Relay OFF -> COM connected to NC)
  setVentFan(false);     // Fan OFF initially

  ESP32PWM::allocateTimer(0);
  valve.setPeriodHertz(50);
  valve.attach(SERVO_PIN, 500, 2400);
  valve.write(0);        // Valve closed (0°)

  Wire.begin(21, 22);
  if (!amg.begin(0x69) && !amg.begin(0x68)) {
    Serial.println("❌ [Hardware Error] AMG8833 NOT found on I2C (SDA=21, SCL=22)");
    while (1) delay(1000);
  }
  Serial.println("✅ [Hardware] AMG8833 initialised.");

  dhtIn.begin();
  dhtOut.begin();

  Serial.print("📡 [Wi-Fi] Connecting to: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int wifiTimeout = 0;
  while (WiFi.status() != WL_CONNECTED && wifiTimeout < 20) {
    delay(500);
    Serial.print(".");
    wifiTimeout++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ [Wi-Fi] Connected successfully!");
    Serial.print("   IP: ");
    Serial.println(WiFi.localIP());

    xTaskCreatePinnedToCore(telemetryTask, "CloudTelemetry", 8192, NULL, 1, NULL, 0);
    Serial.println("🚀 [FreeRTOS] Cloud Telemetry Task launched on Core 0.");
  } else {
    Serial.println("\n⚠️ [Wi-Fi Warning] Timed out, running edge only.");
  }

  bootTime = millis();

  Serial.println("\n=======================================================");
  Serial.println("✅ [System Ready] Direct Serial Monitor Commands:");
  Serial.println("   Type 'c' -> Force CRITICAL State (Relay Power CUT, Servo 90°, Fast Siren)");
  Serial.println("   Type 'm' -> Force MODERATE State (Relay Normal, Servo 0°, Warning Beep)");
  Serial.println("   Type 'r' or 'n' -> RESET / Clear Manual Override to NORMAL");
  Serial.printf("   Startup grace period: %d ms (readings ignored while sensor warms up)\n", STARTUP_GRACE_MS);
  Serial.println("=======================================================\n");
}

void loop() {
  updateOutputs();

  if (millis() - lastSample >= SAMPLE_MS) {
    lastSample = millis();
    sense();
  }

  if (Serial.available()) {
    char ch = Serial.read();
    if (ch == 'c' || ch == 'C') {
      manualOverride = true;
      currentState = STATE_CRITICAL;
      Serial.println("\n🧪 [TEST] MANUAL OVERRIDE -> FORCE CRITICAL STATE");
      Serial.println("   - Power Relay: HIGH (Relay Energized -> Power CUT)");
      Serial.println("   - Servo Valve: 90° (OPEN)");
      Serial.println("   - Actuators: Fast 1 0 1 0 Beep & Blink");
    } 
    else if (ch == 'm' || ch == 'M') {
      manualOverride = true;
      currentState = STATE_MODERATE;
      Serial.println("\n🧪 [TEST] MANUAL OVERRIDE -> FORCE MODERATE STATE");
      Serial.println("   - Power Relay: LOW (Relay OFF -> Normal Power ON)");
      Serial.println("   - Servo Valve: 0° (CLOSED)");
      Serial.println("   - Actuators: Warning 1 0 1 0 Beep & Blink");
    } 
    else if (ch == 'r' || ch == 'R' || ch == 'n' || ch == 'N') {
      manualOverride = false;
      criticalTriggered = false;
      criticalStreak = 0;
      currentState = STATE_NORMAL;
      Serial.println("\n✅ [RESET] MANUAL OVERRIDE CLEARED -> SYSTEM BACK TO NORMAL");
    }
  }
}
