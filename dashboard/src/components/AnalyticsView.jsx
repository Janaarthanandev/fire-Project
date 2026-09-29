import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts'
import { SCENARIO_PRESETS } from '../scenarioPresets'

// Helper to generate dynamic history points for analytics charts based on scenario or latest readings
function generateAnalyticsSeries(activeScenario, latestReadings) {
  const scenario = activeScenario ? SCENARIO_PRESETS[activeScenario] : null
  const now = Date.now()

  const z1_base = scenario ? scenario.latest.Zone_1_Fill.risk_score : (latestReadings?.Zone_1_Fill?.risk_score ?? 15)
  const z2_base = scenario ? scenario.latest.Zone_2_Fill.risk_score : (latestReadings?.Zone_2_Fill?.risk_score ?? 12)
  const z3_base = scenario ? scenario.latest.Zone_3_Fill.risk_score : (latestReadings?.Zone_3_Fill?.risk_score ?? 11)

  const z1_temp = scenario ? (scenario.latest.Zone_1_Fill.zone_thermal_avg || 35) : (latestReadings?.Zone_1_Fill?.zone_thermal_avg ?? 35)
  const z1_gas  = scenario ? (scenario.latest.Zone_1_Fill.gas_level || 85) : (latestReadings?.Zone_1_Fill?.gas_level ?? 85)
  const z1_hum  = scenario ? (scenario.latest.Zone_1_Fill.humidity || 55) : (latestReadings?.Zone_1_Fill?.humidity ?? 55)

  const timeSeries = []
  const sensorSeries = []

  for (let i = 10; i >= 0; i--) {
    const timeLabel = new Date(now - i * 15000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    const factor = (10 - i) / 10

    // Smooth curve towards target values
    const z1 = Math.max(5, Math.min(100, Math.round((15 + (z1_base - 15) * factor) + (Math.sin(i * 0.8) * 2))))
    const z2 = Math.max(5, Math.min(100, Math.round((12 + (z2_base - 12) * factor) + (Math.cos(i * 0.6) * 1.5))))
    const z3 = Math.max(5, Math.min(100, Math.round((11 + (z3_base - 11) * factor) + (Math.sin(i * 1.1) * 1.2))))

    timeSeries.push({
      time: timeLabel,
      'Zone 1 Fill': z1,
      'Zone 2 Fill': z2,
      'Zone 3 Fill': z3,
    })

    const temp = Number((32 + (z1_temp - 32) * factor + (Math.sin(i * 0.5) * 0.5)).toFixed(1))
    const gas  = Math.round(80 + (z1_gas - 80) * factor)
    const hum  = Number((60 - (60 - z1_hum) * factor).toFixed(1))

    sensorSeries.push({
      time: timeLabel,
      'Temperature (°C)': temp,
      'Gas (ppm)': gas,
      'Humidity (%)': hum,
    })
  }

  // Zone comparison bar data
  const zoneBarData = [
    {
      name: 'Zone 1 Fill',
      'Risk Score': z1_base,
      'Temp (°C)': z1_temp,
      'Gas (ppm)': z1_gas,
    },
    {
      name: 'Zone 2 Fill',
      'Risk Score': z2_base,
      'Temp (°C)': scenario ? scenario.latest.Zone_2_Fill.zone_thermal_avg : (latestReadings?.Zone_2_Fill?.zone_thermal_avg ?? 33),
      'Gas (ppm)': scenario ? scenario.latest.Zone_2_Fill.gas_level : (latestReadings?.Zone_2_Fill?.gas_level ?? 82),
    },
    {
      name: 'Zone 3 Fill',
      'Risk Score': z3_base,
      'Temp (°C)': scenario ? scenario.latest.Zone_3_Fill.zone_thermal_avg : (latestReadings?.Zone_3_Fill?.zone_thermal_avg ?? 33),
      'Gas (ppm)': scenario ? scenario.latest.Zone_3_Fill.gas_level : (latestReadings?.Zone_3_Fill?.gas_level ?? 84),
    },
    {
      name: 'Zone 4 Exit',
      'Risk Score': activeScenario === 'exit_hotspot' ? 54 : 5,
      'Temp (°C)': activeScenario === 'exit_hotspot' ? 52 : 33,
      'Gas (ppm)': activeScenario === 'exit_hotspot' ? 92 : 80,
    }
  ]

  return { timeSeries, sensorSeries, zoneBarData }
}

export default function AnalyticsView({ activeScenario, latestReadings }) {
  const [data, setData] = useState({ timeSeries: [], sensorSeries: [], zoneBarData: [] })

  useEffect(() => {
    setData(generateAnalyticsSeries(activeScenario, latestReadings))
  }, [activeScenario, latestReadings])

  return (
    <div className="analytics-view" id="analytics-section">
      <div className="analytics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
        
        {/* Chart 1: Multi-Zone Risk Evolution */}
        <div className="analytics-card" id="analytics-risk_trend">
          <div className="analytics-card-header">
            <div className="analytics-card-title">📈 Multi-Zone Risk Score Evolution (Live Trend)</div>
          </div>
          <div style={{ width: '100%', height: 260, padding: '12px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeSeries} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorZ1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorZ2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorZ3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="#4a5568" tick={{ fontSize: 10, fill: '#8b95a8' }} />
                <YAxis domain={[0, 100]} stroke="#4a5568" tick={{ fontSize: 10, fill: '#8b95a8' }} />
                <Tooltip
                  contentStyle={{ background: '#161b23', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <ReferenceLine y={40} label={{ value: 'Moderate (40)', fill: '#f59e0b', fontSize: 10 }} stroke="#f59e0b" strokeDasharray="3 3" />
                <ReferenceLine y={70} label={{ value: 'Danger (70)', fill: '#ef4444', fontSize: 10 }} stroke="#ef4444" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="Zone 1 Fill" stroke="#ef4444" fillOpacity={1} fill="url(#colorZ1)" strokeWidth={2} />
                <Area type="monotone" dataKey="Zone 2 Fill" stroke="#f59e0b" fillOpacity={1} fill="url(#colorZ2)" strokeWidth={2} />
                <Area type="monotone" dataKey="Zone 3 Fill" stroke="#10b981" fillOpacity={1} fill="url(#colorZ3)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-card-desc">
            Real-time M1 pre-ignition risk score trends across all monitored filling zones. Thresholds at 40 (Moderate) and 70 (Dangerous).
          </div>
        </div>

        {/* Chart 2: Feature Correlation (Temp, Gas, Humidity) */}
        <div className="analytics-card" id="analytics-feature_corr">
          <div className="analytics-card-header">
            <div className="analytics-card-title">🔗 Sensor Feature Fusion & Correlation Matrix</div>
          </div>
          <div style={{ width: '100%', height: 260, padding: '12px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sensorSeries} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="#4a5568" tick={{ fontSize: 10, fill: '#8b95a8' }} />
                <YAxis yAxisId="left" stroke="#8b95a8" tick={{ fontSize: 10, fill: '#8b95a8' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#6366f1" tick={{ fontSize: 10, fill: '#6366f1' }} />
                <Tooltip
                  contentStyle={{ background: '#161b23', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line yAxisId="left" type="monotone" dataKey="Temperature (°C)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="Gas (ppm)" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="Humidity (%)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-card-desc">
            Physical correlation between Thermal Max (°C), MQ-2/MQ-135 Gas (ppm), and Humidity drop (%). Inverse humidity relationship signals evaporation during pre-ignition heating.
          </div>
        </div>

        {/* Chart 3: Zone Comparison & Anomaly Distribution */}
        <div className="analytics-card" id="analytics-anomaly_dist">
          <div className="analytics-card-header">
            <div className="analytics-card-title">📊 Multi-Zone Sensor Readout Comparison</div>
          </div>
          <div style={{ width: '100%', height: 260, padding: '12px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.zoneBarData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="#4a5568" tick={{ fontSize: 10, fill: '#8b95a8' }} />
                <YAxis stroke="#8b95a8" tick={{ fontSize: 10, fill: '#8b95a8' }} />
                <Tooltip
                  contentStyle={{ background: '#161b23', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="Risk Score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Temp (°C)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gas (ppm)" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-card-desc">
            Comparative analysis across Godown Filling Zones and Exit Corridor. Highlights anomaly discrepancies and local hotspot concentration.
          </div>
        </div>

      </div>
    </div>
  )
}
