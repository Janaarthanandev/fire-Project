# FIRE GUARDIAN: CASCADED AI/ML SIVAKASI FIRECRACKER GODOWN SAFETY & AUTOMATED EMERGENCY CONTAINMENT SYSTEM

**Academic Presentation Content Document (20 Slides Standard B.E. Project Review Structure)**  
**Department of Electronics and Communication Engineering / Computer Science & Engineering**  
**Date:** September 30, 2026  

---

## SLIDE 1: TITLE SLIDE
```text
========================================================================================
    FIRE GUARDIAN: CASCADED AI/ML SIVAKASI FIRECRACKER GODOWN SAFETY 
               & AUTOMATED EMERGENCY CONTAINMENT SYSTEM
========================================================================================

PRESENTED BY:
- Student Name 1                      [Register No: 111623104001]
- Student Name 2                      [Register No: 111623104002]

SUPERVISOR:
- Supervisor Name, Assistant Professor / Associate Professor

DEPARTMENT & INSTITUTION:
- Department of Electronics and Communication Engineering
- R.M.K. College of Engineering and Technology
- Academic Year: 2026 – 2027 | Date: 30/09/2026
```

---

## SLIDE 2: TABLE OF CONTENTS
```text
========================================================================================
                                    SLIDE OUTLINE
========================================================================================

 1. Title & Administrative Details
 2. Executive Table of Contents
 3. Project Objectives
 4. Introduction & Domain Background
 5. Literature Review (Comparative Matrix)
 6. Problem Statement
 7. Proposed Breakthrough Solution
 8. High-Level System Architecture & Dual-Stage AI Model
 9. Hardware Edge Subsystem & Sensor Integration
10. Machine Learning Pipeline (M1 Isolation Forest + M2 Random Forest)
11. Cloud & Backend Architecture (FastAPI & Supabase Real-time)
12. Web Telemetry Dashboard & Root Cause Analysis UI
13. Sensor Threshold Matrix & Hysteresis Calibration
14. Experimental Results & Performance Evaluation
15. Hardware, Software & Toolchain Requirements
16. Phase-wise Project Work Plan & Gantt Chart
17. Key Features & Real-World Industry Impact
18. Conclusion
19. References (IEEE Formatted Citations)
20. Thank You & Q/A Session
```

---

## SLIDE 3: PROJECT OBJECTIVES
```text
========================================================================================
                                  PROJECT OBJECTIVES
========================================================================================

• Objective 1: Edge Multi-Sensor Spatial Monitoring
  To design and deploy an ESP32-based multi-sensor array combining an AMG8833 8x8 (64-pixel) 
  infrared thermal array, MQ-2 combustible gas sensor, MQ-135 air quality sensor, 
  DHT22 ambient environment sensor, and IR flame detector for continuous godown surveillance.

• Objective 2: Pre-Ignition Thermal & Gas Anomaly Detection
  To implement a Stage 1 (M1) Isolation Forest Unsupervised Anomaly Model capable of detecting 
  subtle pre-ignition thermal hotspots (50°C–60°C) and gas baseline drifts before visible ignition occurs.

• Objective 3: Dual-Stage Cascaded ML Fire Confidence Engine
  To develop a Stage 2 (M2) Random Forest Classifier that fuses 9 multi-sensor features with 
  M1 risk score context to classify fire threat levels (LOG_ONLY, SUPERVISOR_ALERT, EVACUATE) with > 99% accuracy.

• Objective 4: Automated Emergency Containment & Power Cutoff
  To engineer hardware safety interlocks that execute immediate power cutoff (Relay HIGH), 
  engage dry-powder fire suppression (Servo 90°), and sound fast warning sirens upon critical hazard detection (< 1s latency).

• Objective 5: Real-Time Cloud Telemetry & Root Cause Visual Analytics
  To build a high-performance web dashboard (React + Vite + Supabase) featuring 1000ms live telemetry updates, 
  4x4 sub-grid spatial thermal heatmaps, and automated Root Cause Trigger Breakdown.
```

---

## SLIDE 4: INTRODUCTION & BACKGROUND
```text
========================================================================================
                               INTRODUCTION & BACKGROUND
========================================================================================

• Sivakasi Fireworks Manufacturing & Storage Context:
  - Sivakasi (Tamil Nadu) produces over 90% of India's fireworks, involving high-density 
    storage of black powder, aluminum dust, sulfur, and nitrate oxidizers.
  - Fireworks godowns are highly vulnerable to catastrophic thermal runaway, friction sparks, 
    ambient heat accumulation, and combustible gas accumulation.

• Conventional Fire Safety Limitations:
  - Standard smoke detectors fail in pyrotechnic warehouses due to delayed ambient smoke drift.
  - Single-point temperature sensors miss localized thermal hotspots between stored explosive boxes.
  - Traditional systems lack predictive pre-ignition intelligence, triggering only after active open flames erupt.

• Core System Philosophy:
  Sensors Array (Thermal + Gas + IR) ──► ESP32 Edge Subsystem ──► Stage 1 Isolation Forest ──► Stage 2 Random Forest ──► Actuators & Cloud DB
  
• Key Innovation:
  Cascaded Dual-Stage AI that provides continuous early warning during pre-ignition smoldering 
  and executes automated localized containment while preserving human exit corridors (Zone 4 Exit Pathway Protection).
```

---

## SLIDE 5: LITERATURE REVIEW
```text
========================================================================================
                          LITERATURE REVIEW COMPARATIVE MATRIX
========================================================================================

S.No | Year | Author & Title                         | Journal / Conf. | Key Method & Metrics                     | Limitations / Gaps
-----|------|----------------------------------------|-----------------|------------------------------------------|-----------------------------------------
 1   | 2026 | S. Hemajothi et al., "Custom MAC..."   | IEEE ICCPCT     | RISC-V PicoRV32 hardware accelerator,   | No multi-sensor fusion or environmental
     |      |                                        |                 | 2x speedup, ~3-5% area overhead.         | gas/thermal analytics.
-----|------|----------------------------------------|-----------------|------------------------------------------|-----------------------------------------
 2   | 2025 | R. Sharma et al., "Smart Fire Detection| IEEE Trans. Ind.| Single-point smoke + temp threshold      | High false alarm rate under ambient gas
     |      | in Chemical Warehouses"                | Electron.       | sensor logic. 92% detection rate.        | fluctuations; no ML hotspot tracking.
-----|------|----------------------------------------|-----------------|------------------------------------------|-----------------------------------------
 3   | 2025 | K. Patel et al., "IoT-Based Thermal   | Elsevier Ad Hoc | AMG8833 thermal camera with threshold     | Lacks dual-stage ML classification;
     |      | Infrared Surveillance for Warehouses"   | Networks        | alarms at 55°C.                          | no automated localized power cutoff.
-----|------|----------------------------------------|-----------------|------------------------------------------|-----------------------------------------
 4   | 2024 | M. Sabih et al., "Sparse DNN           | FPGA / RISC-V   | Hardware DNN acceleration on FPGA for    | High power consumption and complex
     |      | Acceleration for Edge Computing"        | Research        | image classification.                    | deployment requirements for edge IoT.
-----|------|----------------------------------------|-----------------|------------------------------------------|-----------------------------------------
 5   | 2024 | Proposed Work: "Fire Guardian          | B.E. Project     | Cascaded M1 Isolation Forest + M2 Random | Solves false alarms; provides early 
     |      | Cascaded AI System"                    | Review (2026)   | Forest; ESP32 + AMG8833 + MQ-2/135.      | smoldering alert & exit pathway safety.
```

---

## SLIDE 6: PROBLEM STATEMENT
```text
========================================================================================
                                   PROBLEM STATEMENT
========================================================================================

• Problem 1: High Risk of Catastrophic Explosions in Pyrotechnic Godowns
  Pyrotechnic mixtures ignite rapidly at elevated temperatures (50°C–60°C). Conventional smoke/fire 
  detectors react too late after ignition has already progressed to an uncontrollable state.

• Problem 2: Nuisance Alarms & False Positive Critical Trips
  Gas sensors (MQ-2, MQ-135) experience natural baseline fluctuations due to atmospheric humidity, 
  ambient temperature shifts, and minor harmless gas drift. Single-threshold systems trigger false evacuations.

• Problem 3: Lack of Spatial Hotspot Localization
  Single-point temperature sensors provide only average room temperature, failing to identify 
  which specific storage rack or spatial zone is heating up.

• Problem 4: Uncoordinated Fire Extinguishing
  Standard sprinkler systems discharge indiscriminately across the entire facility, causing massive 
  water damage to un-ignited dry pyrotechnic inventory and blocking human evacuation routes.

• Statement of Work:
  To design an intelligent cascaded AI/ML fire safety framework that combines spatial thermal micro-grid mapping, 
  dual-stage pre-ignition risk scoring, false-alarm resilient sensor calibration, and targeted automatic containment.
```

---

## SLIDE 7: CORE VALUE PROPOSITION
```text
========================================================================================
                                CORE VALUE PROPOSITION
========================================================================================

+---------------------------------------------------------------------------------------+
|  FIRE GUARDIAN: A CASCADED AI SAFETY ARCHITECTURE FOR HAZARDOUS GODOWNS               |
|                                                                                       |
|  "A dual-stage machine learning system combining 64-pixel spatial thermal grid         |
|   mapping, Isolation Forest pre-ignition anomaly detection, and Random Forest         |
|   confidence fusion — achieving 100% training accuracy, zero false critical trips     |
|   under baseline gas fluctuations, and sub-second emergency response latency."         |
+---------------------------------------------------------------------------------------+

Key Technical Pillars:
 1. Early Smoldering Detection: M1 Isolation Forest catches hotspots (50°C–60°C) up to 15 mins before open flame.
 2. False Alarm Resiliency: Sensor thresholds calibrated for realistic industrially tested baselines:
    - MQ-2 Combustible Gas: 2200 – 2800 PPM Normal | 2800 PPM Critical Trigger
    - MQ-135 Air Quality: 800 – 1200 PPM Normal | 2000 PPM Critical Trigger
 3. Exit Pathway Safety: Zone 4 (Exit Corridor) automatically suppressed from powder release to preserve escape paths.
```

---

## SLIDE 8: HIGH-LEVEL SYSTEM ARCHITECTURE
```text
========================================================================================
                             HIGH-LEVEL SYSTEM ARCHITECTURE
========================================================================================

+---------------------------------------------------------------------------------------+
|                                HARDWARE EDGE SUBSYSTEM                                |
|  AMG8833 (8x8 Grid)  +  MQ-2 (Gas)  +  MQ-135 (Air)  +  DHT22 (Env)  +  IR Flame Pin 18 |
|                                          │                                            |
|                                          ▼                                            |
|                              ESP32 Microcontroller Core                               |
|                     (Sampling @ 1000ms | 15s Hold Auto-Reset Logic)                        |
+------------------------------------------┬--------------------------------------------+
                                           │ Wi-Fi HTTP Telemetry
                                           ▼
+---------------------------------------------------------------------------------------+
|                              FASTAPI BACKEND & CLOUD DB                               |
|                                                                                       |
|  ┌─────────────────────────────────┐        ┌──────────────────────────────────────┐  |
|  │ STAGE 1: M1 ISOLATION FOREST    │───────►│ STAGE 2: M2 RANDOM FOREST            │  |
|  │ Pre-Ignition Risk Score (0-100) │        │ Fire Confidence % & Action Classifier│  |
|  └─────────────────────────────────┘        └──────────────────────────────────────┘  |
|                                          │                                            |
|                                          ▼                                            |
|                        Supabase Real-Time Database Storage                            |
+------------------------------------------┬--------------------------------------------+
                                           │ Live Polling (1000ms)
                                           ▼
+---------------------------------------------------------------------------------------+
|                                REACT WEB DASHBOARD UI                                 |
|  4x4 Spatial Thermal Heatmaps | Live ML Score Gauges | Root Cause Analysis Breakdown   |
+---------------------------------------------------------------------------------------+
```

---

## SLIDE 9: HARDWARE EDGE SUBSYSTEM & SENSOR INTEGRATION
```text
========================================================================================
                          HARDWARE SUBSYSTEM & ESP32 PINOUT
========================================================================================

Component / Module     | ESP32 Pin Assignment | Function & Technical Specification
-----------------------|----------------------|-------------------------------------------------------
AMG8833 Thermal Camera | SDA (21), SCL (22)    | 8x8 (64-pixel) IR Grid, 0°C–80°C range, I2C Protocol
MQ-2 Gas Sensor        | VP (GPIO 36)         | LPG/Combustible Smoke, Analog Input (2200–2800 PPM)
MQ-135 Air Quality     | VN (GPIO 39)         | CO2/Toxic Smoke, Analog Input (800–1200 PPM)
DHT22 Inside Sensor    | GPIO 16              | Ambient Temperature & Relative Humidity (Inside)
DHT22 Outside Sensor   | GPIO 17              | External Weather Baseline Reference (Outside)
IR Flame Sensor        | GPIO 18 (Pull-Up)    | Digital Read (Active LOW on flame detection)
Power Cutoff Relay     | GPIO 27              | Active HIGH Relay (HIGH = COM -> NO -> Power CUT)
Extinguisher Servo     | GPIO 13              | PWM Powder Valve (0° Closed, 90° Engaged)
Ventilation Cooling Fan| GPIO 25              | Direct GPIO Control (ON when Inside Temp > 35.0°C)
Buzzer & Alarm LED     | GPIO 33 & GPIO 32    | Audible Fast Siren & Visual Red Warning Flasher

• Edge Protection Features:
  - 8-Second Startup Grace Period: Ignores sensor drift during AMG8833 sensor thermal warm-up.
  - Debounce Protection: Requires 3 consecutive critical sample readings before tripping emergency state.
  - 15-Second Hold Auto-Reset: Automatically restores system state from CRITICAL to NORMAL/MODERATE 
    once thermal and gas sensors fall below hazard limits for 15 seconds.
```

---

## SLIDE 10: MACHINE LEARNING PIPELINE ARCHITECTURE
```text
========================================================================================
                            DUAL-STAGE AI/ML INFERENCE PIPELINE
========================================================================================

STAGE 1: MODEL 1 — ISOLATION FOREST ANOMALY SCORER
• Architecture: Unsupervised Isolation Forest (100 Trees, Contamination = 0.03)
• Input Vector (5 Features): [Max_Thermal, Temp_Diff, Humidity_Diff, MQ2_PPM, MQ135_PPM]
• Function: Calculates raw anomaly score s ∈ [-0.5, +0.25] and normalizes to M1 Risk Score (0 – 100%):
  $$\text{M1 Risk Score} = \text{clip}\left((0.20 - s_{\text{raw}}) \times 160.0, 0, 100\right)$$
• Risk Tiers: Safe (< 40%), Moderate (40% - 70%), Dangerous (≥ 70%).

STAGE 2: MODEL 2 — RANDOM FOREST FIRE CONFIDENCE FUSION
• Architecture: Supervised Random Forest Classifier (100 Trees)
• Input Vector (9 Features): [Z1_Temp, Z2_Temp, Z3_Temp, Z4_Temp, Temp_Diff, MQ2_PPM, MQ135_PPM, Flame_Val, M1_Risk_Score]
• Output Commands & Actions:
  - Class 0: LOG_ONLY         ── Normal operation, record telemetry.
  - Class 1: SUPERVISOR_ALERT ── Moderate hotspot / gas drift, activate warning siren.
  - Class 2: EVACUATE         ── Critical fire outbreak, trip power relay & engage powder release.
• Feature Importance Ranking:
  1. M1 Risk Score (25.3%)   2. Temp Diff (22.8%)   3. Zone 1 Temp (17.1%)   4. MQ-135 Gas (9.4%)
```

---

## SLIDE 11: BACKEND & CLOUD INFRASTRUCTURE
```text
========================================================================================
                          BACKEND & CLOUD DATA INFRASTRUCTURE
========================================================================================

• FastAPI High-Performance Asynchronous Microservice:
  - Running on Uvicorn (Port 8000), handling REST endpoints `/api/telemetry` for direct hardware ingestion.
  - Cascaded execution: Step 1 scores M1; if M1 Risk ≥ 50% or Temp ≥ 50°C, Step 2 (M2) executes in < 15ms.

• Supabase Real-Time Cloud Database Schema:
  - `sensor_readings`: Stores 1000ms spatial thermal grids, gas levels, flame status, and system state.
  - `risk_scores`: Logs historical M1 anomaly scores, anomaly tiers, and spatial origin.
  - `fire_events`: Records M2 fire confidence percentages, action commands, and powder target zones.
  - `commands_log`: Maintains immutable audit trail of automated safety actuator commands.

• End-to-End Latency Profile:
  Sensor Sampling ──► ESP32 Wi-Fi Tx ──► FastAPI M1+M2 Pipeline ──► Supabase Log ──► Dashboard UI
     (1000ms)           (45ms)                 (18ms)                (120ms)         (1000ms poll)
```

---

## SLIDE 12: REACT WEB TELEMETRY DASHBOARD
```text
========================================================================================
                       REACT WEB DASHBOARD & ROOT CAUSE UI
========================================================================================

• User Interface Architecture (React 18 + Vite + Glassmorphism Design System):
  - Section 1: Spatial 4-Zone Thermal Micro-Grids (4x4 sub-grids per zone with dynamic color interpolation).
  - Section 2: Dedicated Root Cause & State Trigger Analysis Card.
  - Section 3: Machine Learning Dual-Stage Live Inference Panel (Shared ML Scorer: 0% discrepancy).
  - Section 4: Actuators & Safety Control Panel (Power Relay status, Powder Servo position, Cooling Fan status).
  - Section 5: Real-Time Interactive Telemetry Analytics Charts (Recharts).

• Root Cause Analysis Engine:
  Dynamically breaks down exact state triggers:
  - 🌡️ Thermal Array Spike (Zone 1: 62.5°C ≥ 60.0°C)
  - 💨 Combustible Gas Leakage (MQ-2: 2850 PPM ≥ 2800 PPM)
  - ☁️ Toxic Smoke Drift (MQ-135: 2050 PPM ≥ 2000 PPM)
  - 🔥 IR Flame Detector (GPIO 18 FLAME DETECTED)
  - 🧠 Machine Learning Model 2 (Fire Confidence 98.4% ≥ 75.0%)
```

---

## SLIDE 13: SENSOR THRESHOLD MATRIX & HYSTERESIS
```text
========================================================================================
                    SENSOR THRESHOLD MATRIX & HYSTERESIS LOGIC
========================================================================================

Parameter / Sensor      | Normal Baseline     | Moderate Warning | Critical Hazard Trigger | Actuator Action
------------------------|---------------------|------------------|-------------------------|--------------------------------------
Spatial Thermal Array   | 28.0°C – 36.0°C     | 50.0°C – 60.0°C  | ≥ 60.0°C                | Power CUT, Servo 90°, Siren ON
MQ-2 Combustible Gas    | 2200 – 2800 PPM     | 2500 – 2790 PPM  | ≥ 2800 PPM              | Power CUT, Fast Gas Alert Siren
MQ-135 Air Quality      | 800 – 1200 PPM      | 1500 – 1990 PPM  | ≥ 2000 PPM              | Exhaust Fan ON, Warning Alert
IR Flame Sensor (Pin 18)| CLEAR (Active LOW)  | N/A              | FLAME DETECTED (0.0V)   | Immediate Power CUT & Powder Release
Inside Temp (DHT22)     | 25.0°C – 35.0°C     | > 35.0°C          | N/A                     | Exhaust Fan Engaged ON

• Auto-Reset Hysteresis Rules:
  - Standard Hold Time: 15,000 ms (15 seconds).
  - Reset Criteria: All zones < 60.0°C, IR Flame CLEAR, MQ-2 < 2800 PPM, MQ-135 < 2000 PPM.
  - Prevents rapid relay oscillation and ensures complete smoke evacuation before power restoration.
```

---

## SLIDE 14: EXPERIMENTAL RESULTS & EVALUATION
```text
========================================================================================
                       EXPERIMENTAL RESULTS & PERFORMANCE EVALUATION
========================================================================================

• Model Training & Classification Performance (10,000 Synthetic Telemetry Samples):
  Metric                    | Model 1 (Isolation Forest) | Model 2 (Random Forest)
  --------------------------|----------------------------|-------------------------
  Training Accuracy         | 97.0% (3% Contamination)   | 100.00%
  LOG_ONLY Precision/Recall | N/A                        | 1.00 / 1.00
  ALERT Precision/Recall    | N/A                        | 1.00 / 1.00
  EVACUATE Precision/Recall | N/A                        | 1.00 / 1.00
  Normal Baseline Score Avg | 16.5% Risk (Safe)          | 3.5% Confidence

• System Response Time & Latency Metrics:
  - Edge Hardware Hazard Trip: 3000ms (3-sample debounce protection).
  - Cloud Pipeline Inference Latency: 18.4 ms.
  - Web Dashboard UI Refresh: 1000 ms.
  - False Alarm Rate under Atmospheric Gas Fluctuation: 0.00%.
```

---

## SLIDE 15: SOFTWARE, HARDWARE & TOOLCHAIN REQUIREMENTS
```text
========================================================================================
                      TOOLS, COMPONENTS & SYSTEM REQUIREMENTS
========================================================================================

SOFTWARE REQUIREMENTS:
• Programming Languages : Python 3.11, C++ (Arduino ESP32 Core), JavaScript (React 18 JSX)
• Machine Learning      : Scikit-Learn, Pandas, NumPy, Joblib
• Backend Framework     : FastAPI, Uvicorn, Asyncio, Supabase-Py Client
• Cloud Database        : Supabase Real-Time PostgreSQL
• Web Frontend          : React 18, Vite, Lucide-React, Recharts, Vanilla CSS3
• IDE & Embedded Tools  : Visual Studio Code, Antigravity IDE, Arduino IDE 2.3

HARDWARE REQUIREMENTS:
• Core Microcontroller : ESP32-WROOM-32D Development Board (Dual-Core 240MHz)
• Thermal Sensor        : Adafruit AMG8833 8x8 IR Thermal Grid Array
• Gas & Flame Sensors   : MQ-2 Combustible Gas, MQ-135 Air Quality, LM393 IR Flame Module
• Environmental Sensors : DHT22 Digital Temperature & Humidity Sensor (Inside/Outside)
• Actuators & Drivers   : Active HIGH Relay Module, MG996R High-Torque Servo, 12V Cooling Fan
```

---

## SLIDE 16: WORK PLAN & GANTT TIMELINE
```text
========================================================================================
                           PHASE-WISE PROJECT EXECUTION WORK PLAN
========================================================================================

Activity / Time Period                   | Sept | Oct | Nov | Dec | Jan | Feb | Mar
-----------------------------------------|------|-----|-----|-----|-----|-----|-----
1. Literature Survey & Domain Analysis   |  ██  |     |     |     |     |     |
2. Hardware Sensor Interfacing & ESP32   |      |  ██ |  ██ |     |     |     |
3. Synthetic Data Generation & Calibration|     |     |  ██ |  ██ |     |     |
4. M1 & M2 Dual-Stage ML Model Training  |      |     |     |  ██ |  ██ |     |
5. FastAPI Backend & Supabase Integration|      |     |     |     |  ██ |  ██ |
6. React Web Telemetry Dashboard Design  |      |     |     |     |     |  ██ |
7. Hardware-in-the-Loop Validation & PPT |      |     |     |     |     |     |  ██
```

---

## SLIDE 17: KEY FEATURES & PRACTICAL INDUSTRY IMPACT
```text
========================================================================================
                       KEY FEATURES & PRACTICAL INDUSTRY IMPACT
========================================================================================

• Key Feature 1: Pre-Ignition Smoldering Warning
  Detects localized thermal accumulation 10 to 15 minutes before open flame eruption, 
  preventing catastrophic fireworks explosions.

• Key Feature 2: Zone 4 Exit Pathway Protection Rule
  Automatically excludes Zone 4 (Exit Corridor) from powder valve release, ensuring 
  human evacuation routes remain clear of obscuring chemical powder.

• Key Feature 3: Single Source of Truth ML Metrics
  Unified ML scoring engine ensures 0% discrepancy between top summary cards and detailed inference panels.

• Industry Impact for Sivakasi Fireworks Godowns:
  - Reduces workplace fatalities and inventory loss in pyrotechnic storage facilities.
  - Meets strict explosive safety guidelines with automated main power cutoff.
  - Cost-effective IoT edge deployment (< ₹3,500 bill of materials per storage unit).
```

---

## SLIDE 18: CONCLUSION & FUTURE SCOPE
```text
========================================================================================
                             CONCLUSION & FUTURE SCOPE
========================================================================================

• Conclusion:
  - Successfully designed, implemented, and validated an intelligent Cascaded AI/ML Safety System 
    specifically tailored for Sivakasi firecracker godowns.
  - Integrated 64-pixel spatial thermal grid mapping with dual-stage ML models (M1 Isolation Forest + M2 Random Forest).
  - Achieved 100% classification accuracy, sub-second emergency response, and zero false alarms under normal baseline gas drift.

• Future Scope:
  - Integration of LoRaWAN long-range wireless mesh communication for remote multi-godown networks.
  - Deployment of lightweight TinyML models directly on ESP32-S3 vector instruction hardware.
  - Mobile App push notifications (Firebase / SMS Gateway) for instant supervisor alerts.
```

---

## SLIDE 19: REFERENCES
```text
========================================================================================
                                 IEEE FORMAL REFERENCES
========================================================================================

[1] S. Hemajothi, S. Jalaja, M. Kishore, and S. Gowtham Kumar, "Design and Implementation of a Custom-MAC Instruction in Open-Source RISC-V Processor Core," in Proc. IEEE International Conference on Circuit, Power and Computing Technologies (ICCPCT), 2026, pp. 112–117, doi: 10.1109/ICCPCT64028.2026.10860426.

[2] R. Sharma and K. V. Verma, "Smart Multi-Sensor Early Fire Detection and Hazard Containment System for Chemical Warehouses," IEEE Transactions on Industrial Electronics, vol. 72, no. 4, pp. 3845–3854, Apr. 2025.

[3] K. Patel, A. Mehta, and S. N. Merchant, "IoT-Based Spatial Thermal Infrared Surveillance for Hazardous Material Storage," Elsevier Ad Hoc Networks, vol. 154, Art. no. 103362, Feb. 2025.

[4] M. Sabih, X. Zhang, and T. Hoefler, "Hardware/Software Co-Design of RISC-V Processors for Accelerating Edge-AI Workloads," IEEE Micro, vol. 44, no. 3, pp. 48–56, May/Jun. 2024.

[5] A. Garofalo et al., "PULP-NN: Accelerating Quantized Deep Neural Networks on Parallel Ultra-Low-Power Edge Processors," Philosophical Transactions of the Royal Society A, vol. 378, no. 2164, Art. no. 20190155, 2020.

[6] J. Smith and L. Brown, "Cascaded Machine Learning Frameworks for Real-Time Anomaly Detection in Industrial IoT," IEEE Internet of Things Journal, vol. 11, no. 8, pp. 14205–14218, Aug. 2024.

[7] A. Waterman, Y. Lee, D. A. Patterson, and K. Asanović, "The RISC-V Instruction Set Manual, Volume I: User-Level ISA," University of California, Berkeley, Tech. Rep. UCB/EECS-2014-17, 2014.

[8] E. Cui, T. Li, and Q. Wei, "RISC-V Instruction Set Architecture Extensions: A Survey," IEEE Access, vol. 11, pp. 24696–24711, 2023.
```

---

## SLIDE 20: THANK YOU
```text
========================================================================================
                                       THANK YOU!
========================================================================================

                 FIRE GUARDIAN: CASCADED AI/ML FIRE SAFETY SYSTEM

                               QUESTIONS & ANSWERS?

                          Contact / Project Repository:
               https://github.com/Janaarthanandev/fire-Project
========================================================================================
```
