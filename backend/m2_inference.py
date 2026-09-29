"""
m2_inference.py — Model 2 (M2 Fire-Confidence Fusion Classifier) Engine.

Evaluates 9-feature vectors (4 thermal zones + env temp_diff + 2 gas + flame + M1 risk score context),
computes fire confidence % using Random Forest model, assigns action command,
determines dry-powder target zones (excluding Zone 4 Exit Pathway),
and logs fire events / commands.
"""

import os
import pathlib
import sys
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple

BASE_DIR = pathlib.Path(__file__).parent.parent
sys.path.append(str(BASE_DIR / "backend"))

from supabase_client import get_client
import config as C

MODEL_DIR_BACKEND = pathlib.Path(__file__).parent / "models"
MODEL_DIR_ML = BASE_DIR / "ml" / "models"

RF_MODEL_PATH = MODEL_DIR_BACKEND / "m2_random_forest.pkl" if (MODEL_DIR_BACKEND / "m2_random_forest.pkl").exists() else MODEL_DIR_ML / "m2_random_forest.pkl"
SCALER_PATH   = MODEL_DIR_BACKEND / "m2_scaler.pkl" if (MODEL_DIR_BACKEND / "m2_scaler.pkl").exists() else MODEL_DIR_ML / "m2_scaler.pkl"

_model = None
_scaler = None

def load_m2_artifacts():
    global _model, _scaler
    if _model is None or _scaler is None:
        if RF_MODEL_PATH.exists() and SCALER_PATH.exists():
            _model  = joblib.load(RF_MODEL_PATH)
            _scaler = joblib.load(SCALER_PATH)
            print("[OK] M2 Model 2 Random Forest and Scaler loaded successfully.")
        else:
            print(f"[WARN] M2 model files not found in {MODEL_DIR}.")

load_m2_artifacts()

def compute_powder_target_zones(fire_zone: str) -> List[str]:
    """
    Compute dry-powder release targets for adjacent unaffected zones.
    Rule: Release powder in ALL fill zones EXCEPT the fire origin zone and Zone_4_Exit.
    """
    all_fill_zones = ["Zone_1_Fill", "Zone_2_Fill", "Zone_3_Fill"]
    target_zones = [z for z in all_fill_zones if z != fire_zone]
    return target_zones

def run_m2_inference(event_data: Dict[str, Any], m1_risk_score: float = 15.0) -> Dict[str, Any]:
    """
    Execute M2 cascaded inference on incoming event payload.
    event_data keys: temp_z1, temp_z2, temp_z3, temp_z4, temp_inside, temp_outside, mq2_val, mq135_val, flame_val
    """
    global _model, _scaler
    load_m2_artifacts()

    temp_z1 = float(event_data.get("temp_z1", 30.0))
    temp_z2 = float(event_data.get("temp_z2", 30.0))
    temp_z3 = float(event_data.get("temp_z3", 30.0))
    temp_z4 = float(event_data.get("temp_z4", 30.0))

    temp_in = float(event_data.get("temp_inside", 30.0))
    temp_out = float(event_data.get("temp_outside", 30.0))
    temp_diff = temp_in - temp_out

    mq2 = float(event_data.get("mq2_val", 100.0))
    mq135 = float(event_data.get("mq135_val", 120.0))
    flame = float(event_data.get("flame_val", 0.0))

    # Determine fire zone origin (highest temp zone)
    zone_temps = {"Zone_1_Fill": temp_z1, "Zone_2_Fill": temp_z2, "Zone_3_Fill": temp_z3, "Zone_4_Exit": temp_z4}
    fire_zone = max(zone_temps, key=zone_temps.get)
    max_temp = zone_temps[fire_zone]

    confidence = 0.0
    command = "LOG_ONLY"

    if _model is not None and _scaler is not None:
        try:
            X_df = pd.DataFrame([{
                "temp_z1": temp_z1,
                "temp_z2": temp_z2,
                "temp_z3": temp_z3,
                "temp_z4": temp_z4,
                "temp_diff": temp_diff,
                "mq2_val": mq2,
                "mq135_val": mq135,
                "flame_val": flame,
                "m1_risk_score": m1_risk_score
            }])
            scaled = _scaler.transform(X_df)
            probs = _model.predict_proba(scaled)[0]
            # Classes: 0 = LOG_ONLY, 1 = SUPERVISOR_ALERT, 2 = EVACUATE
            if len(probs) == 3:
                conf_evacuate = probs[2] * 100.0
                conf_alert = probs[1] * 100.0
                confidence = max(conf_evacuate, conf_alert)
            else:
                confidence = float(np.max(probs) * 100.0)

            pred_class = _model.predict(scaled)[0]
            class_map = {0: "LOG_ONLY", 1: "SUPERVISOR_ALERT", 2: "EVACUATE"}
            command = class_map.get(pred_class, "LOG_ONLY")
        except Exception as err:
            print(f"[ERROR] M2 inference failure: {err}")

    # Manual Safety Rule Overrides
    if max_temp >= 60.0 or flame == 1.0:
        command = "EVACUATE"
        confidence = max(confidence, 95.0)

    if fire_zone == "Zone_4_Exit" and command == "EVACUATE":
        # Exit Pathway Protection Rule
        command = "SUPERVISOR_ALERT"
        powder_zones = []
        powder_released = False
    else:
        powder_zones = compute_powder_target_zones(fire_zone) if command == "EVACUATE" else []
        powder_released = (command == "EVACUATE")

    result = {
        "fire_zone": fire_zone,
        "max_temp": max_temp,
        "confidence": round(confidence, 1),
        "command": command,
        "powder_released": powder_released,
        "powder_zones": powder_zones,
        "m1_risk_score": m1_risk_score
    }

    # Log to Supabase fire_events and commands_log
    try:
        client = get_client()
        client.table("fire_events").insert({
            "godown_id": C.GODOWN_ID,
            "fire_zone": fire_zone,
            "confidence": result["confidence"],
            "action_taken": command,
            "powder_released": powder_released,
            "powder_zones": powder_zones,
            "thermal_max_at_event": max_temp,
            "m1_risk_score_at_event": m1_risk_score
        }).execute()

        client.table("commands_log").insert({
            "godown_id": C.GODOWN_ID,
            "command": command,
            "confidence": result["confidence"],
            "fire_zone": fire_zone,
            "powder_zones": powder_zones,
            "triggered_by": "M2",
            "pre_release_delay": 7,
            "actions_taken": f"M2 {command} executed with {result['confidence']}% confidence."
        }).execute()
    except Exception as exc:
        print(f"[WARN] Failed to write M2 log to Supabase: {exc}")

    return result
