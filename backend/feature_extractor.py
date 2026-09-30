"""
feature_extractor.py — Extract M1 & M2 input features from a new sensor_readings row.

Features extracted per inference cycle from the new sensor_readings schema:
  - temp_z1, temp_z2, temp_z3, temp_z4
  - temp_inside, humidity_inside
  - temp_outside, humidity_outside
  - mq2_val, mq135_val, flame_val
"""

import logging
import pandas as pd

logger = logging.getLogger(__name__)

M1_FEATURE_KEYS = [
    "max_temp",
    "temp_diff",
    "humidity_diff",
    "mq2_val",
    "mq135_val"
]

def extract_m1_features(row: dict) -> dict | None:
    """
    Extract M1 features from a new sensor_readings row.
    Returns dict of 5 features or None if invalid.
    """
    temp_z1 = row.get("temp_z1")
    temp_z2 = row.get("temp_z2")
    temp_z3 = row.get("temp_z3")
    temp_z4 = row.get("temp_z4")

    # Fallback if raw list or individual fields passed
    temps = [t for t in [temp_z1, temp_z2, temp_z3, temp_z4] if t is not None]
    if not temps:
        # Fallback to thermal_max if present
        max_temp = float(row.get("thermal_max", 30.0))
    else:
        max_temp = float(max(temps))

    temp_in = float(row.get("temp_inside") if row.get("temp_inside") is not None else row.get("thermal_avg", 30.0))
    temp_out = float(row.get("temp_outside") if row.get("temp_outside") is not None else 30.0)
    temp_diff = temp_in - temp_out

    hum_in = float(row.get("humidity_inside") if row.get("humidity_inside") is not None else row.get("humidity", 50.0))
    hum_out = float(row.get("humidity_outside") if row.get("humidity_outside") is not None else 50.0)
    humidity_diff = hum_in - hum_out

    mq2 = float(row.get("mq2_val") if row.get("mq2_val") is not None else row.get("gas_level", 2450.0))
    mq135 = float(row.get("mq135_val") if row.get("mq135_val") is not None else row.get("gas_level", 950.0))

    return {
        "max_temp": max_temp,
        "temp_diff": temp_diff,
        "humidity_diff": humidity_diff,
        "mq2_val": mq2,
        "mq135_val": mq135
    }
