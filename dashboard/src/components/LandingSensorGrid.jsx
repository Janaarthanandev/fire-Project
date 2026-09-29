import React from 'react'
import { computeSharedMlScores } from './MlInferencePanel'

// Dynamic autoscaled color mapping for 4x4 micro-grid pixels
function subGridColor(val, minV = 28.0, maxV = 36.0) {
  const norm = (maxV === minV) ? 0.5 : Math.max(0, Math.min(1, (val - minV) / (maxV - minV)))

  const stops = [
    [0.00, [15, 23, 60]],     // Deep Navy
    [0.20, [14, 116, 144]],   // Cyan
    [0.45, [16, 185, 129]],   // Emerald Green
    [0.70, [245, 158, 11]],   // Amber Yellow
    [0.90, [239, 68, 68]],    // Red
    [1.00, [255, 245, 230]],  // White Hot
  ]

  let r = 0, g = 0, b = 0
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]
    const [t1, c1] = stops[i + 1]
    if (norm >= t0 && norm <= t1) {
      const u = (norm - t0) / (t1 - t0)
      r = Math.round(c0[0] + u * (c1[0] - c0[0]))
      g = Math.round(c0[1] + u * (c1[1] - c0[1]))
      b = Math.round(c0[2] + u * (c1[2] - c0[2]))
      break
    }
  }
  return `rgb(${r},${g},${b})`
}

function extractSubGrid(fullGrid = [], r0, c0, baseTemp = 31.5) {
  const sub = []
  for (let r = r0; r < r0 + 4; r++) {
    for (let c = c0; c < c0 + 4; c++) {
      const idx = r * 8 + c
      const raw = (Array.isArray(fullGrid) && typeof fullGrid[idx] === 'number')
        ? fullGrid[idx]
        : baseTemp + Math.sin(r * 2.1 + c * 1.5) * 1.2
      sub.push(Number(raw.toFixed(1)))
    }
  }
  return sub
}

export default function LandingSensorGrid({ readings, currentState }) {
  const thermalGrid = readings?.thermal_grid || []

  // Extract 4x4 sub-grids for each zone
  const z1Grid = extractSubGrid(thermalGrid, 0, 0, readings?.temp_z1 ?? 31.7)
  const z2Grid = extractSubGrid(thermalGrid, 0, 4, readings?.temp_z2 ?? 31.8)
  const z3Grid = extractSubGrid(thermalGrid, 4, 0, readings?.temp_z3 ?? 31.8)
  const z4Grid = extractSubGrid(thermalGrid, 4, 4, readings?.temp_z4 ?? 31.3)

  const allPixels = [...z1Grid, ...z2Grid, ...z3Grid, ...z4Grid]
  const minV = Math.min(...allPixels) - 0.5
  const maxV = Math.max(...allPixels) + 0.5

  const z1Max = (readings?.temp_z1 ?? Math.max(...z1Grid)).toFixed(1)
  const z2Max = (readings?.temp_z2 ?? Math.max(...z2Grid)).toFixed(1)
  const z3Max = (readings?.temp_z3 ?? Math.max(...z3Grid)).toFixed(1)
  const z4Max = (readings?.temp_z4 ?? Math.max(...z4Grid)).toFixed(1)

  const mq2 = Math.round(readings?.mq2_val ?? 185)
  const mq135 = Math.round(readings?.mq135_val ?? 142)
  const flameDetected = (readings?.flame_val ?? 0) > 0.5

  const tIn = (readings?.temp_inside ?? 32.4).toFixed(1)
  const hIn = (readings?.humidity_inside ?? 48.0).toFixed(1)
  const tOut = (readings?.temp_outside ?? 34.1).toFixed(1)
  const hOut = (readings?.humidity_outside ?? 42.0).toFixed(1)

  const stateStr = currentState || readings?.system_state || 'NORMAL'

  // ── TRIGGER REASON & ROOT CAUSE ANALYSIS BREAKDOWN ──
  const z1Val = Number(readings?.temp_z1 ?? 31.2)
  const z2Val = Number(readings?.temp_z2 ?? 32.5)
  const z3Val = Number(readings?.temp_z3 ?? 30.8)
  const z4Val = Number(readings?.temp_z4 ?? 29.9)
  const maxThermal = Math.max(z1Val, z2Val, z3Val, z4Val)
  
  const zoneMap = { 'Zone 1': z1Val, 'Zone 2': z2Val, 'Zone 3': z3Val, 'Zone 4': z4Val }
  const maxZoneName = Object.keys(zoneMap).reduce((a, b) => zoneMap[a] > zoneMap[b] ? a : b)

  const triggerReasons = []
  if (flameDetected) {
    triggerReasons.push({ type: 'sensor', label: 'IR Flame Sensor (GPIO 18)', value: 'FLAME DETECTED', icon: '🔥', severity: 'danger' })
  }
  if (maxThermal >= 60.0) {
    triggerReasons.push({ type: 'sensor', label: `Thermal Array (${maxZoneName})`, value: `${maxThermal.toFixed(1)}°C (≥ 60°C Spike)`, icon: '🌡️', severity: 'danger' })
  } else if (maxThermal >= 45.0) {
    triggerReasons.push({ type: 'sensor', label: `Thermal Array (${maxZoneName})`, value: `${maxThermal.toFixed(1)}°C (Elevated Heat)`, icon: '🌡️', severity: 'warning' })
  }
  if (mq2 >= 2800) {
    triggerReasons.push({ type: 'sensor', label: 'Combustible Gas (MQ-2)', value: `${mq2} PPM (≥ 2800 PPM Critical Trigger)`, icon: '💨', severity: 'danger' })
  } else if (mq2 >= 2500) {
    triggerReasons.push({ type: 'sensor', label: 'Combustible Gas (MQ-2)', value: `${mq2} PPM (Elevated Gas)`, icon: '💨', severity: 'warning' })
  }
  if (mq135 >= 2000) {
    triggerReasons.push({ type: 'sensor', label: 'Air Quality (MQ-135)', value: `${mq135} PPM (≥ 2000 PPM Toxic Smoke Trigger)`, icon: '☁️', severity: 'danger' })
  } else if (mq135 >= 1500) {
    triggerReasons.push({ type: 'sensor', label: 'Air Quality (MQ-135)', value: `${mq135} PPM (Elevated Smoke Drift)`, icon: '☁️', severity: 'warning' })
  }

  const { m1Score: m1ScoreVal, m2Confidence: m2ConfVal } = computeSharedMlScores(readings)

  if (m2ConfVal >= 75.0) {
    triggerReasons.push({ type: 'ml', label: 'Model 2: Random Forest', value: `Fire Confidence ${m2ConfVal.toFixed(1)}% (≥ 75%)`, icon: '🧠', severity: 'danger' })
  }
  if (m1ScoreVal >= 50.0) {
    triggerReasons.push({ type: 'ml', label: 'Model 1: Isolation Forest', value: `M1 Risk Score ${m1ScoreVal} (≥ 50 Hotspot)`, icon: '🧠', severity: 'warning' })
  }

  if (triggerReasons.length === 0) {
    triggerReasons.push({ type: 'normal', label: 'All Sensors & ML Models Safe', value: 'All 4 Spatial Thermal Zones, Gas & IR Flame within baseline parameters', icon: '✅', severity: 'safe' })
  }

  const renderZoneCard = (title, subText, gridPixels, maxVal) => (
    <div className="card-glass zone-4x4-card">
      <div className="card-box-header">
        <span className="card-label">{title}</span>
        <span className="card-icon">🌡️</span>
      </div>

      {/* 4x4 Thermal Micro Grid (16 Pixels with dynamic color palette) */}
      <div className="zone-subgrid-4x4">
        {gridPixels.map((pVal, pIdx) => (
          <div
            key={pIdx}
            className="subgrid-pixel-4x4"
            style={{ backgroundColor: subGridColor(pVal, minV, maxV) }}
            title={`${pVal}°C`}
          />
        ))}
      </div>

      {/* Zone Max Temperature Value at Bottom */}
      <div className="zone-bottom-value-container">
        <div className="card-value">{maxVal}°C</div>
        <div className="card-subtext">{subText}</div>
      </div>
    </div>
  )

  return (
    <div className="landing-section-wrapper">
      {/* ── ROW 1: THE 4 SPATIAL ZONES WITH 4x4 MICRO-GRIDS & TEMPS AT BOTTOM ── */}
      <div className="grid-4-cols">
        {renderZoneCard('Zone 1 (Top-Left)', 'Top-Left 4x4 Thermal Array Max', z1Grid, z1Max)}
        {renderZoneCard('Zone 2 (Top-Right)', 'Top-Right 4x4 Thermal Array Max', z2Grid, z2Max)}
        {renderZoneCard('Zone 3 (Bottom-Left)', 'Bottom-Left 4x4 Thermal Array Max', z3Grid, z3Max)}
        {renderZoneCard('Zone 4 (Exit Path)', 'Exit Path 4x4 Thermal Array Max', z4Grid, z4Max)}
      </div>

      {/* ── ROW 2: GAS 1, GAS 2, FIRE SENSOR ── */}
      <div className="grid-3-cols">
        <div className="card-glass gas-card-box">
          <div className="card-box-header">
            <span className="card-label">Gas 1 (MQ-2 Combustible)</span>
            <span className="card-icon">💨</span>
          </div>
          <div className="card-value">{mq2} <span className="unit-label">PPM</span></div>
          <div className="card-subtext">LPG / Smoke / Propane</div>
        </div>

        <div className="card-glass gas-card-box">
          <div className="card-box-header">
            <span className="card-label">Gas 2 (MQ-135 Air Quality)</span>
            <span className="card-icon">☁️</span>
          </div>
          <div className="card-value">{mq135} <span className="unit-label">PPM</span></div>
          <div className="card-subtext">CO2 / Ammonia / Smoke</div>
        </div>

        <div className={`card-glass flame-card-box ${flameDetected ? 'flame-alert' : ''}`}>
          <div className="card-box-header">
            <span className="card-label">Fire Sensor (IR Flame Pin 18)</span>
            <span className="card-icon">🔥</span>
          </div>
          <div className="card-value">
            {flameDetected ? <span className="text-danger-blink">FLAME DETECTED</span> : <span className="text-safe">CLEAR</span>}
          </div>
          <div className="card-subtext">Active High Digital Read</div>
        </div>
      </div>

      {/* ── ROW 3: TEMPERATURE & HUMIDITY INSIDE / OUTSIDE ── */}
      <div className="grid-2-cols">
        <div className="card-glass env-card-box">
          <div className="card-box-header">
            <span className="card-label">Temperature & Humidity Inside (DHT22 In)</span>
            <span className="card-icon">🏠</span>
          </div>
          <div className="card-value-group">
            <span className="card-value">{tIn}°C</span>
            <span className="card-value-secondary">{hIn}% RH</span>
          </div>
          <div className="card-subtext">Room Baseline Ambient (Fan trigger &gt; 35.0°C)</div>
        </div>

        <div className="card-glass env-card-box">
          <div className="card-box-header">
            <span className="card-label">Temperature & Humidity Outside (DHT22 Out)</span>
            <span className="card-icon">🌤️</span>
          </div>
          <div className="card-value-group">
            <span className="card-value">{tOut}°C</span>
            <span className="card-value-secondary">{hOut}% RH</span>
          </div>
          <div className="card-subtext">External Outdoor Environment Reference</div>
        </div>
      </div>

      {/* ── ROW 4: SYSTEM OPERATIONAL STATE BANNER ── */}
      <div className={`system-state-banner state-banner-${stateStr.toLowerCase()}`}>
        <div className="banner-inner flex-between">
          <div className="banner-left flex-align">
            <div className="state-badge-icon">
              {stateStr === 'CRITICAL' ? '🚨' : stateStr === 'MODERATE' ? '⚠️' : '🛡️'}
            </div>
            <div>
              <div className="banner-small-label font-mono">OVERALL SYSTEM OPERATIONAL STATE</div>
              <div className="banner-state-title">STATE: {stateStr}</div>
              <div className="banner-state-desc">
                {stateStr === 'CRITICAL'
                  ? 'CRITICAL FIRE RISK! Emergency Containment Activated — Main Power CUT (GPIO 27 HIGH) & Powder Servo Engaged (90°).'
                  : stateStr === 'MODERATE'
                  ? 'MODERATE HOTSPOT DETECTED (50°C - 60°C or M1 Score ≥ 50). Warning Siren & LED Active.'
                  : 'SYSTEM NORMAL. All 4 Spatial Thermal Zones & Environmental Sensors within safe baseline limits.'}
              </div>
            </div>
          </div>
          <div className="banner-right">
            <div className="banner-mode-pill">
              <span className="live-ping-dot" />
              <span>ACTIVE CONTINUOUS MONITORING</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 5: DEDICATED ROOT CAUSE & TRIGGER SOURCE ANALYSIS CARD ── */}
      <div className="card-glass trigger-analysis-card">
        <div className="trigger-card-header flex-between">
          <div className="trigger-card-title flex-align">
            <span className="title-icon">🔍</span>
            <span>Root Cause & State Trigger Source Analysis</span>
          </div>
          <div className="trigger-count-badge font-mono">
            {triggerReasons.length} Active Indicator{triggerReasons.length > 1 ? 's' : ''}
          </div>
        </div>

        <div className="trigger-items-grid">
          {triggerReasons.map((tr, idx) => (
            <div key={idx} className={`trigger-item-box item-${tr.severity}`}>
              <div className="trigger-item-header flex-align">
                <span className="trigger-item-icon">{tr.icon}</span>
                <span className="trigger-item-label">{tr.label}</span>
              </div>
              <div className="trigger-item-val font-mono">{tr.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

