import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import LandingSensorGrid from './components/LandingSensorGrid'
import ActuatorsStatusPanel from './components/ActuatorsStatusPanel'
import MlInferencePanel from './components/MlInferencePanel'
import FullThermalMatrixView from './components/FullThermalMatrixView'
import RecentCloudLogsTable from './components/RecentCloudLogsTable'
import RealtimeGraphsView from './components/RealtimeGraphsView'
import MlAnalyticsGraphsView from './components/MlAnalyticsGraphsView'
import './index.css'

const GODOWN_ID = import.meta.env.VITE_GODOWN_ID ?? 'godown_filling_01'

export default function App() {
  const [clock, setClock] = useState(new Date())
  const [connected, setConnected] = useState(false)
  const [liveHistory, setLiveHistory] = useState([])

  // Live clock timer
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Fetch last 50 telemetry rows from Supabase & subscribe to real-time inserts
  const fetchCloudHistory = async () => {
    try {
      const { data: readingsData } = await supabase
        .from('sensor_readings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      const { data: riskData } = await supabase
        .from('risk_scores')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      const { data: fireData } = await supabase
        .from('fire_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      if (readingsData && readingsData.length > 0) {
        const latestRisk = riskData && riskData[0] ? riskData[0] : null
        const latestFire = fireData && fireData[0] ? fireData[0] : null

        const mergedHistory = readingsData.map((row, idx) => {
          if (idx === 0) {
            return {
              ...row,
              risk_score: row.m1_risk_score ?? row.risk_score ?? latestRisk?.risk_score,
              anomaly_score_raw: row.anomaly_score_raw ?? latestRisk?.anomaly_score_raw,
              m2_confidence: row.m2_confidence ?? row.confidence ?? latestFire?.confidence,
            }
          }
          return row
        })

        setLiveHistory(mergedHistory)
        setConnected(true)
      } else {
        setConnected(false)
      }
    } catch (e) {
      setConnected(false)
    }
  }

  useEffect(() => {
    fetchCloudHistory()

    const channel = supabase
      .channel('sensor_readings_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
        (payload) => {
          if (payload.new) {
            setLiveHistory(prev => [payload.new, ...prev].slice(0, 50))
            setConnected(true)
            fetchCloudHistory()
          }
        }
      )
      .subscribe()

    const interval = setInterval(fetchCloudHistory, 1000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  // Current latest reading from cloud stream (timestamp ordered)
  const latestReading = liveHistory[0] || {
    temp_z1: 31.2,
    temp_z2: 32.5,
    temp_z3: 30.8,
    temp_z4: 29.9,
    temp_inside: 32.4,
    humidity_inside: 48.0,
    temp_outside: 34.1,
    humidity_outside: 42.0,
    mq2_val: 2450,
    mq135_val: 950,
    flame_val: 0,
    fan_status: false,
    system_state: 'NORMAL'
  }

  // Dynamic Hazard Evaluation from current sensor reading
  const z1 = Number(latestReading.temp_z1 ?? 31.2)
  const z2 = Number(latestReading.temp_z2 ?? 32.5)
  const z3 = Number(latestReading.temp_z3 ?? 30.8)
  const z4 = Number(latestReading.temp_z4 ?? 29.9)
  const maxThermal = Math.max(z1, z2, z3, z4)
  const mq2Val = Number(latestReading.mq2_val ?? 2450)
  const mq135Val = Number(latestReading.mq135_val ?? 950)
  const flameVal = Number(latestReading.flame_val ?? 0)

  // Use Cloud DB state if available; fallback to live calculation if sensors are clear
  const cloudState = latestReading.system_state
  const hasCriticalSensor = (flameVal >= 0.5 || maxThermal >= 60.0 || mq2Val >= 2800 || mq135Val >= 2000)
  const hasModerateSensor = (maxThermal >= 45.0 || mq2Val >= 2500 || mq135Val >= 1500)

  let currentState = 'NORMAL'
  if (hasCriticalSensor) {
    currentState = 'CRITICAL'
  } else if (cloudState === 'CRITICAL' && !hasCriticalSensor && !hasModerateSensor) {
    currentState = 'NORMAL' // Auto-reset when sensors return to baseline
  } else if (cloudState && ['NORMAL', 'MODERATE', 'CRITICAL'].includes(cloudState)) {
    currentState = cloudState
  } else if (hasModerateSensor) {
    currentState = 'MODERATE'
  } else {
    currentState = 'NORMAL'
  }

  const timeStr = clock.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const dateStr = clock.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <div className="app-shell">
      {/* ── HEADER ── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="brand-icon">🔥</div>
            <div>
              <div className="brand-name">Fire Guardian</div>
              <div className="brand-sub">Sivakasi Firecracker Godown ML Safety System · Node: {GODOWN_ID}</div>
            </div>
          </div>

          <div className="header-meta">
            {connected ? (
              <div className="live-badge">
                <div className="live-dot" />
                SUPABASE LIVE REAL-TIME
              </div>
            ) : (
              <div className="live-badge offline-badge">
                OFFLINE (LOCAL BASES)
              </div>
            )}
            <div className="header-time">{dateStr} · {timeStr}</div>
          </div>
        </div>
      </header>

      {/* ── MAIN DASHBOARD CONTAINER ── */}
      <main className="main-content">
        {/* SECTION 1: LANDING PAGE & REAL-TIME SENSOR GRID */}
        <section className="dashboard-section">
          <div className="section-label">
            <span>Section 1 — Landing Page & Real-Time Sensor Telemetry</span>
          </div>
          <LandingSensorGrid readings={latestReading} currentState={currentState} />
        </section>

        {/* SECTION 2: ACTUATORS & HARDWARE RELAYS STATUS */}
        <section className="dashboard-section">
          <div className="section-label">
            <span>Section 2 — Actuators & Relay Status Controls</span>
          </div>
          <ActuatorsStatusPanel readings={latestReading} currentState={currentState} />
        </section>

        {/* SECTION 3: MACHINE LEARNING INFERENCE PIPELINE */}
        <section className="dashboard-section">
          <div className="section-label">
            <span>Section 3 — Machine Learning Model 1 & Model 2 Pipeline</span>
          </div>
          <MlInferencePanel readings={latestReading} currentState={currentState} />
        </section>

        {/* SECTION 4: UNIFIED 8x8 AMG8833 THERMAL IR MATRIX (64 PIXELS) */}
        <section className="dashboard-section">
          <div className="section-label">
            <span>Section 4 — Thermal Imaging: AMG8833 8×8 IR Matrix (64 Pixels)</span>
          </div>
          <FullThermalMatrixView latestReadings={latestReading} />
        </section>

        {/* SECTION 5: CLOUD HISTORY TABLE (LATEST 5 ROWS FROM SUPABASE) */}
        <section className="dashboard-section">
          <div className="section-label">
            <span>Section 5 — Cloud History Table (Latest 5 Supabase Log Rows)</span>
          </div>
          <RecentCloudLogsTable simulatedReadings={latestReading} />
        </section>

        {/* SECTION 6: REAL-TIME SENSOR TELEMETRY DYNAMIC GRAPHS */}
        <section className="dashboard-section">
          <div className="section-label">
            <span>Section 6 — Real-Time Sensor Telemetry Dynamic Graphs</span>
          </div>
          <RealtimeGraphsView liveHistory={liveHistory} />
        </section>

        {/* SECTION 7: MACHINE LEARNING MODELS PERFORMANCE & ANALYTICS GRAPHS */}
        <section className="dashboard-section">
          <div className="section-label">
            <span>Section 7 — Machine Learning Analytics & Performance Graphs</span>
          </div>
          <MlAnalyticsGraphsView liveHistory={liveHistory} />
        </section>
      </main>

      {/* FOOTER */}
      <footer className="app-footer font-mono">
        Fire Guardian Machine Learning Fire Prevention & Containment System · Built for Sivakasi Industrial Firecracker Safety
      </footer>
    </div>
  )
}
