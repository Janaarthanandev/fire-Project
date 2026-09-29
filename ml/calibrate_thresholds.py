"""
calibrate_thresholds.py — Calibrate IF_THRESHOLD_OFFSET and IF_SCALE_FACTOR.

After training the Isolation Forest, this script:
1. Loads the trained models
2. Scores the held-out normal data → gets the "safe" anomaly score distribution
3. Scores the 5 PRD test scenarios → gets the "risk" anomaly scores
4. Computes calibrated offset and scale so:
     - Normal data maps to risk_score ~0–30 (Safe tier)
     - Scenario 3 (high_risk) maps to risk_score ~70+ (Dangerous tier)
5. Prints the values to paste into backend/config.py

Usage:
  python ml/calibrate_thresholds.py
"""

import joblib
import numpy as np
import pandas as pd
from pathlib import Path

ML_DIR    = Path(__file__).parent
DATA_DIR  = ML_DIR / "data"
MODEL_DIR = ML_DIR.parent / "backend" / "models"

FEATURE_COLS = [
    "zone_thermal_avg",
    "zone_thermal_trend",
    "humidity",
    "gas_level",
    "gas_baseline_drift",
]

# PRD test scenarios — feature values for calibration reference points
REFERENCE_SCENARIOS = {
    "normal":    [33.0, 0.2,  60.0, 80.0,  2.0 ],   # → should score Safe (~10-25)
    "moderate":  [40.5, 1.5,  38.0, 160.0, 35.0],   # → should score Moderate (~40-65)
    "high_risk": [44.0, 2.8,  34.0, 210.0, 55.0],   # → should score Dangerous (~70+)
    "hotspot":   [52.0, 6.0,  45.0, 180.0, 40.0],   # → should score Dangerous (high)
    "active_fire":[68.0, 12.0, 40.0, 380.0, 200.0], # → should score Dangerous (max)
}


def load_model(zone: str, version: str = "v1"):
    model_name = f"m1_{zone.lower().replace('_fill','').replace('zone_','zone')}_{version}.joblib"
    model_path = MODEL_DIR / model_name
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}\nRun train_isolation_forest.py first.")
    return joblib.load(model_path)


def compute_risk_score(raw_score: float, offset: float, scale: float) -> float:
    return float(np.clip(((-raw_score - offset) / scale) * 100, 0, 100))


def calibrate_zone(zone: str, version: str = "v1") -> dict:
    print(f"\n-- Calibrating {zone} ------------------------------")
    model = load_model(zone, version)

    # Score held-out normal data (last 20% of synthetic dataset)
    zone_short = zone.lower().replace("_fill", "").replace("zone_", "zone")
    data_file = DATA_DIR / f"synthetic_normal_{zone_short}.csv"
    combined_file = DATA_DIR / "synthetic_normal_all.csv"

    if data_file.exists():
        df = pd.read_csv(data_file)
    else:
        df_all = pd.read_csv(combined_file)
        df = df_all[df_all["zone"] == zone].copy()

    X = df[FEATURE_COLS].values
    split_idx = int(len(X) * 0.8)
    X_val = X[split_idx:]

    normal_scores = model.score_samples(X_val)
    score_mean = float(np.mean(normal_scores))
    score_std  = float(np.std(normal_scores))
    score_p10  = float(np.percentile(normal_scores, 10))   # 90% of normal below this risk
    score_p95  = float(np.percentile(normal_scores, 95))   # very safe normal readings

    print(f"  Normal data anomaly scores:")
    print(f"    mean={score_mean:.4f}  std={score_std:.4f}  p10={score_p10:.4f}  p95={score_p95:.4f}")

    # Calibration: we want normal p95 → risk_score ~25 (well within Safe tier)
    # And normal p10 → risk_score ~35 (still Safe)
    # This means the offset should be around score_p95 (negative value)
    # and scale should spread the range meaningfully

    # offset = abs(score_p95)  → at normal p95 score, numerator is ~0 → risk_score ~0
    # scale = abs(score_p10 - score_p95) * 2  → gives enough range
    threshold_offset = abs(score_p95)
    scale_factor = max(abs(score_p10 - score_p95) * 2, 0.05)  # prevent division by near-zero

    print(f"\n  Calibrated parameters:")
    print(f"    IF_THRESHOLD_OFFSET = {threshold_offset:.6f}")
    print(f"    IF_SCALE_FACTOR     = {scale_factor:.6f}")

    # Verify reference scenarios against calibrated thresholds
    print(f"\n  Reference scenario scores:")
    for scenario_name, features in REFERENCE_SCENARIOS.items():
        x = np.array([features])
        raw = float(model.score_samples(x)[0])
        mapped = compute_risk_score(raw, threshold_offset, scale_factor)
        tier = "Safe" if mapped <= 39 else ("Moderate" if mapped <= 69 else "Dangerous")
        print(f"    {scenario_name:20s}  raw={raw:.4f}  risk_score={mapped:.1f}  tier={tier}")

    return {
        "zone": zone,
        "threshold_offset": threshold_offset,
        "scale_factor": scale_factor,
    }


def main():
    print("M1 Isolation Forest — Threshold Calibration")
    print("=" * 55)

    results = []
    for zone in ["Zone_1_Fill", "Zone_2_Fill", "Zone_3_Fill"]:
        try:
            r = calibrate_zone(zone)
            results.append(r)
        except FileNotFoundError as e:
            print(f"\n  [Error] {e}")
            return

    # Print the values to paste into config.py
    # Use the average across zones (they should be similar since data is symmetric)
    avg_offset = np.mean([r["threshold_offset"] for r in results])
    avg_scale  = np.mean([r["scale_factor"]     for r in results])

    print("\n" + "=" * 55)
    print("PASTE THESE VALUES INTO backend/config.py:")
    print("=" * 55)
    print(f"IF_THRESHOLD_OFFSET = {avg_offset:.6f}")
    print(f"IF_SCALE_FACTOR     = {avg_scale:.6f}")
    print("=" * 55)
    print("\n[OK] Calibration complete. Update config.py and restart the backend.")


if __name__ == "__main__":
    main()
