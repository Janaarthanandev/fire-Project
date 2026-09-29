# FireGuard ESP32 Hardware & Cloud Firmware Guide

This directory contains the complete Embedded C / C++ firmware implementations for the **FireGuard Pre-Ignition & Automated Fire Suppression System**.

---

## 📁 Firmware File Index

| File | Purpose | Key Libraries Used |
|---|---|---|
| [`esp32_cloud_sender.ino`](file:///d:/fire%20Project/firmware/esp32_cloud_sender.ino) | Focused Wi-Fi & HTTP POST telemetry sender that reads the **AMG8833 8×8 (64 pixels) IR thermal matrix**, constructs JSON payloads, and pushes live data to Supabase. | `WiFi`, `HTTPClient`, `ArduinoJson`, `Adafruit_AMG88xx`, `DHT` |
| [`esp32_full_hardware_system.ino`](file:///d:/fire%20Project/firmware/esp32_full_hardware_system.ino) | **Complete Production Firmware** integrating all hardware sensors (AMG8833, DHT22, MQ gas, Flame detector), local audio-visual alarms, **solenoid valve relay for powder release**, and cloud publishing with edge fail-safe logic. | `Wire`, `WiFi`, `HTTPClient`, `ArduinoJson`, `Adafruit_AMG88xx`, `DHT` |

---

## ⚡ Hardware Wiring & ESP32 Pin Mapping

Connect your hardware components to the ESP32 development board according to the pinout table below:

| Sensor / Actuator | ESP32 Pin | Interface Type | Operating Voltage | Notes |
|---|---|---|---|---|
| **AMG8833 IR Camera (SDA)** | `GPIO 21` | I2C Data | 3.3V | 8×8 Thermal Camera Matrix |
| **AMG8833 IR Camera (SCL)** | `GPIO 22` | I2C Clock | 3.3V | Pull-up resistors enabled |
| **DHT22 Temp & Humidity** | `GPIO 4` | OneWire Digital | 3.3V / 5V | 10k pull-up on data pin |
| **MQ-2 / MQ-135 Gas Sensor** | `GPIO 34` | Analog Input (`ADC1_CH6`) | 5V | Read 0–4095 raw ADC value |
| **Optical Flame Sensor** | `GPIO 35` | Digital Input (`ADC1_CH7`) | 3.3V / 5V | Active LOW trigger on flame |
| **Powder Solenoid Relay** | `GPIO 26` | Digital Output | 5V Relay Coil | Triggers fire powder release valve |
| **Warning Buzzer Alarm** | `GPIO 27` | Digital Output | 5V | Active piezo buzzer |
| **Green Status LED** | `GPIO 14` | Digital Output | 3.3V (220Ω Resistor) | System Normal / Safe indicator |
| **Red Critical LED** | `GPIO 12` | Digital Output | 3.3V (220Ω Resistor) | Warning / Fire Alarm indicator |

---

## 🛠 Required Arduino IDE Libraries

Install the following libraries via **Arduino IDE → Sketch → Include Library → Manage Libraries**:

1. **`Adafruit_AMG88xx`** (v1.3.0+) — For reading 8×8 IR thermal array pixels over I2C.
2. **`DHT sensor library`** by Adafruit (v1.4.4+) — For reading DHT22 temperature & humidity.
3. **`ArduinoJson`** by Benoit Blanchon (v6.21.0+) — For JSON payload serialization.
4. **`Adafruit Unified Sensor`** — Standard dependency for Adafruit sensors.

---

## 🔍 Detailed Code Walkthrough

### 1. 64-Pixel Thermal Array Sampling & Payload Serialization
The AMG8833 camera outputs a flat array of 64 float temperature readings (`pixels[0]` to `pixels[63]`):

```cpp
float pixels[AMG88xx_PIXEL_ARRAY_SIZE]; // 64 floats
amg.readPixels(pixels);
```

Using **`ArduinoJson`**, the 64 float values are serialized into a JSON array embedded inside the payload sent to Supabase:

```cpp
StaticJsonDocument<2048> doc;
doc["godown_id"]          = "godown_filling_01";
doc["zone"]               = "Zone_1_Fill";
doc["thermal_avg"]        = tAvg;
doc["thermal_max"]        = tMax;
doc["humidity"]           = hum;
doc["gas_level"]          = gasVal;
doc["gas_baseline_drift"] = gasDrift;

// Embed 64-element array
JsonArray gridArr = doc.createNestedArray("thermal_grid");
for (int i = 0; i < 64; i++) {
  gridArr.add(pixels[i]);
}
```

### 2. HTTP POST Telemetry Transmission
The ESP32 communicates directly with Supabase PostgREST API using standard HTTP POST headers:

```cpp
HTTPClient http;
http.begin("https://YOUR_SUPABASE_PROJECT_REF.supabase.co/rest/v1/sensor_readings");
http.addHeader("Content-Type", "application/json");
http.addHeader("apikey", SUPABASE_KEY);
http.addHeader("Authorization", "Bearer YOUR_SUPABASE_ANON_KEY");

int responseCode = http.POST(jsonPayload);
```

### 3. Fail-Safe Autonomous Edge Suppression Logic
If Wi-Fi or Internet connectivity drops, `esp32_full_hardware_system.ino` runs an **autonomous local safety loop**:
- If `thermal_max > 65.0°C` AND `flame_reading > 0.70` AND `gas_ppm > 280.0` (all 3 sensors simultaneously true):
  - Solenoid valve relay (`GPIO 26`) opens immediately to release fire extinguishing powder.
  - Local piezo buzzer alarms and Red LED illuminates.
  - Emergency event log is pushed to `fire_events` table once network restores.

---

## 🚀 How to Compile & Flash

1. Open `esp32_full_hardware_system.ino` in **Arduino IDE**.
2. Select **Tools → Board → ESP32 Dev Module**.
3. Select the correct **COM Port** (e.g. `COM3` or `COM5`).
4. Update `WIFI_SSID`, `WIFI_PASS`, `SUPABASE_URL`, and `SUPABASE_KEY` in the code.
5. Click **Upload** (`Ctrl + U`).
6. Open **Serial Monitor** at `115200` baud rate to inspect live telemetry logs.
