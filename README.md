# 🔥 Fire Guardian — AI-Powered Fire Safety & Prevention System

> **An End-to-End Autonomous Fire Prevention, Thermal Hotspot Tracking, and Chemical Suppression System for Sivakasi Firecracker Godowns.**
>
> Built with **ESP32 Microcontroller Hardware**, **Two-Stage Machine Learning (Model 1 Isolation Forest & Model 2 Random Forest)**, **FastAPI Backend**, **Supabase Cloud Database**, and a **React + Vite Live Telemetry Dashboard**.

---

## 📌 Table of Contents
1. [System Overview & Architecture](#-system-overview--architecture)
2. [Project Directory Structure](#-project-directory-structure)
3. [Component 1 — Firmware (ESP32 Hardware)](#-component-1--firmware-esp32-hardware)
4. [Component 2 — Cloud Database (Supabase)](#-component-2--cloud-database-supabase)
5. [Component 3 — Machine Learning & FastAPI Backend](#-component-3--machine-learning--fastapi-backend)
6. [Component 4 — Web Telemetry Dashboard](#-component-4--web-telemetry-dashboard)
7. [🚀 How to Run the Entire Project (Step-by-Step)](#-how-to-run-the-entire-project-step-by-step)
8. [🧪 System Testing & Serial Monitor Commands](#-system-testing--serial-monitor-commands)

---

## 🏗️ System Overview & Architecture

Fire Guardian utilizes a **two-tier AI prevention architecture** combined with immediate **edge hardware fail-safe response**:

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         ESP32 HARDWARE SENSOR NODE                          │
 │  AMG8833 (8x8 Thermal IR Array) · Dual DHT22 (Inside/Outside Temp & Hum)   │
 │  MQ-2 Gas Sensor · MQ-135 Gas Sensor · IR Flame Sensor Module              │
 └──────────────────────┬──────────────────────────────────────────────────────┘
                        │ HTTP POST (Non-blocking FreeRTOS Task on Core 0)
                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         SUPABASE CLOUD DATABASE                             │
 │  Table: `sensor_readings` (Lean 14-column schema + 64-pixel JSON grid)     │
 └──────────────────────┬──────────────────────────────────────────────────────┘
                        │ Real-Time Polling / Subscription
                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                       FASTAPI AI BACKEND ENGINE                             │
 │  Stage 1 (M1): Isolation Forest Pre-Ignition Risk Scorer (0 - 100)        │
 │  Stage 2 (M2): Random Forest Fire Classifier (Fire Confidence 0 - 100%)     │
 └──────────────────────┬──────────────────────────────────────────────────────┘
                        │ REST API / WebSocket
                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                     REACT + VITE LIVE DASHBOARD                             │
 │  Zone Cards · Actuators Status · M1 & M2 AI Panels · 8x8 Thermal Heatmap   │
 │  Recent Logs Table · Live Real-time Graphs · Model Performance Charts       │
 └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Directory Structure

```
d:/fire Project/
├── firmware/
│   └── esp32_full_hardware_system.ino   # ESP32 C++ Firmware (FreeRTOS Core 0 Cloud, Core 1 Loop)
├── backend/
│   ├── main.py                          # FastAPI server endpoints
│   ├── m1_scorer.py                     # Stage 1 Isolation Forest risk scoring
│   ├── m2_inference.py                  # Stage 2 Random Forest fire confidence
│   ├── feature_extractor.py             # Raw reading feature extraction logic
│   ├── supabase_client.py               # Supabase REST client
│   ├── config.py                        # System configuration & secrets
│   └── requirements.txt                 # Python dependencies
├── ml/
│   ├── generate_synthetic_data_v2.py    # Training dataset generator
│   ├── train_isolation_forest.py        # Model 1 Isolation Forest training script
│   ├── m2_train.py                      # Model 2 Random Forest classifier training script
│   ├── calibrate_thresholds.py          # Operational threshold calibration
│   ├── generate_analytics_charts.py     # Analytics and evaluation chart generator
│   └── models/                          # Saved trained models (.pkl)
├── dashboard/
│   ├── src/                             # React components & UI logic
│   ├── package.json                     # Frontend Node dependencies
│   ├── vite.config.js                   # Vite configuration
│   └── index.html                       # HTML entry point
├── SYSTEM_ARCHITECTURE_GUIDE.md         # Full technical system architecture guide
├── PRESENTATION_GUIDE.md                # Project presentation guide
└── README.md                            # This README file
```

---

## 🔌 Component 1 — Firmware (ESP32 Hardware)

**File:** [`firmware/esp32_full_hardware_system.ino`](file:///d:/fire%20Project/firmware/esp32_full_hardware_system.ino)

### Pin Mapping Table
| Sensor / Actuator | ESP32 GPIO Pin | Function / Active State |
|---|---|---|
| **AMG8833 Thermal Array** | GPIO 21 (SDA), GPIO 22 (SCL) | I2C (Address 0x69 / 0x68) |
| **DHT22 Inside** | GPIO 16 | Inside Temp & Humidity |
| **DHT22 Outside** | GPIO 17 | Ambient Reference Temp & Humidity |
| **MQ-2 Gas Sensor** | GPIO 36 (VP) | Combustible Gas Analog Read |
| **MQ-135 Gas Sensor** | GPIO 39 (VN) | Air Quality / Smoke Analog Read |
| **IR Flame Sensor** | GPIO 18 | Digital Flame Read (`HIGH` = Flame Detected) |
| **Alarm Status LED** | GPIO 2 | Visual Alarm Output |
| **Piezo Siren / Buzzer** | GPIO 4 | Audio Alarm Output |
| **Ventilation Fan** | GPIO 25 | Direct Output (`HIGH` = ON when $T_{\text{inside}} > 35^\circ\text{C}$) |
| **Power Cutoff Relay** | GPIO 26 | Active LOW Relay (`LOW` = Relay Energized $\rightarrow$ COM to NO $\rightarrow$ Main Power CUT) |
| **Extinguisher Servo** | GPIO 13 | SG90 PWM ($0^\circ$ = CLOSED, $90^\circ$ = OPEN) |

---

## ☁️ Component 2 — Cloud Database (Supabase)

The cloud database runs on Supabase PostgreSQL. Create the `sensor_readings` table in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS public.sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    temp_z1 DOUBLE PRECISION NOT NULL,
    temp_z2 DOUBLE PRECISION NOT NULL,
    temp_z3 DOUBLE PRECISION NOT NULL,
    temp_z4 DOUBLE PRECISION NOT NULL,
    temp_inside DOUBLE PRECISION DEFAULT 30.0,
    humidity_inside DOUBLE PRECISION DEFAULT 50.0,
    temp_outside DOUBLE PRECISION DEFAULT 30.0,
    humidity_outside DOUBLE PRECISION DEFAULT 50.0,
    mq2_val DOUBLE PRECISION DEFAULT 0.0,
    mq135_val DOUBLE PRECISION DEFAULT 0.0,
    flame_val DOUBLE PRECISION DEFAULT 0.0,
    fan_status BOOLEAN DEFAULT FALSE,
    system_state TEXT DEFAULT 'NORMAL',
    thermal_grid JSONB
);
```

---

## 🧠 Component 3 — Machine Learning & FastAPI Backend

### 1. Python Environment Setup
Navigate to the project root directory and set up the Python environment:

```powershell
# Activate existing virtual environment (or create a new one)
.\venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r backend/requirements.txt
```

### 2. Retrain ML Models (Optional)
If you wish to re-train Model 1 (Isolation Forest) and Model 2 (Random Forest Classifier):

```powershell
# 1. Generate 10,000 synthetic reading cycles
python ml/generate_synthetic_data_v2.py

# 2. Train Model 1 (Isolation Forest)
python ml/train_isolation_forest.py

# 3. Train Model 2 (Random Forest Classifier)
python ml/m2_train.py
```

### 3. Run FastAPI Backend Server
Launch the backend engine on port `8000`:

```powershell
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 💻 Component 4 — Web Telemetry Dashboard

The dashboard is built using **React**, **Vite**, **Recharts**, and **Lucide Icons**.

```powershell
# Navigate to dashboard folder
cd dashboard

# Install node dependencies
npm install

# Start development server
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 🚀 How to Run the Entire Project (Step-by-Step)

1. **Flash Firmware**: Upload `firmware/esp32_full_hardware_system.ino` to your ESP32 via Arduino IDE.
2. **Start Backend Server**:
   ```powershell
   .\venv\Scripts\Activate.ps1
   cd backend
   uvicorn main:app --reload --port 8000
   ```
3. **Start Dashboard**:
   ```powershell
   cd dashboard
   npm run dev
   ```
4. **Access Web App**: Open `http://localhost:5173`.

---

## 🧪 System Testing & Serial Monitor Commands

When the ESP32 is running and connected to your PC via USB, open the **Arduino Serial Monitor** (Baud Rate: `115200`) to execute live manual hardware overrides:

| Key Input | Action Executed | Hardware Response |
|---|---|---|
| `'c'` or `'C'` | **Force CRITICAL State** | Pin 26 `LOW` (Power CUT), Servo $90^\circ$ (Open), Fast 200ms `1 0 1 0` Siren & LED Blink |
| `'m'` or `'M'` | **Force MODERATE State** | Pin 26 `HIGH` (Normal Power), Servo $0^\circ$ (Closed), Warning `1 0 1 0` Siren & LED Blink |
| `'r'` or `'R'` / `'n'` | **Reset to NORMAL State** | Clear manual override, Pin 26 `HIGH` (Normal Power), Servo $0^\circ$, LED & Siren OFF |

---
*Built with ❤️ for Sivakasi Industrial Safety & AI Automation.*
