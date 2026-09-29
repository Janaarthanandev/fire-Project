import React from 'react'

export default function ActuatorsStatusPanel({ readings, currentState }) {
  const stateStr = currentState || readings?.system_state || 'NORMAL'
  const isCritical = stateStr === 'CRITICAL'
  const isModerate = stateStr === 'MODERATE'

  const ledActive = readings?.led_active ?? (isCritical || isModerate)
  const buzzerActive = readings?.buzzer_active ?? (isCritical || isModerate)
  const powerCutRelayActive = readings?.power_cut ?? isCritical
  const fanActive = readings?.fan_status ?? ((readings?.temp_inside ?? 32) > 35.0)
  const servoOpen = readings?.servo_open ?? isCritical

  return (
    <div className="actuators-section-wrapper">
      <div className="actuators-header-title">
        <span className="title-icon">⚙️</span>
        <span>Hardware Actuators & Relay Controls</span>
      </div>

      {/* ROW 1: LED, BUZZER, CURRENT CUT OFF RELAY */}
      <div className="grid-3-cols">
        {/* Alarm LED */}
        <div className="card-glass actuator-box">
          <div className="actuator-info">
            <span className="actuator-icon">🚨</span>
            <div>
              <div className="card-label">Alarm Status LED</div>
              <div className="actuator-pin font-mono">GPIO 2 (Active HIGH)</div>
              <div className="card-subtext">Visual Warning Alarm</div>
            </div>
          </div>
          <div className={`actuator-status-pill ${ledActive ? 'pill-warning' : 'pill-off'}`}>
            {ledActive ? 'BLINKING (1000ms)' : 'OFF (LOW)'}
          </div>
        </div>

        {/* Piezo Siren / Buzzer */}
        <div className="card-glass actuator-box">
          <div className="actuator-info">
            <span className="actuator-icon">🔊</span>
            <div>
              <div className="card-label">Piezo Siren / Buzzer</div>
              <div className="actuator-pin font-mono">GPIO 4 (Active HIGH)</div>
              <div className="card-subtext">Audio Alarm Output</div>
            </div>
          </div>
          <div className={`actuator-status-pill ${buzzerActive ? 'pill-danger' : 'pill-off'}`}>
            {buzzerActive ? 'SIREN ACTIVE (200ms)' : 'MUTED'}
          </div>
        </div>

        {/* Current Cut Off Relay */}
        <div className="card-glass actuator-box">
          <div className="actuator-info">
            <span className="actuator-icon">⚡</span>
            <div>
              <div className="card-label">Current Cut Off Relay</div>
              <div className="actuator-pin font-mono">GPIO 27 (Active HIGH - Power Cut)</div>
              <div className="card-subtext">Main Power Safety Isolation</div>
            </div>
          </div>
          <div className={`actuator-status-pill ${powerCutRelayActive ? 'pill-cut' : 'pill-normal'}`}>
            {powerCutRelayActive ? 'POWER CUT (RELAY HIGH)' : 'NORMAL POWER (LOW)'}
          </div>
        </div>
      </div>

      {/* ROW 2: EXHAUST VENTILATION FAN & POWDER SERVO */}
      <div className="grid-2-cols" style={{ marginTop: '12px' }}>
        {/* Exhaust Fan */}
        <div className="card-glass actuator-box">
          <div className="actuator-info">
            <span className={`actuator-icon ${fanActive ? 'spin-icon' : ''}`}>🌀</span>
            <div>
              <div className="card-label">Exhaust Ventilation Fan</div>
              <div className="actuator-pin font-mono">GPIO 25 (Direct Motor Drive)</div>
              <div className="card-subtext">Autostart at Inside Temp &gt; 35.0°C</div>
            </div>
          </div>
          <div className={`actuator-status-pill ${fanActive ? 'pill-fan' : 'pill-off'}`}>
            {fanActive ? 'FAN RUNNING (HIGH)' : 'OFF (LOW)'}
          </div>
        </div>

        {/* Powder Servo Valve */}
        <div className="card-glass actuator-box">
          <div className="actuator-info">
            <span className="actuator-icon">🔧</span>
            <div>
              <div className="card-label">Extinguisher Powder Servo Gate</div>
              <div className="actuator-pin font-mono">GPIO 13 (PWM Servo Angle)</div>
              <div className="card-subtext">Automatic Powder Release Valve</div>
            </div>
          </div>
          <div className={`actuator-status-pill ${servoOpen ? 'pill-danger' : 'pill-off'}`}>
            {servoOpen ? 'GATE OPEN (90°)' : 'CLOSED (0° SEALED)'}
          </div>
        </div>
      </div>
    </div>
  )
}


