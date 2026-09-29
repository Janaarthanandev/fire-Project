/*
 * ==============================================================================
 * FireGuard ESP32 Cloud Sender — Embedded C / C++ (Arduino Framework)
 * 
 * Purpose:
 *   Demonstrates how an ESP32 microcontroller collects sensor data & 64-pixel
 *   AMG8833 IR thermal matrix readings, constructs a JSON payload, and transmits
 *   it directly to Supabase REST API (or custom FastAPI backend) over HTTP POST.
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_AMG88xx.h>
#include <DHT.h>

// ------------------------------------------------------------------------------
// Wi-Fi Configuration
// ------------------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ------------------------------------------------------------------------------
// Supabase / Backend Cloud Configuration
// ------------------------------------------------------------------------------
// Option A: Direct Supabase REST API Endpoint
const char* SUPABASE_URL  = "https://YOUR_SUPABASE_PROJECT_REF.supabase.co/rest/v1/sensor_readings";
const char* SUPABASE_KEY  = "YOUR_SUPABASE_ANON_OR_SERVICE_KEY";

// Option B: Local / Cloud FastAPI Backend Endpoint
const char* BACKEND_URL   = "http://192.168.1.100:8000/api/sensor-data";

// Target Identification
const char* GODOWN_ID     = "godown_filling_01";
const char* ZONE_ID       = "Zone_1_Fill";

// ------------------------------------------------------------------------------
// Hardware Pins & Objects
// ------------------------------------------------------------------------------
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

#define MQ_GAS_PIN 34
Adafruit_AMG88xx amg;

float pixels[AMG88xx_PIXEL_ARRAY_SIZE]; // 64 pixels (8x8)

// ------------------------------------------------------------------------------
// Setup Routine
// ------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- FireGuard ESP32 Cloud Sender Initialization ---");

  // Initialize Sensors
  Wire.begin(21, 22); // SDA=21, SCL=22
  if (!amg.begin()) {
    Serial.println("[ERROR] Could not find a valid AMG8833 sensor! Check wiring.");
    while (1) delay(10);
  }
  Serial.println("[OK] AMG8833 IR Thermal Camera Initialized.");

  dht.begin();
  Serial.println("[OK] DHT22 Temp & Humidity Sensor Initialized.");

  // Connect to Wi-Fi
  connectWiFi();
}

// ------------------------------------------------------------------------------
// Main Loop
// ------------------------------------------------------------------------------
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // 1. Read AMG8833 8x8 IR Matrix (64 Pixels)
  amg.readPixels(pixels);

  float thermal_avg = 0.0;
  float thermal_max = pixels[0];
  for (int i = 0; i < 64; i++) {
    thermal_avg += pixels[i];
    if (pixels[i] > thermal_max) {
      thermal_max = pixels[i];
    }
  }
  thermal_avg /= 64.0;

  // 2. Read DHT22 & MQ Gas Sensors
  float humidity = dht.readHumidity();
  if (isnan(humidity)) humidity = 45.0; // Fallback

  int rawGas = analogRead(MQ_GAS_PIN);
  float gas_level = (rawGas / 4095.0) * 1000.0; // Scale 0-4095 -> 0-1000 PPM approx

  // 3. Send Payload to Supabase Cloud
  sendToSupabase(thermal_avg, thermal_max, humidity, gas_level, pixels);

  // Send cycle interval: 2 seconds
  delay(2000);
}

// ------------------------------------------------------------------------------
// Function: Wi-Fi Connection Manager
// ------------------------------------------------------------------------------
void connectWiFi() {
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection Failed. Will retry next loop.");
  }
}

// ------------------------------------------------------------------------------
// Function: Transmit Data to Supabase REST API via HTTP POST
// ------------------------------------------------------------------------------
void sendToSupabase(float thermalAvg, float thermalMax, float humidity, float gasLevel, float* grid64) {
  HTTPClient http;
  
  // Initialize HTTP Client with target URL
  http.begin(SUPABASE_URL);

  // Set HTTP Headers for Supabase Authorization
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer", "return=minimal");

  // Construct JSON Payload using ArduinoJson
  // Capacity: 64 floats + metadata ~ 2048 bytes
  StaticJsonDocument<2048> doc;
  
  doc["godown_id"]          = GODOWN_ID;
  doc["zone"]               = ZONE_ID;
  doc["thermal_avg"]        = thermalAvg;
  doc["thermal_max"]        = thermalMax;
  doc["thermal_trend"]      = 0.5; // Calculated trend over window
  doc["humidity"]           = humidity;
  doc["gas_level"]          = gasLevel;
  doc["gas_baseline_drift"] = 12.5;

  // Add 64 Thermal Matrix Pixels Array
  JsonArray gridArray = doc.createNestedArray("thermal_grid");
  for (int i = 0; i < 64; i++) {
    gridArray.add(grid64[i]);
  }

  // Serialize to string
  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("\n[HTTP] Sending Payload to Cloud...");
  int httpResponseCode = http.POST(jsonPayload);

  if (httpResponseCode > 0) {
    Serial.printf("[HTTP] Cloud Server Response Code: %d\n", httpResponseCode);
  } else {
    Serial.printf("[HTTP] Error sending POST: %s\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}
