"""
m1_scorer.py — Model 1 (M1 Pre-Ignition Risk Scorer) inference logic.

Loads trained Isolation Forest model (m1_isolation_forest.pkl) and scaler (m1_scaler.pkl).
Computes risk score (0-100) and maps risk tier:
  - Safe      : risk_score < 40.0
  - Moderate  : 40.0 <= risk_score < 70.0
  - Dangerous : risk_score >= 70.0
"""

import logging
import pathlib
import joblib
import pandas as pd
import numpy as np
import config as C

logger = logging.getLogger(__name__)

MODEL_DIR_BACKEND = pathlib.Path(__file__).parent / "models"
MODEL_DIR_ML = pathlib.Path(__file__).parent.parent / "ml" / "models"

M1_MODEL_PATH = MODEL_DIR_BACKEND / "m1_isolation_forest.pkl" if (MODEL_DIR_BACKEND / "m1_isolation_forest.pkl").exists() else MODEL_DIR_ML / "m1_isolation_forest.pkl"
M1_SCALER_PATH = MODEL_DIR_BACKEND / "m1_scaler.pkl" if (MODEL_DIR_BACKEND / "m1_scaler.pkl").exists() else MODEL_DIR_ML / "m1_scaler.pkl"

_model = None
_scaler = None

def load_m1_artifacts():
    global _model, _scaler
    if _model is None or _scaler is None:
        if M1_MODEL_PATH.exists() and M1_SCALER_PATH.exists():
            _model  = joblib.load(M1_MODEL_PATH)
            _scaler = joblib.load(M1_SCALER_PATH)
            logger.info("Loaded M1 IsolationForest model and Scaler successfully.")
        else:
            logger.warning(f"M1 model artifacts not found at {MODEL_DIR}. Using rule-based fallback.")

load_m1_artifacts()

def map_risk_tier(score: float) -> str:
    if score < 40.0:
        return "Safe"
    elif score < 70.0:
        return "Moderate"
    else:
        return "Dangerous"

def score_zone(features: dict) -> tuple[float, str, float]:
    """
    Compute M1 pre-ignition risk score.
    Returns: (risk_score, risk_tier, anomaly_score_raw)
    """
    global _model, _scaler
    load_m1_artifacts()

    max_temp = features.get("max_temp", 30.0)
    temp_diff = features.get("temp_diff", 0.0)
    humidity_diff = features.get("humidity_diff", 0.0)
    mq2 = features.get("mq2_val", 2450.0)
    mq135 = features.get("mq135_val", 950.0)

    if _model is not None and _scaler is not None:
        try:
            df = pd.DataFrame([{
                "max_temp": max_temp,
                "temp_diff": temp_diff,
                "humidity_diff": humidity_diff,
                "mq2_val": mq2,
                "mq135_val": mq135
            }])
            scaled = _scaler.transform(df)
            raw_score = float(_model.decision_function(scaled)[0])
            risk_score = float(np.clip((0.20 - raw_score) * 160.0, 0.0, 100.0))
            risk_tier = map_risk_tier(risk_score)
            return round(risk_score, 1), risk_tier, round(raw_score, 4)
        except Exception as err:
            logger.error(f"Error during M1 inference: {err}")

    # Fallback formula aligned with MQ-2 (2200-2800 PPM normal) & MQ-135 (800-1200 PPM normal)
    if max_temp >= 60.0 or mq2 >= 2800 or mq135 >= 2000:
        raw_calc = 84.0 + (max_temp - 60.0) * 0.4 + max(0, mq2 - 2800) * 0.02 + max(0, mq135 - 2000) * 0.02
    elif max_temp >= 45.0 or mq2 >= 2500 or mq135 >= 1500:
        raw_calc = 50.0 + max(0, max_temp - 45.0) * 1.5 + max(0, mq2 - 2500) * 0.08
    else:
        temp_contrib = max(0, (max_temp - 30.0) * 1.5)
        mq2_contrib = max(0, (mq2 - 2200) * 0.03)
        mq135_contrib = max(0, (mq135 - 800) * 0.03)
        raw_calc = 12.0 + temp_contrib + mq2_contrib + mq135_contrib

    risk_score = float(np.clip(raw_calc, 0.0, 100.0))
    return round(risk_score, 1), map_risk_tier(risk_score), 0.0
