"""
generate_synthetic_data.py — Synthetic normal-operation dataset generator.

Simulates 7 days of continuous AMG8833 + DHT22 + gas sensor readings
under normal Sivakasi operating conditions for all three fill zones.

Based on documented climate data:
  - Sivakasi natural ambient: 25–40°C (max)
  - Safe operating humidity: 40–70% RH (per industry standard)
  - Preferred safe hours: 6 a.m.–9 a.m. (lowest temp + chemical reactivity)

Used to train the Phase 2 Isolation Forest before real hardware is deployed.
When real hardware data is available, retrain using ml/train_isolation_forest.py
on the real sensor_readings table export (will be labelled v2).

Output:
  ml/data/synthetic_normal_zone1.csv
  ml/data/synthetic_normal_zone2.csv
  ml/data/synthetic_normal_zone3.csv
  ml/data/synthetic_normal_all.csv   (combined, for inspection)

Usage:
  python ml/generate_synthetic_data.py
"""

import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone, timedelta

# ── Output directory ───────────────────────────────────────────────────────
OUTPUT_DIR = Path(__file__).parent / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Simulation parameters ──────────────────────────────────────────────────
RANDOM_SEED       = 42
CYCLE_SECONDS     = 15          # one reading every 15 seconds
DAYS              = 7           # simulate 7 days
TOTAL_CYCLES      = (DAYS * 24 * 3600) // CYCLE_SECONDS   # 40,320 readings per zone

ZONES = ["Zone_1_Fill", "Zone_2_Fill", "Zone_3_Fill"]
GODOWN_ID = "godown_filling_01"

# ── Zone-specific normal baselines (slight variation between zones) ─────────
# Real zones differ slightly due to ventilation and proximity to door/window
ZONE_PROFILES = {
    "Zone_1_Fill": {
        "temp_base": 33.0,    # °C — slightly warmer, less ventilation
        "temp_noise": 1.8,
        "humidity_base": 55.0,
        "humidity_noise": 4.5,
        "gas_base": 85.0,     # ppm-equivalent baseline
        "gas_noise": 6.0,
    },
    "Zone_2_Fill": {
        "temp_base": 31.5,
        "temp_noise": 1.6,
        "humidity_base": 57.0,
        "humidity_noise": 4.0,
        "gas_base": 80.0,
        "gas_noise": 5.5,
    },
    "Zone_3_Fill": {
        "temp_base": 32.0,
        "temp_noise": 1.7,
        "humidity_base": 56.0,
        "humidity_noise": 4.2,
        "gas_base": 82.0,
        "gas_noise": 5.8,
    },
}


def simulate_diurnal_temp(t_seconds: np.ndarray, base: float, noise_std: float) -> np.ndarray:
    """
    Simulate realistic diurnal (day-night) temperature cycle.
    Sivakasi peaks around 14:00 local time; pre-dawn is coolest.
    Workers operate 6 a.m.–9 a.m. — capturing the cool-hour profile.
    """
    # Hour of day (0–24)
    hour_of_day = (t_seconds % 86400) / 3600

    # Diurnal sine wave: peak at 14:00, trough at 4:00
    # Amplitude ±5°C around the base (Sivakasi range is wide)
    diurnal = 5.0 * np.sin(2 * np.pi * (hour_of_day - 4) / 24)

    # Very slow multi-day drift (±1°C over the week — normal seasonal variation)
    multi_day = 0.5 * np.sin(2 * np.pi * t_seconds / (7 * 86400))

    # Gaussian noise (sensor + environment)
    noise = np.random.normal(0, noise_std, size=len(t_seconds))

    temp = base + diurnal + multi_day + noise

    # Clip to physically plausible Sivakasi range
    return np.clip(temp, 25.0, 42.0)


def simulate_humidity(t_seconds: np.ndarray, base: float, noise_std: float) -> np.ndarray:
    """
    Simulate godown humidity — inversely correlated with temperature
    (higher temp → lower RH, with added noise and slow drift).
    """
    hour_of_day = (t_seconds % 86400) / 3600

    # Humidity rises at night (cooler), drops during day (hotter)
    diurnal = -4.0 * np.sin(2 * np.pi * (hour_of_day - 4) / 24)
    noise = np.random.normal(0, noise_std, size=len(t_seconds))

    humidity = base + diurnal + noise
    return np.clip(humidity, 40.0, 72.0)


def simulate_gas_level(t_seconds: np.ndarray, base: float, noise_std: float) -> np.ndarray:
    """
    Simulate gas sensor readings — slow random walk around baseline
    with minor ventilation-driven variation during working hours (6–18h).
    """
    hour_of_day = (t_seconds % 86400) / 3600

    # Slight increase during working hours (composition handling)
    work_hours = np.where((hour_of_day >= 6) & (hour_of_day <= 18), 8.0, 0.0)
    noise = np.random.normal(0, noise_std, size=len(t_seconds))

    # Slow Brownian drift (not a spike — this is the baseline wandering)
    drift = np.cumsum(np.random.normal(0, 0.05, size=len(t_seconds)))
    drift = np.clip(drift, -10, 10)   # keep drift bounded

    gas = base + work_hours + drift + noise
    return np.clip(gas, 55.0, 115.0)


def compute_thermal_trend(thermal_avg: np.ndarray, window_n: int = 5) -> np.ndarray:
    """
    Compute zone_thermal_trend = thermal_avg[t] - thermal_avg[t - N].
    First N values default to 0.0 (no prior history).
    """
    trend = np.zeros(len(thermal_avg))
    for i in range(window_n, len(thermal_avg)):
        trend[i] = thermal_avg[i] - thermal_avg[i - window_n]
    return trend


def compute_gas_baseline_drift(gas_level: np.ndarray, window_k: int = 30) -> np.ndarray:
    """
    Compute gas_baseline_drift = gas_level[t] - rolling_mean(gas_level, K).
    First K values default to 0.0.
    """
    drift = np.zeros(len(gas_level))
    for i in range(window_k, len(gas_level)):
        rolling_mean = np.mean(gas_level[i - window_k:i])
        drift[i] = gas_level[i] - rolling_mean
    return drift


def generate_zone_dataset(zone: str, rng: np.random.Generator) -> pd.DataFrame:
    """Generate a full 7-day dataset for one fill zone."""
    profile = ZONE_PROFILES[zone]

    # Time axis: seconds since start
    t = np.arange(TOTAL_CYCLES) * CYCLE_SECONDS

    # Timestamps (UTC, starting from a representative weekday morning)
    start_time = datetime(2026, 8, 25, 6, 0, 0, tzinfo=timezone.utc)
    timestamps = [start_time + timedelta(seconds=int(ts)) for ts in t]

    # Simulate raw sensor signals
    thermal_avg = simulate_diurnal_temp(t, profile["temp_base"], profile["temp_noise"])
    humidity     = simulate_humidity(t, profile["humidity_base"], profile["humidity_noise"])
    gas_level    = simulate_gas_level(t, profile["gas_base"], profile["gas_noise"])

    # Derived features
    zone_thermal_trend  = compute_thermal_trend(thermal_avg, window_n=5)
    gas_baseline_drift  = compute_gas_baseline_drift(gas_level, window_k=30)

    df = pd.DataFrame({
        "timestamp":          timestamps,
        "godown_id":          GODOWN_ID,
        "zone":               zone,
        "zone_thermal_avg":   np.round(thermal_avg, 3),
        "zone_thermal_trend": np.round(zone_thermal_trend, 4),
        "humidity":           np.round(humidity, 3),
        "gas_level":          np.round(gas_level, 3),
        "gas_baseline_drift": np.round(gas_baseline_drift, 4),
    })

    return df


def main():
    print(f"Generating {DAYS}-day synthetic normal-operation dataset")
    print(f"  Zones : {ZONES}")
    print(f"  Cycles: {TOTAL_CYCLES:,} per zone  ({CYCLE_SECONDS}s interval)")
    print(f"  Total : {TOTAL_CYCLES * len(ZONES):,} rows\n")

    rng = np.random.default_rng(RANDOM_SEED)
    all_dfs = []

    for zone in ZONES:
        print(f"  Generating {zone}...", end=" ", flush=True)
        df = generate_zone_dataset(zone, rng)

        # Save per-zone CSV
        out_path = OUTPUT_DIR / f"synthetic_normal_{zone.lower().replace('_fill','').replace('zone_','zone')}.csv"
        df.to_csv(out_path, index=False)
        all_dfs.append(df)
        print(f"  OK  {len(df):,} rows -> {out_path.name}")

    # Save combined CSV
    combined = pd.concat(all_dfs, ignore_index=True)
    combined_path = OUTPUT_DIR / "synthetic_normal_all.csv"
    combined.to_csv(combined_path, index=False)
    print(f"\n  Combined -> {combined_path.name}  ({len(combined):,} rows total)")

    # Quick sanity stats
    print("\n-- Feature ranges (sanity check) ----------------------")
    for col in ["zone_thermal_avg", "zone_thermal_trend", "humidity", "gas_level", "gas_baseline_drift"]:
        print(f"  {col:28s}  min={combined[col].min():.2f}  max={combined[col].max():.2f}  mean={combined[col].mean():.2f}")

    print("\nDone! Dataset ready. Run ml/train_isolation_forest.py next.")


if __name__ == "__main__":
    np.random.seed(RANDOM_SEED)
    main()
