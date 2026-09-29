-- ============================================================
-- Supabase Schema — Smart Fire Safety System for Sivakasi Godowns
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- TABLE 1: sensor_readings
-- Raw sensor data inserted every cycle by ESP32 / test_input.py
-- Both M1 and M2 read from this table
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sensor_readings (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  godown_id               TEXT NOT NULL,
  zone                    TEXT NOT NULL,

  -- AMG8833 derived (M1 uses thermal_avg + thermal_trend; M2 uses thermal_max)
  thermal_max             FLOAT,
  thermal_avg             FLOAT,
  thermal_trend           FLOAT,
  thermal_grid            FLOAT[],              -- 8x8 IR thermal matrix (64 pixels)

  -- DHT22 (Inside working area & Outside ambient reference)
  humidity                FLOAT,                -- Legacy / Inside humidity
  humidity_inside         FLOAT,
  humidity_outside        FLOAT,
  humidity_differential   FLOAT,                -- inside minus outside differential

  -- Gas Sensors (MQ-2 combustible + MQ-135 VOC per zone)
  gas_level               FLOAT,                -- Combined / Legacy gas level
  mq2_level               FLOAT,
  mq135_level             FLOAT,
  gas_baseline_drift      FLOAT,

  -- M2-specific fast-event sensors (not used by M1)
  flame_reading           FLOAT,
  gas_ppm                 FLOAT,
  gas_roc                 FLOAT,
  vibration               FLOAT
);

-- ──────────────────────────────────────────────────────────
-- TABLE 2: risk_scores
-- M1 output — one row per fill zone per inference cycle
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_scores (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  godown_id               TEXT NOT NULL,
  zone                    TEXT NOT NULL,

  risk_score              FLOAT NOT NULL,
  risk_tier               TEXT NOT NULL,        -- 'Safe' | 'Moderate' | 'Dangerous'
  anomaly_score_raw       FLOAT,                -- raw IF output (null in Phase 1 rule-based)

  -- Contributing features (stored for post-incident analysis and dashboard display)
  zone_thermal_avg        FLOAT,
  zone_thermal_trend      FLOAT,
  humidity                FLOAT,
  humidity_differential   FLOAT,
  gas_level               FLOAT,
  gas_baseline_drift      FLOAT,
  thermal_grid            FLOAT[]               -- 8x8 IR thermal matrix (64 pixels)
);

-- ──────────────────────────────────────────────────────────
-- TABLE 3: fire_events
-- M2 output — written only when Stage 1 detects a hotspot
-- M1 does NOT write to this table
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_events (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  godown_id               TEXT NOT NULL,
  fire_zone               TEXT NOT NULL,
  confidence              FLOAT NOT NULL,
  action_taken            TEXT NOT NULL,
  triggered_by            TEXT DEFAULT 'M2',    -- 'M2' | 'edge'
  edge_triggered          BOOLEAN DEFAULT FALSE,
  m2_agreement            BOOLEAN DEFAULT TRUE,
  powder_released         BOOLEAN DEFAULT FALSE,
  powder_zones            TEXT[],
  thermal_max_at_event    FLOAT,

  -- M1 score for the affected zone at the time of the fire event
  m1_risk_score_at_event  FLOAT,
  m1_risk_tier_at_event   TEXT,
  pre_release_delay_seconds INT DEFAULT 7,
  status_acknowledged     BOOLEAN DEFAULT FALSE
);

-- ──────────────────────────────────────────────────────────
-- TABLE 4: commands_log
-- Every command sent to the ESP32 (polled by ESP32 edge node)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commands_log (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  godown_id               TEXT NOT NULL,
  command                 TEXT NOT NULL,        -- 'log_only' | 'supervisor_alert' | 'evacuate'
  confidence              FLOAT,
  fire_zone               TEXT,
  powder_zones            TEXT[],
  triggered_by            TEXT DEFAULT 'M2',    -- 'M2' | 'edge'
  pre_release_delay       INT DEFAULT 7,
  acknowledged            BOOLEAN DEFAULT FALSE,
  acknowledged_at         TIMESTAMPTZ,
  actions_taken           TEXT
);

-- ──────────────────────────────────────────────────────────
-- TABLE 5: incidents
-- General incident log — written by any system component
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  godown_id   TEXT NOT NULL,
  zone        TEXT,
  type        TEXT NOT NULL,   -- 'hotspot_flag' | 'evacuation' | 'powder_release' | 'fallback_rule_based' etc.
  severity    TEXT,            -- 'info' | 'warning' | 'critical'
  details     JSONB            -- freeform context about the incident
);


-- ──────────────────────────────────────────────────────────
-- INDEXES (performance for real-time dashboard queries)
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sensor_readings_zone_time
  ON sensor_readings (zone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_risk_scores_zone_time
  ON risk_scores (zone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fire_events_zone_time
  ON fire_events (fire_zone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commands_log_godown_time
  ON commands_log (godown_id, created_at DESC);


-- ──────────────────────────────────────────────────────────
-- REAL-TIME & RLS POLICIES
-- Enable real-time replication and allow public read/write for IoT devices & dashboard
-- ──────────────────────────────────────────────────────────
ALTER TABLE sensor_readings DISABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE fire_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE commands_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;

