"""
train_isolation_forest.py — Model 1 (M1 Pre-Ignition Anomaly Detector) Training.

Trains an Isolation Forest anomaly detection model on normal baseline telemetry
from the synthetic dataset (or real sensor_readings table exports).

Features extracted for M1 (5 Features):
  1. max_temp        = max(temp_z1, temp_z2, temp_z3, temp_z4)
  2. temp_diff       = temp_inside - temp_outside
  3. humidity_diff   = humidity_inside - humidity_outside
  4. mq2_val         (MQ-2 Gas sensor reading)
  5. mq135_val       (MQ-135 Gas sensor reading)

Outputs:
  ml/models/m1_isolation_forest.pkl
  ml/models/m1_scaler.pkl
"""

import pathlib
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

BASE_DIR = pathlib.Path(__file__).parent.parent
DATA_PATH = BASE_DIR / "ml" / "data" / "synthetic_sensor_readings_v2.csv"
MODEL_DIR = BASE_DIR / "ml" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

M1_FEATURE_NAMES = [
    "max_temp",
    "temp_diff",
    "humidity_diff",
    "mq2_val",
    "mq135_val"
]

def engineer_m1_features(df: pd.DataFrame) -> pd.DataFrame:
    """Derive 5 M1 input features from raw sensor_readings columns."""
    temp_cols = [c for c in ["temp_z1", "temp_z2", "temp_z3", "temp_z4"] if c in df.columns]
    max_temp = df[temp_cols].max(axis=1) if temp_cols else df.get("temp_z1", 30.0)
    
    temp_in  = df.get("temp_inside", 30.0)
    temp_out = df.get("temp_outside", 30.0)
    temp_diff = temp_in - temp_out

    hum_in  = df.get("humidity_inside", 50.0)
    hum_out = df.get("humidity_outside", 50.0)
    humidity_diff = hum_in - hum_out

    mq2 = df.get("mq2_val", 100.0)
    mq135 = df.get("mq135_val", 120.0)

    features_df = pd.DataFrame({
        "max_temp": max_temp,
        "temp_diff": temp_diff,
        "humidity_diff": humidity_diff,
        "mq2_val": mq2,
        "mq135_val": mq135
    })
    return features_df

def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}. Run ml/generate_synthetic_data_v2.py first.")

    print(f"[1/4] Loading dataset from: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    print(f"      Total rows: {len(df)}")

    # Filter normal rows to train Isolation Forest baseline
    normal_df = df[df["system_state"] == "NORMAL"].copy()
    print(f"[2/4] Normal baseline samples for training: {len(normal_df)}")

    X_raw = engineer_m1_features(normal_df)

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_raw)

    # Train Isolation Forest
    print("[3/4] Fitting IsolationForest model...")
    model = IsolationForest(
        n_estimators=100,
        contamination=0.03,  # 3% expected baseline anomalies
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_scaled)

    # Evaluate on full dataset (Normal, Moderate, Critical)
    X_full = engineer_m1_features(df)
    X_full_scaled = scaler.transform(X_full)
    scores_raw = model.decision_function(X_full_scaled)  # higher = more normal, lower = more anomalous

    # Map raw decision scores to 0-100 risk scores
    # Typical decision scores range from +0.25 (very normal) to -0.35 (highly anomalous)
    risk_scores = np.clip((0.20 - scores_raw) * 160.0, 0, 100).round(1)

    df["risk_score"] = risk_scores
    print("\n--- M1 Risk Score Distribution across System States ---")
    print(df.groupby("system_state")["risk_score"].describe()[["count", "mean", "min", "max"]])

    # Save artifacts
    model_path  = MODEL_DIR / "m1_isolation_forest.pkl"
    scaler_path = MODEL_DIR / "m1_scaler.pkl"

    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)

    print(f"\n[4/4] [OK] Saved M1 Model to:  {model_path}")
    print(f"      [OK] Saved M1 Scaler to: {scaler_path}")

if __name__ == "__main__":
    main()
