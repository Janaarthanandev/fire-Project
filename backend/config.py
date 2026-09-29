"""
config.py — Single source of truth for all M1 constants.
All weights, thresholds, zone names, and tunable parameters live here.
Never hardcode these values in business logic.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# SUPABASE
# ─────────────────────────────────────────────
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY: str = os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# ─────────────────────────────────────────────
# GODOWN IDENTITY
# ─────────────────────────────────────────────
GODOWN_ID: str = os.getenv("GODOWN_ID", "godown_filling_01")

# ─────────────────────────────────────────────
# ZONES
# M1 scores only fill zones — Zone_4_Exit is never scored
# ─────────────────────────────────────────────
M1_ZONES: list[str] = ["Zone_1_Fill", "Zone_2_Fill", "Zone_3_Fill"]
ALL_ZONES: list[str] = ["Zone_1_Fill", "Zone_2_Fill", "Zone_3_Fill", "Zone_4_Exit"]

# ─────────────────────────────────────────────
# M1 INFERENCE CYCLE
# ─────────────────────────────────────────────
M1_CYCLE_SECONDS: int = int(os.getenv("M1_CYCLE_SECONDS", "15"))

# ─────────────────────────────────────────────
# FRAME SMOOTHING (Phase 4 hardware)
# ─────────────────────────────────────────────
FRAME_SMOOTH_WINDOW: int = int(os.getenv("FRAME_SMOOTH_WINDOW", "3"))

# ─────────────────────────────────────────────
# ROLLING WINDOWS (Phase 2 feature engineering)
# ─────────────────────────────────────────────
THERMAL_TREND_WINDOW_N: int = int(os.getenv("THERMAL_TREND_WINDOW_N", "5"))
GAS_DRIFT_WINDOW_K: int = int(os.getenv("GAS_DRIFT_WINDOW_K", "30"))

# ─────────────────────────────────────────────
# RULE-BASED M1 FORMULA WEIGHTS
# w1 + w2 + w3 must equal 1.0
# Domain reasoning: thermal trend is the most direct pre-ignition signal,
# humidity second, gas baseline drift third.
# ─────────────────────────────────────────────
W_THERMAL_TREND: float = 0.40
W_HUMIDITY: float = 0.35
W_GAS_DRIFT: float = 0.25

assert abs(W_THERMAL_TREND + W_HUMIDITY + W_GAS_DRIFT - 1.0) < 1e-9, \
    "M1 formula weights must sum to 1.0"

# ─────────────────────────────────────────────
# NORMALIZATION BOUNDS for rule-based formula
# ─────────────────────────────────────────────
THERMAL_TREND_MIN: float = 0.0    # °C/cycle — flat baseline
THERMAL_TREND_MAX: float = 5.0    # °C/cycle — strong sustained rise

# Humidity risk: lower humidity = higher risk → use 1/humidity
# Sivakasi safe range 40–70% RH
HUMIDITY_INV_MIN: float = 1 / 70  # safest (high humidity)
HUMIDITY_INV_MAX: float = 1 / 34  # most dangerous (very low humidity)

GAS_DRIFT_MIN: float = 0.0        # ppm-equivalent — no drift from baseline
GAS_DRIFT_MAX: float = 60.0       # ppm-equivalent — significant drift

# ─────────────────────────────────────────────
# ISOLATION FOREST CALIBRATION (filled after Phase 2)
# These values are updated post-training — do not invent them.
# ─────────────────────────────────────────────
IF_THRESHOLD_OFFSET: float = 0.401389   # calibrated from synthetic dataset
IF_SCALE_FACTOR: float     = 0.255643   # calibrated from synthetic dataset

# ─────────────────────────────────────────────
# RISK TIER BOUNDARIES
# ─────────────────────────────────────────────
TIER_SAFE_MAX: int = 39      # 0–39 → Safe (green)
TIER_MODERATE_MAX: int = 69  # 40–69 → Moderate (amber)
                              # 70–100 → Dangerous (red)

# ─────────────────────────────────────────────
# STAGE 1 HOTSPOT THRESHOLDS (triggers M2, not M1)
# Documented here so backend can log Stage 1 flags
# ─────────────────────────────────────────────
HOTSPOT_TEMP_THRESHOLD: float = 50.0   # °C — 10°C above Sivakasi max ambient
HOTSPOT_RISE_THRESHOLD: float = 3.0    # °C/cycle — no natural drift produces this

# ─────────────────────────────────────────────
# EDGE FAILSAFE THRESHOLDS (Hardware autonomous trip)
# Requires simultaneous confirmation from all 3 sensors
# ─────────────────────────────────────────────
EDGE_THERMAL_THRESHOLD: float = 65.0   # °C — 25°C above Sivakasi max ambient (40°C)
EDGE_FLAME_THRESHOLD: float   = 0.70   # IR flame sensor ratio (>0.70)
EDGE_GAS_THRESHOLD: float     = 280.0  # PPM gas concentration (>280 PPM)

# ─────────────────────────────────────────────
# M2 ACTION THRESHOLDS & PRE-RELEASE DELAY
# ─────────────────────────────────────────────
M2_LOG_THRESHOLD: float          = 40.0   # % confidence (supervisor alert threshold)
M2_EVACUATE_THRESHOLD: float     = 75.0   # % confidence (full evacuation threshold)
PRE_RELEASE_DELAY_SECONDS: int   = 7      # mandatory delay before powder servo release

# ─────────────────────────────────────────────
# M1 MODERATE RISK ZONE (early-warning range)
# ─────────────────────────────────────────────
MODERATE_ZONE_LOWER: float = 38.0  # °C zone avg
MODERATE_ZONE_UPPER: float = 42.0  # °C zone avg

# ─────────────────────────────────────────────
# BACKEND SERVER
# ─────────────────────────────────────────────
BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))

# ─────────────────────────────────────────────
# MODEL FILE PATHS
# ─────────────────────────────────────────────
import pathlib

MODELS_DIR = pathlib.Path(__file__).parent / "models"
MODEL_PATHS: dict[str, pathlib.Path] = {
    "Zone_1_Fill": MODELS_DIR / "m1_zone1_v1.joblib",
    "Zone_2_Fill": MODELS_DIR / "m1_zone2_v1.joblib",
    "Zone_3_Fill": MODELS_DIR / "m1_zone3_v1.joblib",
}
