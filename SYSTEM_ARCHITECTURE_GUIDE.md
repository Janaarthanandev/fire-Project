# 🏗️ Fire Guardian — System Architecture Blueprint & Diagram Guide

> **Project:** Fire Guardian — AI-Powered Smart Fire Safety System  
> **Target Environment:** Industrial Fireworks Manufacturing & Storage Godowns (Sivakasi Godown Model)  
> **Architecture Pattern:** 4-Tier Hybrid AI & Autonomous Edge Computing Infrastructure

---

## 1. System Architecture Overview

Fire Guardian is an integrated 4-tier fire safety system that combines real-time IoT multi-modal sensing, edge autonomous fast-path failsafes, dual-model machine learning cascade inference (**Model 1 + Model 2**), and a live web monitoring dashboard.

```
                               ┌─────────────────────────────────────────────────────────────┐
                               │                    LIVE WEB DASHBOARD                        │
                               │               React + Vite + Recharts                        │
                               │  - Zone Risk Cards        - 8x8 AMG8833 IR Matrix Heatmap    │
                               │  - M2 Fire Action Panel   - Live Scenario Simulator (M2-1..7) │
                               └──────────────────────────────▲──────────────────────────────┘
                                                              │ REST / Real-time WebSockets
┌─────────────────────────────────────────────────────────────┴──────────────────────────────┐
│                              CLOUD BACKEND & DATABASE LAYER                                 │
│      Supabase PostgreSQL  ◄───►  FastAPI Backend Server (uvicorn backend.main:app)          │
│      (sensor_readings, risk_scores, fire_events tables)                                     │
└──────────────────────────────▲──────────────────────────────▲──────────────────────────────┘
                               │ Real-time Telemetry          │ Async Event Trigger
┌──────────────────────────────┴──────────────────────────────┴──────────────────────────────┐
│                                  AI ML CASCADED PIPELINE                                   │
│                                                                                            │
│   ┌──────────────────────────────────────────┐    ┌────────────────────────────────────┐   │
│   │ Model 1 (M1): Pre-Ignition Risk Scorer   │    │ Model 2 (M2): Fire-Confidence      │   │
│   │ - ML Engine: Isolation Forest            │    │ - ML Engine: Random Forest         │   │
│   │ - Input: EWMA trend, Gas drift, Hum diff │    │ - Trigger: Stage 1 (T>50°C/Rise>3) │   │
│   │ - Output: Risk Score (0-100), Tiers      │    │ - Output: Confidence %, Command    │   │
│   └──────────────────────────────────────────┘    └─────────────────┬──────────────────┘   │
│                                                                     │                      │
│                                           Command: EVACUATE (≥75%)  │                      │
│                                           Powder Target: Selective  │                      │
└─────────────────────────────────────────────────────────────────────┼──────────────────────┘
                                                                      │ Solenoid Actuation (<50ms Edge / Relay)
┌─────────────────────────────────────────────────────────────────────▼──────────────────────┐
│                              HARDWARE & SENSOR EDGE LAYER                                  │
│                                    ESP32 Microcontroller                                   │
│                                                                                            │
│  [Sensors]                                           [Actuators & Failsafe]                │
│  - AMG8833 8×8 IR Thermal Array (64 pixels)          - 4-Channel Relay Module              │
│  - MQ-2 & MQ-135 Gas/Smoke Sensors                   - Solenoid Powder Release Valves      │
│  - DHT22 Temp & Humidity Sensor                      - Alarm Siren & Strobe Beacon        │
│  - IR Flame Sensor Module                            - Autonomous Edge Failsafe Trip      │
│                                                        (Temp>65°C AND Flame>0.7 AND Gas>280)│
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer-by-Layer Technical Specification

### Layer 1: Hardware & Sensor Edge Layer (ESP32)
* **Core Controller:** ESP32 Microcontroller (Wi-Fi + Dual Core LX6).
* **Thermal Spatial Array:** AMG8833 8×8 (64 pixels) IR Grid Imager measuring local spatial heat patterns.
* **Combustion Gas Sensors:** MQ-2 & MQ-135 analog gas sensors for LPG, CO, and smoke drift.
* **Environmental Sensor:** DHT22 for relative humidity and ambient temperature baseline.
* **Optical Flame Detector:** IR Flame Sensor module for optical flickering flame verification.
* **Actuators:** 4-Channel Relay Module controlling Dry Chemical Powder Extinguisher Solenoids.
* **Autonomous Edge Failsafe:** Hardcoded fast-path check executed locally on ESP32 in `<50ms`:
  $$\text{thermal\_max} > 65.0^\circ\text{C} \quad\text{AND}\quad \text{flame\_reading} > 0.70 \quad\text{AND}\quad \text{gas\_ppm} > 280.0$$
  *If true, solenoids trip instantly without waiting for server network responses.*

---

### Layer 2: Cascaded AI Machine Learning Intelligence Pipeline
* **Stage 1 (Thermal Check):** Evaluates every 15-second cycle:
  $$\text{thermal\_max} > 50.0^\circ\text{C} \quad\text{OR}\quad \text{thermal\_trend} > 3.0^\circ\text{C/cycle}$$
  *Triggers Model 2 inference engine.*
* **Model 1 (M1 — Pre-Ignition Anomaly Risk Scorer):**
  * **Algorithm:** Isolation Forest + Feature Weighting (EWMA Thermal Trend, Gas Drift, Humidity Differential).
  * **Output:** Pre-ignition Risk Score ($0 - 100$) and Tiers: **Safe** ($<40$), **Moderate** ($40-69$), **Dangerous** ($\ge 70$).
* **Model 2 (M2 — Emergency Fire-Confidence Fusion Classifier):**
  * **Algorithm:** Random Forest Classifier trained on 8 multi-modal sensor features.
  * **Output:** Fire Confidence Percentage ($0.0\% - 100.0\%$) and Command:
    * $< 40.0\% \rightarrow \text{LOG\_ONLY}$
    * $40.0\% - 74.0\% \rightarrow \text{SUPERVISOR\_ALERT}$
    * $\ge 75.0\% \rightarrow \text{EVACUATE} + \text{Dry Chemical Powder Release}$
* **Critical Safety Rule:** Zone 4 Exit Pathway is monitored, but **powder release is ALWAYS inhibited in Zone 4** to ensure evacuation routes remain clear and non-toxic for escaping workers.

---

### Layer 3: Backend & Database Infrastructure
* **Database:** Supabase PostgreSQL with real-time WebSocket publications (`sensor_readings`, `risk_scores`, `fire_events`).
* **REST Backend:** Python FastAPI (`backend/main.py`) handling real-time sensor processing, M1/M2 inference, and WebSocket broadcasts to dashboard.

---

### Layer 4: Web Monitoring Dashboard
* **Framework:** React + Vite + Vanilla CSS Glassmorphism design system.
* **Key Components:**
  1. **Scenario Simulator Bar:** Built-in interactive simulator for testing all 7 formal report scenarios (`M2-1` through `M2-7`).
  2. **Zone Risk Cards:** Real-time M1 risk scores, tier badges, and 4x4 compact heatmaps.
  3. **M2 Fire Event Containment Panel:** Emergency banners, 7-second pre-release countdown, target powder release badges.
  4. **Full 8x8 AMG8833 Thermal View:** 64-pixel spatial heat map rendering.
  5. **Dynamic Recharts Analytics:** Live risk score evolution, feature correlation matrix, and zone comparison bar charts.

---

## 3. AI Image Generation Prompt (For Diagrams & Presentations)

If you are generating a 3D isometric architectural image using AI tools (DALL-E 3, Midjourney, Flux, or Canva AI), use this exact prompt:

```text
High-tech 3D isometric architectural infographic diagram of an AI-powered smart industrial fire safety system named 'Fire Guardian'. Dark futuristic cyberpunk UI theme with neon cyan, red, amber, and emerald green glowing nodes. 

Layer 1 (Bottom): Industrial ESP32 microcontroller hardware board wired to 8x8 AMG8833 infrared thermal camera matrix, gas sensors, flame sensors, and dry powder solenoid actuators. Glowing electrical telemetry pulses flowing upwards.

Layer 2 (Middle Left): Model 1 Isolation Forest Machine Learning AI brain node processing pre-ignition anomaly risk scores.

Layer 3 (Middle Right): Model 2 Cascaded Random Forest Classifier decision engine outputting EVACUATE commands and localized powder suppression targeting.

Layer 4 (Top): Sleek modern web dashboard interface displaying 8x8 IR thermal heatmaps, zone risk cards, emergency fire containment alert banners, and multi-zone analytics graphs.

Clean technical vector graphic layout, isometric 3D view, studio lighting, highly detailed schema, white arrows connecting layers, dark background (#0a0c10).
```
