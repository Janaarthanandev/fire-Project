"""
m2_train.py — Model 2 (M2 Fire-Confidence Fusion Classifier) Training.

Trains a Random Forest Classifier on 9 multi-sensor features (including M1 risk context)
to classify fire hazard severity and compute fire confidence percentage (0-100%).

Features extracted for M2 (9 Features):
  1. temp_z1         (Zone 1 Max Temp)
  2. temp_z2         (Zone 2 Max Temp)
  3. temp_z3         (Zone 3 Max Temp)
  4. temp_z4         (Zone 4 Exit Pathway Max Temp)
  5. temp_diff       (temp_inside - temp_outside)
  6. mq2_val         (MQ-2 Gas reading)
  7. mq135_val       (MQ-135 Gas reading)
  8. flame_val       (IR Flame reading: 0.0 or 1.0)
  9. m1_risk_score   (M1 Isolation Forest risk context)

Outputs:
  ml/models/m2_random_forest.pkl
  ml/models/m2_scaler.pkl
"""

import pathlib
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score

BASE_DIR = pathlib.Path(__file__).parent.parent
DATA_PATH = BASE_DIR / "ml" / "data" / "synthetic_sensor_readings_v2.csv"
MODEL_DIR = BASE_DIR / "ml" / "models"

M1_MODEL_PATH  = MODEL_DIR / "m1_isolation_forest.pkl"
M1_SCALER_PATH = MODEL_DIR / "m1_scaler.pkl"

def engineer_m2_features(df: pd.DataFrame, m1_scores: np.ndarray) -> pd.DataFrame:
    """Extract M2 input features including M1 risk context."""
    temp_in  = df.get("temp_inside", 30.0)
    temp_out = df.get("temp_outside", 30.0)
    temp_diff = temp_in - temp_out

    features = pd.DataFrame({
        "temp_z1": df.get("temp_z1", 30.0),
        "temp_z2": df.get("temp_z2", 30.0),
        "temp_z3": df.get("temp_z3", 30.0),
        "temp_z4": df.get("temp_z4", 30.0),
        "temp_diff": temp_diff,
        "mq2_val": df.get("mq2_val", 2450.0),
        "mq135_val": df.get("mq135_val", 950.0),
        "flame_val": df.get("flame_val", 0.0),
        "m1_risk_score": m1_scores
    })
    return features

def derive_target_labels(df: pd.DataFrame) -> np.ndarray:
    """
    Derive ground-truth fire action targets:
      0 = LOG_ONLY         (Normal baseline)
      1 = SUPERVISOR_ALERT (Moderate warning or Exit Zone 4 hotspot)
      2 = EVACUATE         (Critical fire hazard)
    """
    labels = []
    for _, row in df.iterrows():
        state = row.get("system_state", "NORMAL")
        z4 = row.get("temp_z4", 0.0)
        flame = row.get("flame_val", 0.0)

        if state == "CRITICAL" or flame == 1.0:
            labels.append(2)  # EVACUATE
        elif state == "MODERATE" or z4 > 50.0:
            labels.append(1)  # SUPERVISOR_ALERT
        else:
            labels.append(0)  # LOG_ONLY

    return np.array(labels)

def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}. Run ml/generate_synthetic_data_v2.py first.")
    if not M1_MODEL_PATH.exists() or not M1_SCALER_PATH.exists():
        raise FileNotFoundError(f"M1 model artifacts not found in {MODEL_DIR}. Run ml/train_isolation_forest.py first.")

    print(f"[1/4] Loading dataset: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)

    # Load M1 model to calculate m1_risk_score feature
    m1_model  = joblib.load(M1_MODEL_PATH)
    m1_scaler = joblib.load(M1_SCALER_PATH)

    # Calculate M1 features & score
    temp_cols = [c for c in ["temp_z1", "temp_z2", "temp_z3", "temp_z4"] if c in df.columns]
    max_temp = df[temp_cols].max(axis=1) if temp_cols else df.get("temp_z1", 30.0)
    m1_raw = pd.DataFrame({
        "max_temp": max_temp,
        "temp_diff": df.get("temp_inside", 30.0) - df.get("temp_outside", 30.0),
        "humidity_diff": df.get("humidity_inside", 50.0) - df.get("humidity_outside", 50.0),
        "mq2_val": df.get("mq2_val", 2450.0),
        "mq135_val": df.get("mq135_val", 950.0)
    })
    m1_scaled = m1_scaler.transform(m1_raw)
    m1_raw_scores = m1_model.decision_function(m1_scaled)
    m1_scores = np.clip((0.20 - m1_raw_scores) * 160.0, 0, 100).round(1)

    print("[2/4] Engineering M2 9-feature vectors...")
    X_df = engineer_m2_features(df, m1_scores)
    y = derive_target_labels(df)

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_df)

    print("[3/4] Fitting Random Forest Classifier for M2...")
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_scaled, y)

    y_pred = rf_model.predict(X_scaled)
    acc = accuracy_score(y, y_pred)
    print(f"\n[OK] Model Training Accuracy: {acc * 100:.2f}%")
    print("\n--- Classification Report ---")
    print(classification_report(y, y_pred, target_names=["LOG_ONLY", "SUPERVISOR_ALERT", "EVACUATE"]))

    print("\n--- M2 Feature Importances ---")
    for feat, imp in sorted(zip(X_df.columns, rf_model.feature_importances_), key=lambda x: x[1], reverse=True):
        print(f"  {feat:15s}: {imp * 100:5.2f}%")

    # Save M2 artifacts
    m2_model_path  = MODEL_DIR / "m2_random_forest.pkl"
    m2_scaler_path = MODEL_DIR / "m2_scaler.pkl"

    joblib.dump(rf_model, m2_model_path)
    joblib.dump(scaler, m2_scaler_path)

    print(f"\n[4/4] [OK] Saved M2 Model to:  {m2_model_path}")
    print(f"      [OK] Saved M2 Scaler to: {m2_scaler_path}")

if __name__ == "__main__":
    main()
