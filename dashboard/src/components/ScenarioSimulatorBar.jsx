import { useState, useEffect } from 'react'
import { SCENARIO_PRESETS } from '../scenarioPresets'

export default function ScenarioSimulatorBar({ activeScenario, onSelectScenario }) {
  const [autoPlay, setAutoPlay] = useState(false)

  const scenariosList = Object.values(SCENARIO_PRESETS)

  // Auto play feature for seamless demo
  useEffect(() => {
    if (!autoPlay) return
    const keys = Object.keys(SCENARIO_PRESETS)
    const interval = setInterval(() => {
      onSelectScenario(prevKey => {
        const currIdx = keys.indexOf(prevKey)
        const nextIdx = (currIdx + 1) % keys.length
        return keys[nextIdx]
      })
    }, 6000)
    return () => clearInterval(interval)
  }, [autoPlay, onSelectScenario])

  const current = activeScenario ? SCENARIO_PRESETS[activeScenario] : null

  return (
    <div className="simulator-bar-container">
      <div className="simulator-bar-header">
        <div className="simulator-title">
          <span className="sim-icon">⚡</span>
          <span>LIVE SCENARIO SIMULATOR</span>
          <span className="sim-subtitle">(Click any scenario to simulate & capture screenshots)</span>
        </div>
        <div className="simulator-controls">
          <button
            className={`sim-btn ${autoPlay ? 'active-autoplay' : ''}`}
            onClick={() => setAutoPlay(!autoPlay)}
            title="Automatically switch scenario every 6s"
          >
            {autoPlay ? '⏸ Pause Auto-Cycle' : '▶ Auto-Cycle (6s)'}
          </button>

          {activeScenario && (
            <button
              className="sim-btn reset-btn"
              onClick={() => { setAutoPlay(false); onSelectScenario(null) }}
            >
              📡 Reset to Live Supabase
            </button>
          )}
        </div>
      </div>

      {/* Scenario Buttons */}
      <div className="simulator-buttons-grid">
        {scenariosList.map((sc) => {
          const isActive = activeScenario === sc.id
          return (
            <button
              key={sc.id}
              className={`sim-scenario-btn ${sc.badgeClass} ${isActive ? 'active' : ''}`}
              onClick={() => { setAutoPlay(false); onSelectScenario(sc.id) }}
            >
              <div className="sim-sc-badge">{sc.badge}</div>
              <div className="sim-sc-name">{sc.name.split(':')[1]?.trim() || sc.name}</div>
            </button>
          )
        })}
      </div>

      {/* Selected Scenario Info Banner */}
      {current && (
        <div className={`simulator-banner ${current.badgeClass}`}>
          <div className="banner-top-row">
            <span className="banner-badge">{current.badge}</span>
            <span className="banner-sc-title">{current.name}</span>
          </div>
          <p className="banner-desc">{current.description}</p>
        </div>
      )}
    </div>
  )
}
