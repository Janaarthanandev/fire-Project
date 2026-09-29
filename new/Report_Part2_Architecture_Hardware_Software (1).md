# Project Report — Part 2
## System Architecture, Hardware Design, Software and Firmware Design

---

## Chapter 5: System Architecture

### 5.1 Overview

The system is organised as a layered architecture in which each layer has a clearly defined responsibility and communicates with adjacent layers through well-specified interfaces. The overall pipeline is:

**Filling Godown (Physical Environment) → Sensors and Hardware → ESP32 Edge Node → Supabase Database → FastAPI Backend → ML Models → React Dashboard → Alert and Containment Actions**

Figure 5.1 illustrates the complete data flow from sensor reading to physical containment action.

```
┌─────────────────────────────────────────────┐
│         FILLING GODOWN (Physical Layer)      │
│  AMG8833 · Flame · Gas · Vibration · DHT22  │
└──────────────────┬──────────────────────────┘
                   │ I2C / GPIO
┌──────────────────▼──────────────────────────┐
│              ESP32 EDGE NODE                 │
│  Frame smoothing · Stage 1 check             │
│  Zone lookup · Edge failsafe                 │
│  Relay actuation · Servo control             │
└──────────────────┬──────────────────────────┘
                   │ HTTP POST (every cycle)
┌──────────────────▼──────────────────────────┐
│             SUPABASE DATABASE                │
│  sensor_readings · risk_scores               │
│  fire_events · commands_log                  │
└──────────┬──────────────────┬───────────────┘
           │ Real-time         │ Real-time
           │ subscription      │ subscription
┌──────────▼──────────┐ ┌─────▼───────────────┐
│   FASTAPI BACKEND    │ │   REACT DASHBOARD    │
│  M1: Isolation Forest│ │  Zone cards          │
│  M2: Random Forest   │ │  Alert feed          │
│  Stage 4 logic       │ │  Sensor trends       │
└─────────────────────┘ └─────────────────────┘
```

### 5.2 Physical Environment Layer

The system monitors a single filling godown — a small, physically isolated shed in which pre-mixed pyrotechnic composition is packed into casings. By regulation, Sivakasi-style godowns separate each manufacturing process into individual sheds, with shed dimensions legally capped to limit blast damage per incident. The natural ambient temperature range in Sivakasi is 25°C to 40°C, with a safe operating humidity band of 40% to 70% per industry standard.

The godown is divided into four spatial zones defined by the AMG8833 thermal sensor's field of view:

```
AMG8833 8×8 thermal grid (rows 0–7, cols 0–7):

              cols 0–3          cols 4–7
rows 0–3     Zone_1_Fill        Zone_2_Fill
rows 4–7     Zone_3_Fill        Zone_4_Exit

Zone_1_Fill: rows 0–3, cols 0–3  (16 pixels)
Zone_2_Fill: rows 0–3, cols 4–7  (16 pixels)
Zone_3_Fill: rows 4–7, cols 0–3  (16 pixels)
Zone_4_Exit: rows 4–7, cols 4–7  (16 pixels — evacuation path only)
```

Each of the three filling zones is equipped with a complete secondary sensor set:

| Zone | Flame sensor | MQ-2 | MQ-135 | Servo (powder) |
|---|---|---|---|---|
| Zone_1_Fill | ✅ | ✅ | ✅ | ✅ |
| Zone_2_Fill | ✅ | ✅ | ✅ | ✅ |
| Zone_3_Fill | ✅ | ✅ | ✅ | ✅ |
| Zone_4_Exit | ❌ | ❌ | ❌ | ❌ |

Zone_4_Exit is the godown's exit doorway. It has no filling activity, no chemical presence, and no secondary sensors during normal operation. It is permanently excluded from any powder release action — a physical/wiring-level exclusion that ensures no software fault can inadvertently deploy suppressant onto the evacuation path.

### 5.3 Two-Stage Detection Pipeline

The core detection logic operates as a cascaded pipeline. Stage 1 runs every cycle on the full thermal grid. Stages 2 through 4 only run if Stage 1 flags a hotspot. This design keeps the steady-state processing load minimal and concentrates computational effort only where and when it is required.

**Stage 1 — Whole-grid hotspot check (every cycle):**
The ESP32 reads the full 8×8 thermal frame from the AMG8833. After applying 3–5 frame smoothing to reduce single-pixel noise (essential given that each zone has only 16 pixels), the system computes the global maximum temperature and the thermal rise rate (temperature change since the previous cycle). If either value crosses its respective threshold (50°C for temperature or 3°C per cycle for rise rate), a hotspot is flagged and processing continues to Stage 2. Otherwise, the cycle ends and the data is posted to Supabase.

**Stage 2 — Zone localization (only if Stage 1 flags a hotspot):**
The ESP32 identifies the row and column of the hottest pixel in the smoothed frame and performs a rule-based coordinate lookup to determine which of the four zones that pixel falls within. This is deterministic arithmetic — not a machine learning operation — and is computed in microseconds on the ESP32.

**Stage 3 — Secondary sensor confirmation (only for the flagged zone):**
The ESP32 reads the secondary sensors — IR flame sensor, gas sensor, and vibration sensor — specifically for the zone identified in Stage 2. These readings, combined with the thermal data, are posted to Supabase and trigger M2 inference on the backend.

**Stage 4 — Escalation and containment (only if M2 confidence exceeds 75%):**
Upon receiving M2's confidence score and action tier from the backend (via Supabase real-time), the ESP32 executes the appropriate physical actions: sounding the evacuation siren, cutting godown power via relay, and activating the servo-controlled powder release mechanisms in the targeted zones after a mandatory pre-release delay of seven seconds.

### 5.4 Edge Failsafe (Offline Operation)

A critical design requirement is that the most urgent safety actions — evacuation alarm and power cutoff — must not depend on backend or cloud connectivity. The ESP32 implements an on-chip edge failsafe that triggers immediately when all three of the following conditions are simultaneously true, without waiting for a backend response:

- `thermal_max > 65°C`
- `flame_reading > 0.70`
- `gas_ppm > 280`

This threshold (65°C) is 25°C above Sivakasi's documented maximum natural ambient temperature of 40°C, making it unambiguously anomalous. The three-condition AND requirement ensures that two independent physical signals beyond temperature confirm the event before the edge takes action, reducing the risk of false triggering in offline mode.

When the edge failsafe triggers, the ESP32 immediately sounds the siren, cuts power, and posts the event to Supabase marked as `edge_triggered: true`. The backend still receives and processes this event through M2 for confirmation and logging purposes but does not re-trigger any physical action.

---

## Chapter 6: Hardware Design and Components

### 6.1 Hardware Component List

| Component | Quantity | Purpose | Interface |
|---|---|---|---|
| ESP32 development board | ×1 | Single edge microcontroller for all sensing, ML trigger, and actuation | — |
| AMG8833 (8×8 thermal array) | ×1 | Whole-godown thermal sensing, four-zone spatial coverage | I2C |
| DHT22 (temperature + humidity) | ×2 | One inside godown (working conditions), one outside (ambient reference) | Digital GPIO |
| MQ-2 gas sensor | ×3 | One per fill zone — combustible gas and smoke detection | Analog GPIO |
| MQ-135 gas sensor | ×3 | One per fill zone — VOC and air quality monitoring | Analog GPIO |
| IR flame sensor | ×3 | One per fill zone — combustion spectral signature detection | Digital/Analog GPIO |
| SG90 servo motor | ×3 | One per fill zone — actuates powder hopper trapdoor gate | PWM GPIO |
| DC motor | ×1 | Drives the ventilation fan | Digital GPIO via relay |
| Fan | ×1 | Temperature regulation (normal) + smoke expulsion (fire event) | Via DC motor |
| Relay module (fan control) | ×1 | Controls DC motor / fan activation | Digital GPIO |
| Relay module (power cutoff) | ×1 | Cuts godown electrical power on alarm | Digital GPIO |
| Buzzer | ×1 | Audible evacuation alarm signal | Digital GPIO |
| Gravity-fed powder hopper | ×3 | One per fill zone — holds and releases dry chemical powder | Mechanical, via servo |
| Battery | ×4 | System power supply | — |
| Jumper wires, mounts | — | Wiring and physical installation | — |

### 6.2 Thermal Sensor — AMG8833

The AMG8833 is a thermopile-based far-infrared thermal array sensor that outputs a grid of 64 temperature values (8×8) at up to 10 frames per second via I2C. Each of the 64 thermopile elements measures the infrared emission from the corresponding region of its field of view and converts it to a calibrated temperature value in degrees Celsius using onboard factory calibration coefficients stored in internal EEPROM. The sensor communicates these values as an already-calibrated temperature array; no additional temperature computation is required on the microcontroller.

The 110° wide-angle field-of-view variant is used, as it is designed for short-range, full-room coverage, which suits a small godown interior. The sensor is mounted centrally at ceiling height to provide uniform coverage of the room's floor area.

The AMG8833 was selected over the higher-resolution MLX90640 (32×24) for cost considerations. The trade-off is that each of the four 4×4 sub-zones contains only 16 pixels, which limits sub-zone spatial detail. This trade-off is acceptable because the system's containment decisions are zone-level decisions (which zone is affected, which zones to target with powder), not pixel-level decisions. Frame averaging across 3–5 consecutive frames is applied to mitigate the increased noise sensitivity inherent in the lower pixel count.

### 6.3 DHT22 — Inside and Outside Differential Monitoring

Two DHT22 temperature-humidity sensors are deployed: one mounted inside the godown measuring actual working conditions, and one mounted outside measuring the ambient environmental reference. This dual-sensor arrangement enables a derived feature — the inside-outside humidity differential — that provides a stronger pre-ignition risk signal than either sensor alone. When inside humidity is dropping faster than outside humidity (indicating that the chemical composition itself may be absorbing or releasing moisture, or that ventilation is inadequate), this differential widens and is flagged by M1 as an elevated hygroscopic risk indicator.

The inside DHT22 also feeds the fan temperature-regulation logic: when the inside temperature exceeds a configurable upper comfortable threshold relative to outside, the ESP32 activates the fan relay to equalise conditions, keeping the godown within the safe operating range of 25–40°C.

### 6.4 Gas Sensors — MQ-2 and MQ-135 (Per Zone)

Both MQ-2 and MQ-135 sensors are deployed in each of the three filling zones — three units of each sensor type, six gas sensors total. The MQ-2 is sensitive to LPG, smoke, and combustible gases. The MQ-135 provides broader air-quality and VOC detection, making it more sensitive to the early off-gassing that can precede self-heating in pyrotechnic composition. Deploying both types per zone provides complementary coverage: MQ-2 catches combustion-stage gas signatures that M2 uses for fire confirmation; MQ-135 catches the earlier, subtler VOC drift that M1 uses for pre-ignition risk scoring.

Sensor outputs are read as analog voltages by the ESP32's ADC and converted to ppm-equivalent readings. Two derived features are computed: the raw `gas_ppm` reading for M2's snapshot fire confirmation, and the `gas_baseline_drift` — the deviation from a rolling mean of the last N readings for that zone — for M1's slow-drift pre-ignition monitoring.

### 6.5 Infrared Flame Sensor (Per Zone)

One infrared flame sensor is deployed per filling zone. The sensor detects the specific infrared wavelength emitted by a flame (typically 760–1100 nm), distinct from the general heat emission measured by the AMG8833. It provides the most direct and specific evidence of active combustion — a hot machine part may elevate the thermal camera reading without triggering the flame sensor, while an actual flame triggers both simultaneously. This distinction is central to M2's ability to separate genuine fire events from false positives caused by benign heat sources.

### 6.6 Fan and DC Motor

A DC-motor-driven fan serves two distinct automated roles controlled by the ESP32 via a dedicated relay module:

**Temperature regulation mode (normal operation):** The ESP32 continuously compares the inside and outside DHT22 readings. When the inside temperature rises above a safe threshold relative to outside ambient, the fan relay is activated to increase ventilation and equalise conditions. When conditions return to within the safe range, the relay deactivates the fan. This keeps the godown within the Explosives Rules-mandated operating temperature range without manual intervention.

**Fire response mode (M2 evacuation triggered):** When M2 produces a confidence score above 75% and the evacuation action is initiated, the fan relay activates immediately to push smoke and combustion gases out of the godown. This serves two purposes: improving visibility for workers evacuating, and reducing the concentration of combustion gases in the exit path. The fan remains active throughout the evacuation sequence and is only deactivated after the event is resolved.

### 6.7 Dry Powder Release Mechanism

Each of the three filling zones is equipped with a gravity-fed hopper mounted centrally above that zone. An SG90 servo motor is mounted at the hopper's base, controlling a trapdoor gate. When the ESP32 receives a containment command for a given zone, it drives that zone's corresponding servo to rotate open the gate, allowing the hopper's powder contents to fall by gravity into the zone below. The servo returns the gate to the closed position after a fixed release duration.

Gravity dumping (rather than pressurised spray) is used for the prototype because it eliminates the need for pressurised vessels — which introduce additional safety hazards in an already explosive-sensitive environment — while still providing adequate coverage of the zone area when the hopper is mounted centrally overhead.

For the prototype and demonstration build, flour or baking soda is used as a safe, non-hazardous stand-in for dry chemical powder. The control logic, wiring, and mechanism are identical to a deployment using a real dry chemical agent. Zone_4_Exit has no hopper or servo installed whatsoever — a physical/wiring-level exclusion ensuring the evacuation path cannot be targeted regardless of software state.

### 6.8 Relay Modules

Two independent relay modules are used:
- **Relay 1 — Fan control:** Activates the DC motor driving the ventilation fan, controlled by both the temperature-regulation logic and the fire-response sequence.
- **Relay 2 — Power cutoff:** Disconnects godown electrical power upon a confirmed evacuation-tier event, removing potential ignition sources from the electrical system.

### 6.7 Temperature Threshold Calibration

All detection thresholds are calibrated against the documented operating environment:

| Threshold | Value | Basis |
|---|---|---|
| Stage 1 temperature | 50°C | 10°C above Sivakasi's maximum natural ambient (40°C) |
| Stage 1 rise rate | 3°C per cycle | No natural ambient drift produces this rate |
| Edge failsafe temperature | 65°C | 25°C above maximum natural ambient — unambiguous |
| Edge failsafe flame | 0.70 (normalised) | Strong IR combustion spectral signal |
| Edge failsafe gas | 280 ppm | Significant smoke/combustion gas concentration |
| Pre-release delay | 7 seconds | Interim safety buffer before powder deployment |

---

## Chapter 7: Software and Firmware Design

### 7.1 Firmware Architecture (ESP32)

The ESP32 firmware is written in C++ using the Arduino framework and developed in Arduino IDE. The firmware implements the following functions in a continuous loop:

**Sensor reading loop (every 5 seconds):**
- Read the AMG8833 via I2C using the Adafruit AMG88xx library
- Compute the 3-frame smoothed thermal grid
- Read both DHT22 sensors (inside and outside); compute temperature differential and humidity differential
- Read per-zone MQ-2, MQ-135, and flame sensors for all three fill zones
- Compute global_max_temp, thermal_rise_rate, zone_avg_temp per zone, and hotspot_pixel_count
- Perform Stage 1 hotspot check
- If hotspot detected: perform Stage 2 zone lookup, Stage 3 secondary sensor read for flagged zone
- Perform edge failsafe check (thermal_max > 65 AND flame > 0.70 AND gas > 280)
- Post JSON sensor reading to Supabase via HTTP POST
- If edge failsafe triggered: immediately activate buzzer, power-cutoff relay, and fan relay

**Fan temperature-regulation loop (continuous, parallel to sensor loop):**
- Compare inside DHT22 temperature to outside DHT22 temperature
- If inside temperature exceeds outside by more than a configurable threshold: activate fan relay
- If differential returns within safe range: deactivate fan relay
- During any evacuation event (M2 or edge triggered): override fan relay to ON regardless of temperature differential, and hold ON until event is resolved

**Command subscription loop:**
- Poll the Supabase `commands_log` table for new rows addressed to this godown
- On receiving a command: parse `command` field, execute appropriate action (siren, power cutoff, servo activation with 7-second pre-release delay per zone)
- Post acknowledgment to Supabase `commands_log` with `acknowledged: true` and `actions_taken` list

**MQTT topic structure** (for future multi-node extension, not required for current single-node prototype):
- `godown/filling_01/sensors` — sensor readings
- `godown/filling_01/events` — hotspot events
- `godown/filling_01/commands` — commands to ESP32
- `godown/filling_01/status` — acknowledgment

### 7.2 Backend Architecture (Python / FastAPI)

The backend is implemented in Python using the FastAPI framework. It performs the following functions:

**Supabase real-time subscription:**
The backend subscribes to the `sensor_readings` Supabase table. On every new row insertion (triggered by an ESP32 HTTP POST), the backend's event handler is invoked.

**M1 inference loop:**
For every incoming sensor reading, the backend extracts the M1 feature set (zone_thermal_avg, zone_thermal_trend, humidity, gas_level, gas_baseline_drift) and passes it to the trained Isolation Forest model for that zone. The resulting risk score and tier are inserted into the `risk_scores` table.

**Stage 1 check and M2 invocation:**
The backend evaluates the Stage 1 condition (thermal_max > 50 OR thermal_rise_rate > 3). If met, the backend queries the latest three M1 risk scores for that zone to construct the M1 context features, assembles the full 11-feature vector, and passes it to the M2 Random Forest classifier.

**Stage 4 logic:**
Based on M2's confidence score, the backend determines the action tier and, if the tier is "evacuate," computes the powder target zones using the zone-targeting logic. The command is inserted into the `commands_log` table, where the ESP32's polling loop picks it up.

**Fallback behaviour:**
If any trained model file fails to load at startup, the backend falls back silently to the rule-based weighted formula for M1 and a heuristic confidence scorer for M2. The fallback event is logged. This ensures the factory retains a working (if less sophisticated) protection layer even if the ML model files are corrupted or missing.

### 7.3 Database Design (Supabase / PostgreSQL)

All data is stored in a Supabase project, which provides a PostgreSQL database with built-in real-time subscription support. The schema consists of four tables:

**`sensor_readings`** — raw sensor data, one row per ESP32 upload cycle:
```
id, created_at, godown_id, zone, thermal_max, thermal_avg,
thermal_trend, humidity, gas_level, gas_baseline_drift,
flame_reading, gas_ppm, gas_roc, vibration
```

**`risk_scores`** — M1 output, one row per fill zone per inference cycle:
```
id, created_at, godown_id, zone, risk_score, risk_tier,
anomaly_score_raw, zone_thermal_avg, zone_thermal_trend,
humidity, gas_level, gas_baseline_drift
```

**`fire_events`** — M2 output, written only when Stage 1 detects a hotspot:
```
id, created_at, godown_id, fire_zone, confidence, action_taken,
triggered_by, edge_triggered, m2_agreement, powder_released,
powder_zones, thermal_max_at_event, m1_risk_score_at_event,
m1_risk_tier_at_event, pre_release_delay_seconds, status_acknowledged
```

**`commands_log`** — every command sent to the ESP32:
```
id, created_at, godown_id, command, confidence, fire_zone,
powder_zones, triggered_by, pre_release_delay, acknowledged,
acknowledged_at, actions_taken
```

Supabase real-time subscriptions are enabled on `sensor_readings`, `risk_scores`, `fire_events`, and `commands_log`. The React dashboard subscribes to these channels to receive live updates without polling.

### 7.4 Configuration Management

All thresholds and tunable values are maintained in a single `config.py` file on the backend. No threshold values are hardcoded in business logic. Key configuration values include:

```
STAGE1_TEMP_THRESHOLD     = 50.0   # °C
STAGE1_RISE_THRESHOLD     = 3.0    # °C per cycle
EDGE_THERMAL_THRESHOLD    = 65.0   # °C
EDGE_FLAME_THRESHOLD      = 0.70
EDGE_GAS_THRESHOLD        = 280.0  # ppm
M2_LOG_THRESHOLD          = 40.0   # % confidence
M2_EVACUATE_THRESHOLD     = 75.0   # % confidence
PRE_RELEASE_DELAY_SECONDS = 7
M1_INFERENCE_INTERVAL_SEC = 15
M1_FRAME_SMOOTHING_WINDOW = 3
M1_MODERATE_THRESHOLD     = 40.0
M1_DANGEROUS_THRESHOLD    = 70.0
```

### 7.5 Technology Stack Summary

| Layer | Technology | Purpose |
|---|---|---|
| Firmware | C/C++ (Arduino framework) | ESP32 edge firmware |
| Firmware IDE | Arduino IDE | Development environment |
| Thermal library | Adafruit AMG88xx | Read AMG8833 via I2C |
| DHT library | DHTesp or Adafruit DHT | Read both DHT22 sensors |
| JSON packaging | ArduinoJson | Sensor data serialisation |
| Backend language | Python | Backend, ML, and data pipeline |
| Backend framework | FastAPI | REST and WebSocket server |
| ML library | scikit-learn | Isolation Forest (M1), Random Forest (M2) |
| Data handling | pandas, NumPy | Feature engineering, array operations |
| Model persistence | joblib | Save and load trained models |
| Evaluation | matplotlib, seaborn | Confusion matrices, feature importance |
| Database | Supabase (PostgreSQL) | Time-series sensor and event storage |
| Real-time | Supabase real-time subscriptions | Live dashboard updates |
| Frontend | React + Tailwind CSS + Recharts | Control-room dashboard |
| Version control | Git + GitHub | Source control and collaboration |
