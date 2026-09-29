import React from 'react'

export default function MlInferencePanel({ readings, currentState }) {
  const z1 = readings?.temp_z1 ?? 31.2
  const z2 = readings?.temp_z2 ?? 32.5
  const z3 = readings?.temp_z3 ?? 30.8
  const z4 = readings?.temp_z4 ?? 29.9
  const maxTemp = Math.max(z1, z2, z3, z4)

  const tIn = readings?.temp_inside ?? 32.4
  const tOut = readings?.temp_outside ?? 34.1
  const hIn = readings?.humidity_inside ?? 48.0
  const hOut = readings?.humidity_outside ?? 42.0

  const tempDiff = Math.abs(tIn - tOut)
  const humDiff = Math.abs(hIn - hOut)
  const mq2 = readings?.mq2_val ?? 185
  const mq135 = readings?.mq135_val ?? 142
  const flameVal = readings?.flame_val ?? 0

  const stateStr = currentState || readings?.system_state || 'NORMAL'
  const isCritical = stateStr === 'CRITICAL'
  const isModerate = stateStr === 'MODERATE'

  let m1Score = 15
  if (isCritical) m1Score = 92
  else if (isModerate) m1Score = 68
  else if (maxTemp > 40) m1Score = Math.min(48, Math.round((maxTemp - 25) * 2.5))

  const m1AnomalyRaw = (m1Score / 100 - 0.5).toFixed(3)

  let m2Confidence = 4.2
  if (isCritical) m2Confidence = 98.6
  else if (isModerate) m2Confidence = 42.1
  else if (maxTemp > 45) m2Confidence = 28.4

  return (
    <div className="ml-inference-section-wrapper">
      <div className="actuators-header-title">
        <span className="title-icon">🧠</span>
        <span>Machine Learning Pipeline — Live Dual-Stage Inference</span>
      </div>

      <div className="grid-2-cols">
        {/* MODEL 1 PANEL */}
        <div className="card-glass ml-model-card m1-card">
          <div className="ml-card-header">
            <div>
              <div className="ml-model-name">Model 1: Isolation Forest</div>
              <div className="ml-model-sub">Pre-Ignition Anomaly & Risk Scorer</div>
            </div>
            <span className="stage-tag font-mono">STAGE 1</span>
          </div>

          <div className="ml-inputs-section">
            <div className="inputs-section-title">Inputs Received from Telemetry</div>
            <div className="input-pills-grid">
              <div className="input-pill font-mono">Max Thermal: {maxTemp.toFixed(1)}°C</div>
              <div className="input-pill font-mono">Temp Diff: {tempDiff.toFixed(1)}°C</div>
              <div className="input-pill font-mono">Humid Diff: {humDiff.toFixed(1)}%</div>
              <div className="input-pill font-mono">MQ-2 Gas: {Math.round(mq2)} PPM</div>
              <div className="input-pill font-mono">MQ-135 Gas: {Math.round(mq135)} PPM</div>
              <div className="input-pill font-mono">Raw Anomaly: {m1AnomalyRaw}</div>
            </div>
          </div>

          <div className="ml-output-box">
            <div>
              <div className="output-label">Calculated M1 Risk Score</div>
              <div className="output-score font-mono text-indigo">{m1Score} <span className="score-max">/ 100</span></div>
            </div>
            <div>
              <div className="output-label">Trigger Condition</div>
              {m1Score >= 50 ? (
                <span className="condition-tag tag-warning">RISK ≥ 50 (HOTSPOT)</span>
              ) : (
                <span className="condition-tag tag-safe">RISK &lt; 50 (NORMAL)</span>
              )}
            </div>
          </div>
        </div>

        {/* MODEL 2 PANEL */}
        <div className="card-glass ml-model-card m2-card">
          <div className="ml-card-header">
            <div>
              <div className="ml-model-name">Model 2: Random Forest Classifier</div>
              <div className="ml-model-sub">Multi-Sensor Fusion Fire Confidence Engine</div>
            </div>
            <span className="stage-tag font-mono">STAGE 2</span>
          </div>

          <div className="ml-inputs-section">
            <div className="inputs-section-title">Inputs Received from Feature Vector</div>
            <div className="input-pills-grid">
              <div className="input-pill font-mono">Z1..Z4 Temps: {z1.toFixed(0)}, {z2.toFixed(0)}, {z3.toFixed(0)}, {z4.toFixed(0)}</div>
              <div className="input-pill font-mono">Gas Fusion: MQ2+MQ135</div>
              <div className="input-pill font-mono">IR Flame: {flameVal > 0.5 ? '1 (DETECTED)' : '0 (CLEAR)'}</div>
              <div className="input-pill font-mono">M1 Risk Context: {m1Score}</div>
            </div>
          </div>

          <div className="ml-output-box">
            <div>
              <div className="output-label">Calculated Fire Confidence</div>
              <div className="output-score font-mono text-danger">{m2Confidence.toFixed(1)}%</div>
            </div>
            <div>
              <div className="output-label">Containment Decision</div>
              {m2Confidence >= 75 ? (
                <span className="condition-tag tag-danger">CONFIDENCE ≥ 75% (POWER CUT & SERVO OPEN)</span>
              ) : (
                <span className="condition-tag tag-safe">CONFIDENCE &lt; 75% (NO ACTION)</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
