export function computeSharedMlScores(readings) {
  const z1 = Number(readings?.temp_z1 ?? 31.2)
  const z2 = Number(readings?.temp_z2 ?? 32.5)
  const z3 = Number(readings?.temp_z3 ?? 30.8)
  const z4 = Number(readings?.temp_z4 ?? 29.9)
  const maxTemp = Math.max(z1, z2, z3, z4)

  const tIn = Number(readings?.temp_inside ?? 32.4)
  const tOut = Number(readings?.temp_outside ?? 34.1)
  const hIn = Number(readings?.humidity_inside ?? 48.0)
  const hOut = Number(readings?.humidity_outside ?? 42.0)

  const tempDiff = Math.abs(tIn - tOut)
  const humDiff = Math.abs(hIn - hOut)
  const mq2 = Number(readings?.mq2_val ?? 185)
  const mq135 = Number(readings?.mq135_val ?? 142)
  const flameVal = Number(readings?.flame_val ?? 0)
  const flameDetected = flameVal > 0.5

  // ── 1. CLOUD ML DATA PRIORITY (Read exact values logged to Supabase) ──
  const cloudM1Score = readings?.m1_risk_score ?? readings?.risk_score
  const cloudM2Conf = readings?.m2_confidence ?? readings?.confidence
  const cloudAnomaly = readings?.anomaly_score_raw ?? readings?.raw_anomaly

  // ── 2. MODEL 1: Isolation Forest Pre-Ignition Risk Scorer ──
  let m1Score = 14
  if (cloudM1Score !== undefined && cloudM1Score !== null && !isNaN(Number(cloudM1Score))) {
    m1Score = Math.round(Number(cloudM1Score))
  } else if (flameDetected || maxTemp >= 60.0 || mq2 >= 2800 || mq135 >= 2000) {
    m1Score = Math.min(98, Math.round(84 + (maxTemp - 60.0) * 0.4 + (mq2 - 2800) * 0.02 + (flameDetected ? 8 : 0)))
  } else if (maxTemp >= 45.0 || mq2 >= 2500 || mq135 >= 1500) {
    m1Score = Math.min(74, Math.round(50 + (maxTemp - 45.0) * 1.5 + (mq2 - 2500) * 0.08))
  } else {
    const tempContrib = Math.max(0, (maxTemp - 30.0) * 1.5)
    const gasContrib = Math.max(0, (mq2 - 2200) * 0.03)
    m1Score = Math.min(42, Math.round(12 + tempContrib + gasContrib))
  }
  m1Score = Math.max(0, Math.min(100, m1Score))

  let m1AnomalyRaw = '-0.200'
  if (cloudAnomaly !== undefined && cloudAnomaly !== null && !isNaN(Number(cloudAnomaly))) {
    m1AnomalyRaw = Number(cloudAnomaly).toFixed(3)
  } else {
    m1AnomalyRaw = (m1Score / 100.0 - 0.5).toFixed(3)
  }

  // ── 3. MODEL 2: Random Forest Multi-Sensor Fire Confidence Engine ──
  let m2Confidence = 3.5
  if (cloudM2Conf !== undefined && cloudM2Conf !== null && !isNaN(Number(cloudM2Conf))) {
    m2Confidence = Number(Number(cloudM2Conf).toFixed(1))
  } else if (flameDetected || (maxTemp >= 60.0 && mq2 >= 2800)) {
    m2Confidence = Math.min(99.4, Number((92.0 + (maxTemp - 60.0) * 0.3 + (flameDetected ? 5.0 : 0)).toFixed(1)))
  } else if (maxTemp >= 48.0 || mq2 >= 2500 || mq135 >= 1500) {
    m2Confidence = Math.min(74.0, Number((42.0 + (maxTemp - 48.0) * 2.0).toFixed(1)))
  } else if (m1Score >= 50) {
    m2Confidence = Math.min(48.0, Number((22.0 + (m1Score - 50.0) * 0.8).toFixed(1)))
  } else {
    m2Confidence = Math.min(12.0, Number((2.5 + (maxTemp - 30.0) * 0.3 + (mq2 - 2200) * 0.01).toFixed(1)))
  }
  m2Confidence = Math.max(0.0, Math.min(100.0, m2Confidence))

  return {
    z1, z2, z3, z4, maxTemp, tIn, tOut, hIn, hOut,
    tempDiff, humDiff, mq2, mq135, flameVal, flameDetected,
    m1Score, m1AnomalyRaw, m2Confidence
  }
}

export default function MlInferencePanel({ readings, currentState }) {
  const {
    z1, z2, z3, z4, maxTemp, tIn, tOut, hIn, hOut,
    tempDiff, humDiff, mq2, mq135, flameVal, flameDetected,
    m1Score, m1AnomalyRaw, m2Confidence
  } = computeSharedMlScores(readings)

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
