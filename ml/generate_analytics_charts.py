"""
generate_analytics_charts.py — Python past-activity analytics generator.

Generates 3 comprehensive analytical plots from Supabase risk_scores history
and saves them directly into dashboard/public/analytics/:
  1. risk_trend_24h.png          — Multi-zone risk score time series curve
  2. feature_correlation.png     — Feature correlation matrix vs risk score
  3. anomaly_distribution.png    — Isolation Forest score distribution density
"""

import os
import sys
import pathlib
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

# Fix path to load backend modules
BASE_DIR = pathlib.Path(__file__).parent.parent
sys.path.append(str(BASE_DIR / "backend"))

from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")

from supabase_client import get_client
import config as C

OUTPUT_DIR = BASE_DIR / "dashboard" / "public" / "analytics"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Dark glassmorphism chart styling
plt.style.use('dark_background')
BG_COLOR = '#0e1217'
CARD_BG = '#161b22'
TEXT_COLOR = '#e6edf3'
GRID_COLOR = '#21262d'

plt.rcParams.update({
    'figure.facecolor': BG_COLOR,
    'axes.facecolor': CARD_BG,
    'savefig.facecolor': BG_COLOR,
    'text.color': TEXT_COLOR,
    'axes.labelcolor': TEXT_COLOR,
    'xtick.color': TEXT_COLOR,
    'ytick.color': TEXT_COLOR,
    'grid.color': GRID_COLOR,
    'font.sans-serif': 'Inter, sans-serif',
    'font.family': 'sans-serif',
})


def fetch_all_risk_scores(limit: int = 500) -> pd.DataFrame:
    """Fetch recent risk score records from Supabase."""
    client = get_client()
    response = (
        client.table("risk_scores")
        .select("*")
        .eq("godown_id", C.GODOWN_ID)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    data = response.data or []
    if not data:
        # Fallback synthetic dataset for initial display
        np.random.seed(42)
        dates = pd.date_range(end=pd.Timestamp.now(), periods=100, freq="15min")
        records = []
        for zone in C.M1_ZONES:
            base_risk = np.random.uniform(5, 25, size=100)
            records.extend([
                {
                    "created_at": d.isoformat(),
                    "zone": zone,
                    "risk_score": r,
                    "risk_tier": "Safe" if r < 40 else "Moderate",
                    "anomaly_score_raw": -0.4 - (r / 200),
                    "zone_thermal_avg": 32 + (r / 5),
                    "zone_thermal_trend": (r / 30),
                    "humidity": 60 - (r / 4),
                    "gas_level": 80 + r,
                    "gas_baseline_drift": r / 2,
                }
                for d, r in zip(dates, base_risk)
            ])
        return pd.DataFrame(records)

    df = pd.DataFrame(data)
    df["created_at"] = pd.to_datetime(df["created_at"])
    return df


def plot_risk_trend_24h(df: pd.DataFrame) -> None:
    """Plot multi-zone risk score time series."""
    fig, ax = plt.subplots(figsize=(10, 4.5), dpi=150)
    
    colors = {
        "Zone_1_Fill": "#3b82f6",
        "Zone_2_Fill": "#f59e0b",
        "Zone_3_Fill": "#10b981",
    }
    
    for zone in C.M1_ZONES:
        zone_df = df[df["zone"] == zone].sort_values("created_at")
        if not zone_df.empty:
            ax.plot(
                zone_df["created_at"],
                zone_df["risk_score"],
                label=zone.replace("_", " "),
                color=colors.get(zone, "#6366f1"),
                linewidth=2,
                marker="o",
                markersize=4,
                alpha=0.9
            )
            
    ax.axhline(C.TIER_SAFE_MAX, color="#10b981", linestyle="--", alpha=0.5, label="Safe Threshold (39)")
    ax.axhline(C.TIER_MODERATE_MAX, color="#ef4444", linestyle="--", alpha=0.5, label="Dangerous Threshold (70)")
    
    ax.set_ylim(0, 105)
    ax.set_title("M1 Pre-Ignition Risk Evolution Over Time", fontsize=14, fontweight="semibold", pad=12)
    ax.set_ylabel("Risk Score (0 - 100)", fontsize=11)
    ax.set_xlabel("Timestamp", fontsize=11)
    ax.grid(True, linestyle=":", alpha=0.6)
    ax.legend(frameon=True, facecolor=CARD_BG, edgecolor=GRID_COLOR, loc="upper right")
    
    plt.tight_layout()
    out_path = OUTPUT_DIR / "risk_trend_24h.png"
    plt.savefig(out_path)
    plt.close()
    print(f"[OK] Saved: {out_path}")


def plot_feature_correlation(df: pd.DataFrame) -> None:
    """Plot correlation heatmap between input features and risk score."""
    cols = ["risk_score", "zone_thermal_avg", "zone_thermal_trend", "humidity", "gas_level", "gas_baseline_drift"]
    valid_cols = [c for c in cols if c in df.columns]
    
    if len(valid_cols) < 2:
        return

    corr = df[valid_cols].corr()
    
    fig, ax = plt.subplots(figsize=(8, 5.5), dpi=150)
    sns.heatmap(
        corr,
        annot=True,
        fmt=".2f",
        cmap="mako",
        cbar=True,
        ax=ax,
        linewidths=1,
        linecolor=BG_COLOR,
        square=True
    )
    ax.set_title("Feature Correlation Matrix vs M1 Risk Score", fontsize=13, fontweight="semibold", pad=12)
    
    plt.tight_layout()
    out_path = OUTPUT_DIR / "feature_correlation.png"
    plt.savefig(out_path)
    plt.close()
    print(f"[OK] Saved: {out_path}")


def plot_anomaly_distribution(df: pd.DataFrame) -> None:
    """Plot Isolation Forest raw anomaly score density distribution."""
    fig, ax = plt.subplots(figsize=(8, 4), dpi=150)
    
    if "anomaly_score_raw" in df.columns and not df["anomaly_score_raw"].isna().all():
        scores = df["anomaly_score_raw"].dropna()
        sns.histplot(scores, kde=True, color="#6366f1", ax=ax, bins=25)
        ax.axvline(x=-0.401389, color="#ef4444", linestyle="--", label="Offset Threshold (-0.4014)")
    else:
        ax.text(0.5, 0.5, "No Anomaly Data Available Yet", ha="center", va="center")

    ax.set_title("Isolation Forest Anomaly Score Distribution", fontsize=13, fontweight="semibold", pad=12)
    ax.set_xlabel("Raw Anomaly Score (Lower = More Anomalous)", fontsize=11)
    ax.set_ylabel("Reading Count", fontsize=11)
    ax.grid(True, linestyle=":", alpha=0.5)
    
    plt.tight_layout()
    out_path = OUTPUT_DIR / "anomaly_distribution.png"
    plt.savefig(out_path)
    plt.close()
    print(f"[OK] Saved: {out_path}")


def main():
    print("\n-> Generating Python Past-Activity Analytics Charts...")
    df = fetch_all_risk_scores(limit=500)
    plot_risk_trend_24h(df)
    plot_feature_correlation(df)
    plot_anomaly_distribution(df)
    print("\n[OK] All Python analytics charts generated successfully.")


if __name__ == "__main__":
    main()
