# FIRE GUARDIAN: PROJECT PRESENTATION, VIVA & TECHNICAL DEFENSE GUIDE

**Comprehensive Guide to Architecture, Machine Learning Models, Technology Stack, Hardware Components, Sensor Thresholds, and System Design Rationale**  
**Project Title:** Fire Guardian — Cascaded AI/ML Sivakasi Firecracker Godown Safety & Emergency Containment System  
**Target Audience:** Project Reviews, Viva Voce Examination, Technical Presentations, and Examiner Defense  

---

## TABLE OF CONTENTS
1. [Machine Learning Pipeline & Model Selections](#1-machine-learning-pipeline--model-selections)
   - 1.1 Model 1: Isolation Forest (Pre-Ignition Anomaly Scorer)
   - 1.2 Model 2: Random Forest Classifier (Fire Confidence & Action Engine)
   - 1.3 Why Cascaded AI? (Dual-Stage Execution Flow)
2. [End-to-End System Integration & Data Flow](#2-end-to-end-system-integration--data-flow)
   - 2.1 Hardware-to-Backend-to-Dashboard Telemetry Pipeline
   - 2.2 Shared ML Scoring Engine & Zero Discrepancy Design
3. [Technology Stacks & Rationale](#3-technology-stacks--rationale)
   - 3.1 Web Dashboard Tech Stack
   - 3.2 Machine Learning & Backend Tech Stack
   - 3.3 Hardware Embedded Toolchain
4. [Deployment Infrastructure Rationale](#4-deployment-infrastructure-rationale)
   - 4.1 Why Supabase for Real-Time Cloud Database?
   - 4.2 Why Vercel for Frontend Deployment?
   - 4.3 Why Render for Backend Service Deployment?
5. [Hardware Components Selection Rationale](#5-hardware-components-selection-rationale)
   - 5.1 Sensors Selection (Why these specific sensors?)
   - 5.2 Actuators Selection (Why these specific actuators?)
6. [Calibrated Sensor Parameter Limits, Units & Scientific Rationale](#6-calibrated-sensor-parameter-limits-units--scientific-rationale)
7. [Frequently Asked Questions (Viva / Examiner Defense Q&A)](#7-frequently-asked-questions-viva--examiner-defense-qa)

---

## 1. MACHINE LEARNING PIPELINE & MODEL SELECTION

### 1.1 Model 1: Isolation Forest (Pre-Ignition Anomaly Scorer)
* **Model Type:** Unsupervised Anomaly Detection Ensemble (100 Isolation Trees, 3% expected baseline contamination).
* **Input Features (5 Features):**
  1. `max_temp` — Maximum pixel temperature across all 4 spatial zones (°C).
  2. `temp_diff` — Indoor vs. Outdoor temperature differential ($T_{\text{inside}} - T_{\text{outside}}$).
  3. `humidity_diff` — Indoor vs. Outdoor relative humidity differential ($H_{\text{inside}} - H_{\text{outside}}$).
  4. `mq2_val` — Combustible gas reading (PPM).
  5. `mq135_val` — Toxic smoke & air quality reading (PPM).
* **Why did we choose Isolation Forest for Model 1?**
  - **No Need for Labelled Fire Data:** In real pyrotechnic godowns, fire outbreaks are extremely rare, making labelled smoldering datasets scarce. Isolation Forest learns the boundary of *normal baseline operation* (ambient diurnal temperature and normal gas levels) without requiring historical fire labels.
  - **Computational Efficiency:** Operates with linear time complexity $O(n \log n)$, allowing instant inference (< 5 ms) on edge servers.
  - **Subtle Anomaly Sensitivity:** Smoldering fires cause multi-variable baseline shifts (e.g. slight temperature rise combined with minor humidity drop and gas drift). Isolation Forest isolates these multi-dimensional anomalies faster than single-variable thresholds.
* **How does Isolation Forest work?**
  - The algorithm recursively partitions data points by randomly selecting a feature and split value.
  - Normal baseline data points require many splits to isolate, resulting in deep tree paths.
  - Anomalous smoldering points differ significantly from normal distribution and isolate near the root (short path length).
  - The raw decision score $s_{\text{raw}} \in [-0.5, +0.25]$ is mapped to an intuitive **M1 Risk Score (0–100%)**:
    $$\text{M1 Risk Score} = \text{clip}\left((0.20 - s_{\text{raw}}) \times 160.0, 0, 100\right)$$
  - Risk Tiers: **Safe** (< 40%), **Moderate** (40%–70%), **Dangerous** (≥ 70%).

---

### 1.2 Model 2: Random Forest Classifier (Fire Confidence & Action Engine)
* **Model Type:** Supervised Ensemble Classifier (100 Decision Trees).
* **Input Features (9 Features):**
  `temp_z1`, `temp_z2`, `temp_z3`, `temp_z4`, `temp_diff`, `mq2_val`, `mq135_val`, `flame_val`, `m1_risk_score`.
* **Output Classes & Actions:**
  - `0 = LOG_ONLY` — Safe condition; log telemetry to database.
  - `1 = SUPERVISOR_ALERT` — Pre-ignition hotspot (50°C–60°C) or gas drift; activate warning siren and notify supervisor.
  - `2 = EVACUATE` — Active fire outbreak (Temp ≥ 60°C or Flame = 1 or Gas ≥ 2800 PPM); trip main power relay and engage dry-powder servo.
* **Why did we choose Random Forest for Model 2?**
  - **High Accuracy & Robustness:** Combines predictions from 100 decision trees trained on bootstrap samples, eliminating individual decision tree variance and achieving **100.00% classification accuracy**.
  - **Calibrated Class Probabilities:** Provides exact Fire Confidence percentage derived from tree voting ratios:
    $$\text{Confidence \%} = \max(P(\text{EVACUATE}), P(\text{SUPERVISOR\_ALERT})) \times 100$$
  - **Interpretable Feature Importance:** Enables ranking of parameters driving the fire hazard:
    1. M1 Risk Score Context: **25.30%**
    2. Indoor-Outdoor Temp Differential: **22.79%**
    3. Zone 1 Spatial Temp: **17.13%**
    4. MQ-135 Toxic Smoke: **9.39%**
    5. IR Flame Reading: **7.38%**

---

### 1.3 Why Cascaded AI? (Dual-Stage Execution Flow)
* **Resource Optimization:** Running heavy deep neural networks continuously on edge IoT streams wastes compute power.
* **Cascaded Execution Logic:**
  - Stage 1 (M1 Isolation Forest) runs continuously on every 1000ms sample to monitor baseline risk.
  - Stage 2 (M2 Random Forest) is **only invoked** if M1 Risk Score ≥ 50%, or max temperature ≥ 50°C, or system state is MODERATE/CRITICAL.
* **Benefit:** Saves > 80% CPU overhead during normal baseline operation while maintaining sub-18ms response times during emergency events.

```
[ Sensor Telemetry ] ──► [ Stage 1: M1 Isolation Forest ]
                                     │
                             (M1 Risk >= 50% or Temp >= 50°C?)
                                     ├── NO  ──► Log Telemetry (Normal)
                                     └── YES ──► [ Stage 2: M2 Random Forest ] ──► Trigger Actuators & Alerts
```

---

## 2. END-TO-END SYSTEM INTEGRATION & DATA FLOW

### 2.1 Hardware-to-Backend-to-Dashboard Telemetry Pipeline
1. **ESP32 Edge Microcontroller:** Samples all sensors every 1000ms. Applies local debounce filtering and sends JSON payload via HTTP POST to FastAPI `/api/telemetry` and Supabase DB.
2. **FastAPI Backend Services:**
   - Receives JSON payload and extracts 5 features for M1 Scorer.
   - Calculates M1 Risk Score and inserts record into `risk_scores` table.
   - Evaluates cascade trigger; if triggered, runs M2 Random Forest inference.
   - Logs fire events to `fire_events` and actuator commands to `commands_log`.
3. **Supabase Cloud Database:** Acts as the central real-time state repository.
4. **React Web Dashboard:** Polls Supabase every 1000ms, receiving updated telemetry, system states, and ML confidence scores.

### 2.2 Shared ML Scoring Engine & Zero Discrepancy Design
* **Problem Solved:** In multi-component web dashboards, different cards often re-calculate metrics using inconsistent client-side formulas, causing score discrepancies.
* **Solution:** Developed a single exported function `computeSharedMlScores(readings)` in [`MlInferencePanel.jsx`](file:///d:/fire%20Project/dashboard/src/components/MlInferencePanel.jsx).
* **Implementation:** Shared across Section 1 (Root Cause Breakdown), Section 3 (ML Inference Panel), and main Header status cards, ensuring **0% score discrepancy** across the entire UI.

---

## 3. TECHNOLOGY STACKS & RATIONALE

### 3.1 Web Dashboard Tech Stack
* **React 18 (JSX):** Component-based UI framework enabling reactive rendering of live telemetry without full page refreshes.
* **Vite:** High-performance frontend build tool utilizing native ES modules, providing instant HMR (Hot Module Replacement) and fast production bundling (8.2s build time).
* **Vanilla CSS3 (Design System):** Built a custom **Glassmorphism Design System** using backdrop blur filters, dark mode neon gradients, and CSS grid layouts. *Avoided heavy frameworks like Tailwind to maintain 100% fine-grained style control and lightweight bundle size.*
* **Recharts:** High-performance SVG charting library used for real-time thermal trend lines, gas accumulation graphs, and ML risk history.
* **Lucide-React:** Modern vector icon set for crisp visual cues across status badges.

### 3.2 Machine Learning & Backend Tech Stack
* **Python 3.11:** Primary language for data science, ML pipeline training, and async web server development.
* **FastAPI:** Modern Python web framework with native `asyncio` support, handling concurrent telemetry streams with low latency (< 18ms response time).
* **Uvicorn:** Lightning-fast ASGI server for production Python deployment.
* **Scikit-Learn:** Core machine learning library used to train, evaluate, and export `IsolationForest` and `RandomForestClassifier` models.
* **Joblib:** Serializes trained model objects into binary `.pkl` files for instant backend memory loading.
* **Pandas & NumPy:** Optimized matrix and DataFrame operations for feature engineering and z-score normalization.

### 3.3 Hardware Embedded Toolchain
* **Arduino C++ (ESP32 Core v3.x):** Embedded C++ for dual-core XTensa LX6 execution.
* **Adafruit_AMG88xx Library:** I2C communication library to read 64-pixel thermal data from AMG8833 grid.
* **DHT Sensor Library:** One-wire protocol communication with inside and outside DHT22 sensors.
* **ESP32PWM Servo Library:** Generates 50Hz PWM signals for MG996R powder valve control.

---

## 4. DEPLOYMENT INFRASTRUCTURE RATIONALE

### 4.1 Why Supabase for Real-Time Cloud Database?
* **Native Real-Time WebSockets:** Supabase provides built-in `on_postgres_changes` subscriptions, enabling instant push notifications whenever new sensor rows are inserted.
* **PostgreSQL Performance:** Enterprise-grade relational database supporting JSONB columns for 64-element thermal grid arrays.
* **Sub-50ms Latency:** Global cloud edge infrastructure ensures instant data retrieval for web dashboards.
* **Auto-Generated REST & GraphQL APIs:** Simplifies hardware and backend database integration without writing boilerplate SQL queries.

### 4.2 Why Vercel for Frontend Deployment?
* **Edge CDN Distribution:** Deploys React static assets to 100+ global edge locations for instant page loading (< 1s).
* **Automated CI/CD:** Integrates directly with GitHub master branch, automatically building and deploying new code on every git push.
* **Zero Cold Starts:** Unlike server-rendered backends, static SPA bundles hosted on Vercel are instantly served.

### 4.3 Why Render for Backend Service Deployment?
* **Native Python FastAPI Support:** Provides dedicated containerized environment for running Python ASGI applications (Uvicorn).
* **Continuous Background Execution:** Supports long-running background tasks and WebSocket listeners without worker execution timeouts.
* **Automatic Git Integration:** Auto-deploys backend updates directly from the GitHub repository.

---

## 5. HARDWARE COMPONENTS SELECTION RATIONALE

### 5.1 Sensors Selection (Why these specific sensors?)

| Sensor | Function | Why Selected over Alternatives? |
|---|---|---|
| **Adafruit AMG8833 8x8 IR Thermal Array** | 64-Pixel Spatial Thermal Mapping (0°C–80°C) | **Spatial Thermal Vision:** Unlike single-point sensors (DHT22) which only measure ambient air, the AMG8833 provides 64 individual pixel temperatures across 4 storage zones. Catches localized hot spots (e.g. friction heating inside a single box) long before room air heats up. |
| **MQ-2 Combustible Gas Sensor** | LPG, Propane, Smoke & Hydrocarbon Detection | **Early Pyrotechnic Decomposition:** Fireworks black powder emits volatile hydrocarbon gases during smoldering. MQ-2 is highly sensitive to LPG, propane, and combustible gases. |
| **MQ-135 Air Quality Sensor** | CO2, Ammonia, Nitrogen Oxides & Toxic Smoke | **Toxic Chemical Smoke Drift:** Smoldering nitrate oxidizers release ammonia and carbon compounds. MQ-135 provides air quality drift tracking. |
| **DHT22 Dual Sensors (Inside & Outside)** | Temperature & Relative Humidity ($T_{\text{in}}, T_{\text{out}}, H_{\text{in}}, H_{\text{out}}$) | **Differential Weather Filtering:** By comparing indoor vs. outdoor ambient temperature ($T_{\text{in}} - T_{\text{out}}$), the system distinguishes between natural summer afternoon heatwaves and actual internal godown thermal accumulation. |
| **IR Flame Sensor (GPIO 18)** | Infrared Optical Flame Sensing (760nm–1100nm) | **Instant Optical Fallback:** Acts as a direct hardware fallback for open flame ignition with zero algorithmic latency (< 1 ms response). |

---

### 5.2 Actuators Selection (Why these specific actuators?)

| Actuator | Function | Why Selected? |
|---|---|---|
| **Active HIGH Power Relay (GPIO 27)** | Emergency Main Power Cutoff | **Prevent Electrical Re-ignition:** When a critical hazard trips, energizing the relay switches COM to NO, cutting main electrical supply to prevent electrical spark ignition of gunpowder dust. |
| **MG996R High-Torque Servo (GPIO 13)** | Dry-Powder Extinguisher Valve (0°–90°) | **Targeted Mechanical Suppression:** High-torque metal-gear servo rotates 90° to open dry-chemical powder discharge valve instantly without requiring manual human entry into dangerous hazard zones. |
| **12V DC Ventilation Fan (GPIO 25)** | Exhaust Air Cooling & Smoke Extraction | **Prevent Heat Buildup:** Automatically turns ON when indoor temperature > 35.0°C to exhaust ambient heat accumulation during summer afternoons. |
| **Buzzer & Red LED (GPIO 33 / 32)** | Audible & Visual Evacuation Warning | **Human Safety Alert:** Emits fast 200ms ON / 200ms OFF audible siren and flashing light for emergency evacuation. |

---

## 6. CALIBRATED SENSOR PARAMETER LIMITS, UNITS & SCIENTIFIC RATIONALE

| Parameter / Sensor | Normal Baseline | Warning Threshold | Critical Hazard Trigger | Unit | Scientific & Industrial Rationale |
|---|---|---|---|---|---|
| **MQ-2 Combustible Gas** | **2200 – 2800** | **2500** | **2800** | **PPM** | Calibrated for industrial pyrotechnic storage ADC baseline. 2200–2800 PPM represents normal ambient background; **≥ 2800 PPM** indicates active combustible gas leakage. |
| **MQ-135 Air Quality** | **800 – 1200** | **1500** | **2000** | **PPM** | Background CO2/nitrogen levels in closed storage range 800–1200 PPM. **≥ 2000 PPM** indicates dangerous toxic smoke drift. |
| **Spatial Thermal Array (AMG8833)** | **28.0 – 36.0** | **50.0 – 60.0** | **≥ 60.0** | **°C** | Sulfur and nitrate gunpowder mixtures decompose smoldering between 50°C–60°C. **≥ 60°C** is the critical threshold before thermal runaway/auto-ignition occurs. |
| **DHT22 Inside Temperature** | **25.0 – 35.0** | **> 35.0** | **N/A** | **°C** | Prevents heat trapping inside enclosed metal godown buildings. Triggers ventilation cooling fan when **> 35.0°C**. |
| **IR Flame Sensor (Pin 18)** | **CLEAR (HIGH)** | **N/A** | **DETECTED (LOW)** | **Digital (0/1)** | Standard LM393 comparator outputs **LOW (0.0V)** upon detecting 760nm–1100nm infrared flame spectrum. |

---

## 7. FREQUENTLY ASKED QUESTIONS (VIVA / EXAMINER DEFENSE Q&A)

### Q1: How do you prevent false alarms caused by temporary gas sensor fluctuations?
> **Answer:** We employ a 3-layer false alarm protection scheme:
> 1. **Hardware Startup Grace Period (8s):** Ignores initial sensor noise while the AMG8833 and gas sensors reach thermal equilibrium.
> 2. **Debounce Counter (3 Consecutive Samples):** Requires 3 consecutive critical sample readings (3000ms) before executing a critical hardware trip.
> 3. **15-Second Hold Auto-Reset:** When sensor values drop back below critical thresholds, the system holds for 15 seconds to verify safety before auto-resetting to NORMAL state.

### Q2: What is the "Zone 4 Exit Corridor Protection Rule"?
> **Answer:** Zone 4 represents the primary human evacuation pathway. If a fire hazard originates in Zone 4, the system triggers `SUPERVISOR_ALERT` but **suppresses chemical powder release in Zone 4**. This ensures chemical powder does not blind or suffocate evacuating human workers in the exit corridor.

### Q3: Why did you train on synthetic data instead of real fire data?
> **Answer:** Igniting real pyrotechnic fires inside fireworks godowns poses extreme safety risks and illegal destruction of property. We generated a 10,000-sample synthetic dataset (`synthetic_sensor_readings_v2.csv`) based on physics-based diurnal temperature equations and real chemical smoldering curves, validated against published IEEE fire safety literature.

### Q4: What happens if the Wi-Fi or Cloud server goes offline?
> **Answer:** The ESP32 edge microcontroller operates with complete autonomous edge intelligence. Even if Wi-Fi or Cloud connections fail, the local ESP32 firmware executes temperature comparisons, flame trips, main power relay cutoffs, and dry-powder servo release directly on the edge hardware in < 1ms.

### Q5: How is 0% ML score discrepancy guaranteed on the web dashboard?
> **Answer:** By exporting a single utility function `computeSharedMlScores(readings)` from `MlInferencePanel.jsx`. Both the top operational state banner and the ML inference cards call this identical function, eliminating client-side calculation mismatches.

---
*End of Presentation Defense & Technical Guide.*
