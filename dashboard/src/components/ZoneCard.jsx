import { useState } from 'react'
import TrendSparkline from './TrendSparkline'
import ThermalHeatmap4x4 from './ThermalHeatmap4x4'
import { formatDistanceToNow } from 'date-fns'

/**
 * ZoneCard — displays M1 risk score, tier, sensor readings, sparkline, and compact 4×4 IR heatmap.
 *
 * Props:
 *   zone        — zone name string e.g. "Zone_1_Fill"
 *   latest      — latest risk_scores row (or null)
 *   history     — last 30 risk_scores rows for sparkline
 *   isExit      — boolean, if true renders the active exit corridor card
 */
export default function ZoneCard({ zone, latest, history = [], isExit = false }) {
  const [showHeatmap, setShowHeatmap] = useState(true)

  if (isExit) {
    return (
      <div className="zone-card tier-exit" id={`zone-card-${zone.toLowerCase().replace(/_/g, '-')}`}>
        <div className="zone-card-header">
          <div>
            <div className="zone-name">Zone 4 — Exit Corridor</div>
            <div className="zone-id">{zone}</div>
          </div>
          <div className="tier-badge exit-status-badge">CLEAR</div>
        </div>

        <div className="exit-status-section">
          <div className="exit-status-icon">🚪</div>
          <div className="exit-status-label">Evacuation Route Ready</div>
        </div>

        <div className="zone-stats">
          <div className="stat-item exit-stat">
            <div className="stat-label">Exit Door</div>
            <div className="stat-value exit-ok">Unlocked</div>
          </div>
          <div className="stat-item exit-stat">
            <div className="stat-label">Emergency Lights</div>
            <div className="stat-value exit-ok">Operational</div>
          </div>
          <div className="stat-item exit-stat">
            <div className="stat-label">Pathway</div>
            <div className="stat-value exit-ok">Clear</div>
          </div>
          <div className="stat-item exit-stat">
            <div className="stat-label">Ambient Temp</div>
            <div className="stat-value">~33°C</div>
          </div>
        </div>

        {/* 4×4 Thermal Camera grid for Exit Corridor */}
        <div className="card-thermal-section">
          <ThermalHeatmap4x4
            thermalGrid={[]}
            avgTemp={33.0}
            tier="Safe"
            zone={zone}
          />
        </div>

        <div className="card-footer">
          <span>Evacuation Path Monitor</span>
          <span>Always Active</span>
        </div>
      </div>
    )
  }

  const score = latest?.risk_score ?? null
  const tier  = latest?.risk_tier  ?? 'Safe'
  const tierClass = tier.toLowerCase()

  const thermalAvg   = latest?.zone_thermal_avg   ?? '—'
  const thermalTrend = latest?.zone_thermal_trend ?? '—'
  const humidity     = latest?.humidity           ?? '—'
  const gasDrift     = latest?.gas_baseline_drift ?? '—'
  const thermalGrid  = latest?.thermal_grid ?? []

  const updatedAt = latest?.created_at
    ? formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })
    : 'No data yet'

  const zoneNumber = zone.match(/\d+/)?.[0] ?? '?'

  return (
    <div
      className={`zone-card tier-${tierClass}`}
      id={`zone-card-${zone.toLowerCase().replace(/_/g, '-')}`}
    >
      {/* Header */}
      <div className="zone-card-header">
        <div>
          <div className="zone-name">Zone {zoneNumber} — Fill</div>
          <div className="zone-id">{zone}</div>
        </div>
        {score !== null && (
          <div className={`tier-badge ${tierClass}`}>{tier}</div>
        )}
      </div>

      {/* Risk score */}
      {score !== null ? (
        <>
          <div className="risk-score-display">
            <span className={`risk-score-value ${tierClass}`}>
              {Math.round(score)}
            </span>
            <span className="risk-score-unit">/ 100</span>
          </div>

          <div className="risk-bar-track">
            <div
              className={`risk-bar-fill ${tierClass}`}
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Waiting for first reading…
        </div>
      )}

      {/* Sensor stats grid */}
      <div className="zone-stats">
        <div className="stat-item">
          <div className="stat-label">Thermal Avg</div>
          <div className="stat-value">
            {thermalAvg !== '—' ? `${Number(thermalAvg).toFixed(1)}°C` : '—'}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Trend</div>
          <div className="stat-value">
            {thermalTrend !== '—' ? `${Number(thermalTrend) > 0 ? '+' : ''}${Number(thermalTrend).toFixed(2)}°` : '—'}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Humidity</div>
          <div className="stat-value">
            {humidity !== '—' ? `${Number(humidity).toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Gas Drift</div>
          <div className="stat-value">
            {gasDrift !== '—' ? `${Number(gasDrift) > 0 ? '+' : ''}${Number(gasDrift).toFixed(1)}` : '—'}
          </div>
        </div>
      </div>

      {/* Sparkline — fixed Y axis 0–100 */}
      {history.length >= 2 && (
        <TrendSparkline history={history} tier={tier} />
      )}

      {/* 4×4 IR Sensor Thermal Heatmap */}
      <div className="card-thermal-section">
        <ThermalHeatmap4x4
          thermalGrid={thermalGrid}
          avgTemp={Number(thermalAvg) || 36.5}
          tier={tier}
          zone={zone}
        />
      </div>

      {/* Footer */}
      <div className="card-footer">
        <span>M1 Pre-Ignition</span>
        <span>{updatedAt}</span>
      </div>
    </div>
  )
}

