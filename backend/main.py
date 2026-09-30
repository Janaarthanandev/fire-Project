"""
main.py — FastAPI backend for FireGuard Cascaded AI Safety System (M1 + M2).

Responsibilities:
  1. Subscribe to Supabase real-time on the sensor_readings table.
  2. On every new row:
     a) Extract M1 features -> score via Isolation Forest -> insert into risk_scores.
     b) If M1 risk >= 50 or system_state == 'MODERATE' or temp >= 50°C:
        Invoke Model 2 (M2 Random Forest Classifier) -> insert into fire_events & commands_log.
  3. Expose REST endpoints including /api/telemetry for direct ESP32 hardware telemetry & immediate command response.
"""

import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Dict, Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

import os
import pathlib
import sys

BASE_DIR = pathlib.Path(__file__).parent
sys.path.append(str(BASE_DIR))

import config as C
from feature_extractor import extract_m1_features
from m1_scorer import score_zone, map_risk_tier
from m2_inference import run_m2_inference
from supabase_client import get_client, get_async_client, insert_row, fetch_latest_rows

# ── Logging setup ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("m1_m2_backend")

PROCESSED_SENSOR_IDS: set[str] = set()

async def process_sensor_row(row: dict) -> Dict[str, Any]:
    """
    Full Cascaded AI Pipeline for a single sensor_readings row.
    Step 1: Run M1 Isolation Forest -> Risk Score (0-100) & Tier
    Step 2: If M1 Risk >= 50 or State == MODERATE or Temp >= 50°C -> Run M2 Random Forest Classifier
    """
    temp_z1 = float(row.get("temp_z1", 30.0))
    temp_z2 = float(row.get("temp_z2", 30.0))
    temp_z3 = float(row.get("temp_z3", 30.0))
    temp_z4 = float(row.get("temp_z4", 30.0))
    max_temp = max(temp_z1, temp_z2, temp_z3, temp_z4)

    features = extract_m1_features(row)
    if features is None:
        features = {"max_temp": max_temp, "temp_diff": 0.0, "humidity_diff": 0.0, "mq2_val": 2450.0, "mq135_val": 950.0}

    # Step 1: Model 1 Isolation Forest Anomaly Scoring
    risk_score, risk_tier, anomaly_score_raw = score_zone(features)

    # Zone origin
    zone_temps = {"Zone_1_Fill": temp_z1, "Zone_2_Fill": temp_z2, "Zone_3_Fill": temp_z3, "Zone_4_Exit": temp_z4}
    primary_zone = max(zone_temps, key=zone_temps.get)

    risk_record = {
        "godown_id": C.GODOWN_ID,
        "zone": primary_zone,
        "risk_score": risk_score,
        "risk_tier": risk_tier,
        "anomaly_score_raw": anomaly_score_raw,
        "zone_thermal_avg": max_temp,
        "zone_thermal_trend": 0.0,
        "humidity": features.get("humidity_diff", 50.0),
        "gas_level": features.get("mq2_val", 100.0),
        "gas_baseline_drift": features.get("mq2_val", 100.0),
        "thermal_grid": row.get("thermal_grid")
    }

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, insert_row, "risk_scores", risk_record)
    logger.info(f"[M1_SCORE] Zone: {primary_zone} | Risk Score: {risk_score} | Tier: {risk_tier}")

    m2_result = None
    system_state = row.get("system_state", "NORMAL")

    # Step 2: Model 2 Cascade Execution if M1 Risk >= 50 or Temp >= 50°C or State == MODERATE
    if risk_score >= 50.0 or max_temp >= 50.0 or system_state in ["MODERATE", "CRITICAL"]:
        logger.warning(f"[CASCADE_TRIGGER] Hotspot detected in {primary_zone} (Temp: {max_temp}°C, M1 Risk: {risk_score}). Invoking Model 2...")
        m2_result = await loop.run_in_executor(None, run_m2_inference, row, risk_score)
        logger.info(f"[M2_RESULT] Action: {m2_result['command']} | Confidence: {m2_result['confidence']}% | Powder Targets: {m2_result['powder_zones']}")

    return {
        "status": "ok",
        "m1_risk_score": risk_score,
        "m1_risk_tier": risk_tier,
        "m2_result": m2_result
    }

async def process_sensor_row_idempotent(row: dict) -> None:
    row_id = row.get("id")
    if row_id and row_id in PROCESSED_SENSOR_IDS:
        return
    if row_id:
        PROCESSED_SENSOR_IDS.add(row_id)
        if len(PROCESSED_SENSOR_IDS) > 5000:
            to_remove = set(list(PROCESSED_SENSOR_IDS)[:2000])
            PROCESSED_SENSOR_IDS.difference_update(to_remove)
    await process_sensor_row(row)

async def _start_realtime_listener() -> None:
    logger.info("Connecting to Supabase real-time publication for sensor_readings...")
    try:
        client = await get_async_client()
        channel = client.channel("backend_sensor_readings_realtime")
        if hasattr(channel, "on_postgres_changes"):
            channel.on_postgres_changes(
                event="INSERT",
                schema="public",
                table="sensor_readings",
                callback=lambda payload: asyncio.create_task(process_sensor_row_idempotent(payload.get("new", {})))
            )
            await channel.subscribe()
            logger.info("[OK] Real-time subscription active on sensor_readings.")
        else:
            logger.info("Real-time 'on' attribute not supported in this client version — relying on 3s polling worker.")
    except Exception as exc:
        logger.info(f"Real-time listener notice: {exc} — background polling worker active.")

async def _start_polling_fallback() -> None:
    logger.info("Starting background polling worker...")
    loop = asyncio.get_running_loop()
    while True:
        try:
            rows = await loop.run_in_executor(
                None, fetch_latest_rows, "sensor_readings", "Zone_1_Fill", C.GODOWN_ID, 5
            )
            for row in reversed(rows or []):
                if row.get("id") not in PROCESSED_SENSOR_IDS:
                    await process_sensor_row_idempotent(row)
        except Exception as exc:
            pass
        await asyncio.sleep(3.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FireGuard M1/M2 Backend Starting Up...")
    asyncio.create_task(_start_realtime_listener())
    asyncio.create_task(_start_polling_fallback())
    yield
    logger.info("FireGuard Backend Shutting Down.")

app = FastAPI(
    title="FireGuard Cascaded AI Backend (M1 + M2)",
    description="IoT-based pre-ignition and fire safety system",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "godown_id": C.GODOWN_ID,
        "utc_time": datetime.now(timezone.utc).isoformat(),
    }

@app.post("/api/telemetry")
async def receive_hardware_telemetry(payload: dict):
    """
    Direct REST telemetry endpoint for ESP32 hardware.
    Receives raw sensor readings, runs M1 + M2 cascade, and returns immediate action response.
    """
    result = await process_sensor_row(payload)
    return result

@app.get("/risk-scores/latest")
async def latest_risk_scores():
    loop = asyncio.get_running_loop()
    rows = await loop.run_in_executor(None, fetch_latest_rows, "risk_scores", "Zone_1_Fill", C.GODOWN_ID, 5)
    return rows or []

@app.post("/api/m2-evaluate")
async def evaluate_m2_event(event_data: dict):
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, run_m2_inference, event_data)
    return result

if __name__ == "__main__":
    uvicorn.run("main:app", host=C.BACKEND_HOST, port=C.BACKEND_PORT, reload=True)
