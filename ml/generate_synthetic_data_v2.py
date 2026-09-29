"""
generate_synthetic_data_v2.py — Synthetic dataset generator for new FireGuard Schema.

Simulates 7 days of raw telemetry matching the new sensor_readings schema:
  - temp_z1, temp_z2, temp_z3, temp_z4 (AMG8833 4-zone max temps)
  - temp_inside, humidity_inside (DHT22 inside)
  - temp_outside, humidity_outside (DHT22 outside)
  - mq2_val, mq135_val (Gas sensors)
  - flame_val (IR flame sensor: 0.0 or 1.0)
  - fan_status (boolean: true if temp_inside > 30°C)
  - system_state ('NORMAL', 'MODERATE', 'CRITICAL')
  - thermal_grid (64-element JSON float array)

Scenarios generated:
  1. Normal Diurnal (Ambient day/night fluctuation, safe baseline)
  2. Gradual Pre-Ignition Smoldering (Temp rising 50°C-60°C, gas drift, no flame)
  3. Active Fire Outbreak (Temp > 60°C, flame = 1.0, high gas)
  4. Exit Zone Hotspot (Temp_z4 > 50°C, exit pathway warning)
  5. Summer Heat Wave (High outside temp vs inside, fan active)

Usage:
  python ml/generate_synthetic_data_v2.py
"""

import numpy as np
import pandas as pd
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

OUTPUT_DIR = Path(__file__).parent / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

CYCLE_SECONDS = 15
TOTAL_SAMPLES = 10000  # 10,000 synthetic reading cycles

def generate_thermal_grid(z1, z2, z3, z4):
  """Generate realistic 8x8 (64 pixels) AMG8833 matrix based on 4 zone max temps."""
  grid = np.zeros((8, 8))
  
  # Zone 1 (top-left 4x4)
  grid[0:4, 0:4] = z1 - np.random.uniform(0.5, 4.0, (4, 4))
  # Zone 2 (top-right 4x4)
  grid[0:4, 4:8] = z2 - np.random.uniform(0.5, 4.0, (4, 4))
  # Zone 3 (bottom-left 4x4)
  grid[4:8, 0:4] = z3 - np.random.uniform(0.5, 4.0, (4, 4))
  # Zone 4 (bottom-right 4x4)
  grid[4:8, 4:8] = z4 - np.random.uniform(0.5, 4.0, (4, 4))

  return grid.flatten().round(2).tolist()

rows = []
base_time = datetime.now(timezone.utc) - timedelta(days=5)

for i in range(TOTAL_SAMPLES):
  timestamp = (base_time + timedelta(seconds=i * CYCLE_SECONDS)).isoformat()

  # Determine scenario type based on sample index
  # 70% Normal, 15% Gradual Smoldering, 10% Active Fire, 5% Exit Hotspot
  r = np.random.rand()

  if r < 0.70:
    # --- SCENARIO 1: NORMAL OPERATION ---
    # Diurnal ambient fluctuation (28°C to 36°C)
    hour = (i * CYCLE_SECONDS / 3600) % 24
    diurnal = 4.0 * np.sin(2 * np.pi * (hour - 4) / 24)

    temp_inside = round(float(31.0 + diurnal + np.random.normal(0, 0.5)), 2)
    temp_outside = round(float(33.0 + diurnal + np.random.normal(0, 0.8)), 2)
    humidity_inside = round(float(55.0 - diurnal * 1.5 + np.random.normal(0, 1.0)), 2)
    humidity_outside = round(float(50.0 - diurnal * 1.2 + np.random.normal(0, 1.2)), 2)

    temp_z1 = round(float(temp_inside + np.random.uniform(0.2, 2.0)), 2)
    temp_z2 = round(float(temp_inside + np.random.uniform(0.1, 1.8)), 2)
    temp_z3 = round(float(temp_inside + np.random.uniform(0.3, 2.2)), 2)
    temp_z4 = round(float(temp_inside + np.random.uniform(0.0, 1.5)), 2)

    mq2_val = round(float(np.clip(np.random.normal(2450, 120), 2200, 2780)), 2)
    mq135_val = round(float(np.clip(np.random.normal(950, 70), 800, 1190)), 2)
    flame_val = 0.0
    system_state = "NORMAL"

  elif r < 0.85:
    # --- SCENARIO 2: GRADUAL PRE-IGNITION SMOLDERING (MODERATE) ---
    # Temp rising into 50°C - 60°C range in Zone 1 or Zone 2
    temp_inside = round(float(34.0 + np.random.normal(0, 0.8)), 2)
    temp_outside = round(float(32.0 + np.random.normal(0, 0.5)), 2)
    humidity_inside = round(float(38.0 + np.random.normal(0, 1.5)), 2)  # Humidity drops
    humidity_outside = round(float(52.0 + np.random.normal(0, 1.0)), 2)

    # Hotspot in Zone 1
    temp_z1 = round(float(np.random.uniform(50.5, 59.5)), 2)
    temp_z2 = round(float(temp_inside + np.random.uniform(1.0, 4.0)), 2)
    temp_z3 = round(float(temp_inside + np.random.uniform(1.0, 3.5)), 2)
    temp_z4 = round(float(temp_inside + np.random.uniform(0.5, 2.0)), 2)

    mq2_val = round(float(np.random.normal(2600, 60)), 2)     # Gas drift
    mq135_val = round(float(np.random.normal(1600, 80)), 2)
    flame_val = 0.0  # No visible flame yet!
    system_state = "MODERATE"

  elif r < 0.95:
    # --- SCENARIO 3: ACTIVE FIRE OUTBREAK (CRITICAL) ---
    # Temp > 60°C, Flame = 1.0, High Gas
    temp_inside = round(float(42.0 + np.random.normal(0, 1.5)), 2)
    temp_outside = round(float(33.0 + np.random.normal(0, 0.5)), 2)
    humidity_inside = round(float(25.0 + np.random.normal(0, 2.0)), 2)
    humidity_outside = round(float(50.0 + np.random.normal(0, 1.0)), 2)

    temp_z1 = round(float(np.random.uniform(62.0, 78.0)), 2)
    temp_z2 = round(float(np.random.uniform(45.0, 55.0)), 2)
    temp_z3 = round(float(np.random.uniform(40.0, 50.0)), 2)
    temp_z4 = round(float(np.random.uniform(35.0, 42.0)), 2)

    mq2_val = round(float(np.random.normal(2950, 100)), 2)
    mq135_val = round(float(np.random.normal(2150, 120)), 2)
    flame_val = 1.0  # Flame detected!
    system_state = "CRITICAL"

  else:
    # --- SCENARIO 4: EXIT CORRIDOR HOTSPOT (ZONE 4 WARNING) ---
    temp_inside = round(float(33.0 + np.random.normal(0, 0.5)), 2)
    temp_outside = round(float(31.0 + np.random.normal(0, 0.5)), 2)
    humidity_inside = round(float(45.0 + np.random.normal(0, 1.0)), 2)
    humidity_outside = round(float(52.0 + np.random.normal(0, 1.0)), 2)

    temp_z1 = round(float(temp_inside + 1.0), 2)
    temp_z2 = round(float(temp_inside + 1.2), 2)
    temp_z3 = round(float(temp_inside + 0.8), 2)
    temp_z4 = round(float(np.random.uniform(51.0, 56.0)), 2)  # Hotspot in Zone 4 Exit

    mq2_val = round(float(np.random.normal(2450, 80)), 2)
    mq135_val = round(float(np.random.normal(950, 60)), 2)
    flame_val = 0.0
    system_state = "MODERATE"

  # Fan status: ON if temp_inside > 30.0°C
  fan_status = bool(temp_inside > 30.0)

  # Generate 64-element grid
  grid_json = generate_thermal_grid(temp_z1, temp_z2, temp_z3, temp_z4)

  row = {
      "created_at": timestamp,
      "temp_z1": temp_z1,
      "temp_z2": temp_z2,
      "temp_z3": temp_z3,
      "temp_z4": temp_z4,
      "temp_inside": temp_inside,
      "humidity_inside": humidity_inside,
      "temp_outside": temp_outside,
      "humidity_outside": humidity_outside,
      "mq2_val": mq2_val,
      "mq135_val": mq135_val,
      "flame_val": flame_val,
      "fan_status": fan_status,
      "system_state": system_state,
      "thermal_grid": grid_json,
  }
  rows.append(row)

df = pd.DataFrame(rows)
output_path = OUTPUT_DIR / "synthetic_sensor_readings_v2.csv"
df.to_csv(output_path, index=False)

print(f"[OK] Generated {len(df)} synthetic sensor readings in: {output_path}")
print("Sample rows:")
print(df[["temp_z1", "temp_z2", "temp_inside", "mq2_val", "flame_val", "fan_status", "system_state"]].head())
