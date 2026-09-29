# 📊 Presentation Guide: Core AI Engine (M1 & M2) & Full System Architecture
> **Project:** Fire Guardian — AI-Powered Smart Fire Safety System for Sivakasi Godowns  
> **Focus:** Comprehensive Code, Hardware & Architecture Perspective (Based on Project Report Parts 1, 2 & 3)

---

## 🎯 Executive Summary for Slide Presentation

In Sivakasi firecracker godowns, traditional fire alarms fail because **by the time smoke or high heat is detected, black powder has already ignited**. 

Fire Guardian uses a **Two-Tier Cascaded AI Architecture**:
1. **Model 1 (M1 - Background Scorer):** Runs 24/7 independently in the background. Uses an **Unsupervised Isolation Forest** to detect slow, subtle pre-ignition anomalies (thermal trends, inside-outside humidity differential, gas drift) before any flame appears.
2. **Stage 1 Hotspot Rule (The Trigger):** Evaluated every cycle on raw telemetry (`thermal_max > 50°C` OR `rise_rate > 3°C/cycle`). When triggered, it invokes **Model 2**.
3. **Model 2 (M2 - Fire Confidence Classifier):** Executed when Stage 1 triggers. Uses a **Supervised Random Forest Classifier** fusing 11 multi-sensor features (including M1 risk context) to decide fire confidence (0–100%) and trigger targeted dry-powder suppression.

> ⚠️ **Key Architectural Insight for Presentation:**  
> **M1 does NOT trigger M2.** M1 runs independently to score background risk. M2 is triggered by **Stage 1's physical thermal rule**. This means M2 can be invoked **even if M1 is currently showing "Safe"** (e.g., in Scenario M2-4, where a sudden rapid thermal spike occurs before M1's rolling window detects sustained pre-ignition drift).

---

## 🧠 Section 1: Model 1 (M1) — Pre-Ignition Risk Scorer

### 1. Key Objective
To output a continuous **Risk Score (0–100)** and **Risk Tier** (`Safe`, `Moderate`, `Dangerous`) every 15 seconds per zone for background monitoring.

### 2. Feature Vector
- `zone_thermal_avg`: 8×8 AMG8833 IR thermal camera sub-grid average (°C, 3-frame smoothed)
- `zone_thermal_trend`: Rate of temperature rise over N cycles (°C/cycle)
- `humidity_inside`: DHT22 inside godown working area Relative Humidity (%)
- `humidity_outside`: DHT22 outside ambient reference Relative Humidity (%)
- `humidity_differential`: Key hygroscopic risk indicator (`humidity_inside - humidity_outside`)
- `mq2_level`: MQ-2 combustible gas baseline level per zone (PPM)
- `mq135_level`: MQ-135 VOC / air quality baseline level per zone (PPM)
- `gas_baseline_drift`: Cumulative drift from zone rolling mean (PPM)

### 3. Core Code Implementation (Short & Concise)

#### A. Isolation Forest Scoring (`backend/m1_scorer.py`)
```python
def compute_if_score(zone: str, features: dict) -> float:
    """Uses trained Isolation Forest model to score zone features."""
    model = _if_models.get(zone)
    feature_order = [
        "zone_thermal_avg", "zone_thermal_trend", 
        "humidity", "gas_level", "gas_baseline_drift"
    ]
    x = np.array([[features[k] for k in feature_order]])

    # score_samples returns raw negative anomaly score
    raw_score = float(model.score_samples(x)[0])

    # Map raw anomaly score to calibrated 0-100 risk score
    risk_score = np.clip(
        ((-raw_score - C.IF_THRESHOLD_OFFSET) / C.IF_SCALE_FACTOR) * 100,
        0.0, 100.0
    )
    return float(risk_score)
```

#### B. Zero-Downtime Rule-Based Fallback (`backend/m1_scorer.py`)
> *If the ML model file is missing or corrupted, the system silently falls back to a normalized weighted formula so the factory stays protected.*

```python
def compute_rule_based_score(features: dict) -> float:
    """Domain-weighted formula fallback."""
    norm_trend = normalize(features["zone_thermal_trend"], 0.0, 5.0)
    norm_hum   = normalize(1 / features["humidity"], 1/70, 1/34)
    norm_gas   = normalize(features["gas_baseline_drift"], 0.0, 60.0)

    # Weights: 40% Thermal Trend, 35% Low Humidity Risk, 25% Gas Drift
    raw = (0.40 * norm_trend + 0.35 * norm_hum + 0.25 * norm_gas) * 100
    return float(np.clip(raw, 0.0, 100.0))
```

#### C. Risk Tier Mapping
```python
def map_risk_tier(risk_score: float) -> str:
    if risk_score <= 39:   return "Safe"        # Green
    elif risk_score <= 69: return "Moderate"    # Amber
    else:                  return "Dangerous"   # Red
```

---

## ⚡ Section 2: Model 2 (M2) — Fire Confidence Fusion Classifier

### 1. Key Objective
To prevent false alarms (e.g. workers carrying tea, hot light bulbs) while being designed to maximize recall on confirmed fire events while minimizing false alarms on safe conditions — evaluated via recall, precision, and F1-score on the Fire class using 5-fold cross-validation on the labeled training dataset.

### 2. Stage 1 Trigger Condition (How M2 Gets Invoked)
M2 does **NOT** run continuously to save compute power. It is invoked **only when the Stage 1 rule flags a hotspot**:
```python
# Executed every cycle on incoming sensor readings
def check_stage1_hotspot(row: dict) -> bool:
    thermal_max = row.get("thermal_max") or 0.0
    thermal_trend = row.get("thermal_trend") or 0.0
    
    # Trigger M2 if temperature > 50°C OR rise rate > 3°C/cycle
    if thermal_max > 50.0 or thermal_trend > 3.0:
        run_m2_inference(row)
```

### 3. The 11-Feature Fusion Array
When M2 runs, it fuses data across 3 distinct domain vectors:
1. **Thermal Grid (4):** `thermal_max`, `thermal_rise_rate`, `zone_avg_temp`, `hotspot_pixel_count`
2. **Secondary Sensors (5):** `flame_reading`, `mq2_ppm`, `mq135_ppm`, `gas_roc`, `humidity_differential`
3. **M1 Context (3):** `m1_risk_score`, `m1_risk_tier_encoded`, `m1_trend_direction` *(Fetched from Supabase `risk_scores` history)*

### 4. Core Code Implementation (Short & Concise)

#### A. Multi-Sensor Fusion & Random Forest Prediction (`backend/m2_inference.py`)
```python
def run_m2_inference(event_data: Dict[str, Any]) -> Dict[str, Any]:
    # 1. Fetch latest M1 historical context for this zone
    m1_score, m1_tier, m1_trend_dir = fetch_m1_context(event_data["zone"])

    # 2. Assemble 11-Feature Vector
    features = np.array([[
        event_data["thermal_max"], event_data["thermal_rise_rate"],
        event_data["zone_avg_temp"], event_data["hotspot_pixel_count"],
        event_data["flame_reading"], event_data["gas_ppm"],
        event_data["gas_roc"], event_data["vibration"],
        m1_score, m1_tier, m1_trend_dir
    ]])

    # 3. Random Forest Classification
    features_scaled = _scaler.transform(features)
    probs = _model.predict_proba(features_scaled)[0]
    fire_confidence = round(float(probs[1] * 100.0), 1)

    # 4. Action Tiers
    if fire_confidence > 75.0:
        command = "evacuate"
        action_desc = "EVACUATION SIREN + POWER CUTOFF + TARGETED POWDER RELEASE"
    elif fire_confidence >= 40.0:
        command = "supervisor_alert"
        action_desc = "SUPERVISOR ACKNOWLEDGMENT REQUIRED"
    else:
        command = "log_only"
        action_desc = "LOGGED AS NON-FIRE DISTURBANCE"

    return {
        "confidence": fire_confidence,
        "command": command,
        "powder_zones": compute_powder_target_zones(event_data["zone"])
    }
```

#### B. Targeted Powder Release Logic (`backend/m2_inference.py`)
```python
def compute_powder_target_zones(fire_zone: str) -> List[str]:
    """
    Releases powder in fill zones EXCEPT the fire origin zone & exit path.
    Prevents blowing powder onto active flames while blanketing surrounding inventory.
    """
    all_zones = ["Zone_1_Fill", "Zone_2_Fill", "Zone_3_Fill", "Zone_4_Exit"]
    return [z for z in all_zones if z != fire_zone and z != "Zone_4_Exit"]
```

---

## 🧪 Section 3: The 7 Formal Test Scenarios (Report Chapter 10)

| Scenario ID | Name | Sensor Characteristics | M1 Tier | M2 Action & Containment |
|---|---|---|---|---|
| **M2-1** | Normal Operation | `temp=35°C`, no flame, normal gas | Safe | Not triggered |
| **M2-2** | Moderate Risk | `temp=42°C`, `humidity=38%`, gas drifting | Moderate | Not triggered |
| **M2-3** | High Risk (M1 Dangerous) | `temp=58°C`, `flame=0.41`, `gas=220`, `M1=76.5` | Dangerous | Evacuate (>75%) + Powder target |
| **M2-4** | High Risk (M1 Safe) | `temp=63°C`, `flame=0.61`, `gas=268`, `M1=19` | Safe | Evacuate (>75%) + Powder target |
| **M2-5** | Edge Triggered | `temp=71°C`, `flame=0.88`, `gas=340` | Dangerous | Edge acts immediately; M2 confirms |
| **M2-6** | Zone_4_Exit Hotspot | `temp=52°C` in exit zone | N/A | Supervisor alert only; NO powder release |
| **M2-7** | Boundary Case | Two fill zones above 50°C threshold | Dangerous | Deploy powder in unaffected zone only |

---

## 📢 Presentation Pitching & Defense Q&A

### Q1: Does M1 trigger M2?
> **Answer:** **No.** M1 runs independently in the background to calculate ambient pre-ignition risk. M2 is triggered by the **Stage 1 thermal rule** (`thermal_max > 50°C` or `rise_rate > 3°C/cycle`). M2 then fetches M1's score as historical context to include in its 11-feature fusion matrix.

### Q2: Can M2 trigger when M1 shows "Safe"?
> **Answer:** **Yes!** (e.g. Scenario M2-4). If a sudden external spark or localized thermal flare occurs rapidly, Stage 1 will immediately invoke M2. Even if M1's rolling window previously scored the zone as "Safe" (e.g. 15/100), M2 fuses the flame sensor, gas ROC, and thermal max to output high fire confidence and command suppression.

### Q3: Why use Isolation Forest for M1 instead of simple temperature thresholds?
> **Answer:** Sivakasi ambient temperatures routinely hit 38–42°C in summer. Simple threshold alarms trigger constant false alarms. Isolation Forest looks at multi-variable anomaly structures (rising trend + dropping humidity + gas drift) to catch pre-ignition conditions before heat exceeds ambient thresholds.

### Q4: What happens if Cloud Internet connection drops during a fire?
> **Answer:** **Hardware Edge Fail-Safe.** The ESP32 micro-controller runs a local C++ trip loop on-chip (`firmware/esp32_full_hardware_system.ino`). If `thermal_max > 65°C` AND `flame_reading > 0.70` AND `gas_ppm > 280`, the ESP32 directly trips Solenoid Relay & Power Cutoff autonomously without waiting for cloud backend.

### Q5: How is M2's accuracy evaluated?
> **Answer:** M2's performance is measured using recall on the Fire class as the primary metric — missing a real fire is the costliest possible error. We also report precision, F1-score, and false alarm rate on the Safe class. These are computed via 5-fold cross-validation. No fixed accuracy percentage is claimed because M2 is trained on controlled simulated fire-event data — its real-world performance is validated through structured test scenarios, not a single headline number.

---

## 🌐 Section 4: System Integration Overview

```
[ ESP32 Edge Node ] ──(HTTP POST every cycle)──► [ Supabase Database ]
  • AMG8833 (8x8 IR Array)                         ├─ sensor_readings
  • Dual DHT22 (Inside/Outside)                    ├─ risk_scores
  • 3x MQ-2, 3x MQ-135, 3x Flame                   ├─ fire_events
  • 3x Servos (Powder Hoppers)                     └─ commands_log
  • Dual Relays (Fan + Power Cutoff)                         │
                                                    (Realtime WebSocket)
                                                             ▼
                                                    [ FastAPI Backend ]
                                                    ├─ M1: Isolation Forest (0-100 score)
                                                    ├─ Stage 1 Hotspot Check (>50°C)
                                                    └─ M2: Random Forest (11-feature fusion)
                                                             │
                                                    (Realtime State Push)
                                                             ▼
                                                    [ React Live Dashboard ]
```

---
*Created for Fire Guardian Project Presentation, Code Defense & System Demo.*
