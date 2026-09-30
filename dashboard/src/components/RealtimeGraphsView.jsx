import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

export default function RealtimeGraphsView({ liveHistory = [] }) {
  // Format history data for Recharts line charts
  const dataPoints = (Array.isArray(liveHistory) && liveHistory.length > 0)
    ? liveHistory.slice().reverse().map((row, idx) => {
        const timeStr = row.created_at
          ? new Date(row.created_at).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : `t-${idx * 3}s`

        return {
          time: timeStr,
          z1: Number((row.temp_z1 ?? 31.2).toFixed(1)),
          z2: Number((row.temp_z2 ?? 32.5).toFixed(1)),
          z3: Number((row.temp_z3 ?? 30.8).toFixed(1)),
          z4: Number((row.temp_z4 ?? 29.9).toFixed(1)),
          tIn: Number((row.temp_inside ?? 32.4).toFixed(1)),
          tOut: Number((row.temp_outside ?? 34.1).toFixed(1)),
          hIn: Number((row.humidity_inside ?? 48.0).toFixed(1)),
          hOut: Number((row.humidity_outside ?? 42.0).toFixed(1)),
          mq2: Math.round(row.mq2_val ?? 2450),
          mq135: Math.round(row.mq135_val ?? 950),
          flame: (row.flame_val ?? 0) > 0.5 ? 1 : 0
        }
      })
    : generateFallbackGraphData()

  return (
    <div className="realtime-graphs-container">
      <div className="actuators-header-title">
        <span className="title-icon">📈</span>
        <span>Real-Time Sensor Telemetry Dynamic Graphs (Cloud Supabase Stream)</span>
      </div>

      <div className="grid-2-cols">
        {/* GRAPH 1: 4 SPATIAL THERMAL ZONES */}
        <div className="card-glass chart-card">
          <div className="card-box-header">
            <span className="card-label">Spatial Thermal Zone Trends (°C)</span>
            <span className="unit-label font-mono">Zones 1-4</span>
          </div>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['dataMin - 2', 'dataMax + 5']} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="z1" name="Zone 1 (TL)" stroke="#818cf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="z2" name="Zone 2 (TR)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="z3" name="Zone 3 (BL)" stroke="#fbbf24" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="z4" name="Zone 4 (BR)" stroke="#f87171" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAPH 2: INSIDE VS OUTSIDE TEMPERATURE & HUMIDITY */}
        <div className="card-glass chart-card">
          <div className="card-box-header">
            <span className="card-label">Ambient Temp & Humidity (Inside vs Outside)</span>
            <span className="unit-label font-mono">DHT22 Sensors</span>
          </div>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="tIn" name="Temp In (°C)" stroke="#34d399" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="tOut" name="Temp Out (°C)" stroke="#a7f3d0" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                <Line type="monotone" dataKey="hIn" name="Humid In (%)" stroke="#60a5fa" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="hOut" name="Humid Out (%)" stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAPH 3: GAS SENSORS (MQ-2 & MQ-135) */}
        <div className="card-glass chart-card">
          <div className="card-box-header">
            <span className="card-label">Gas Sensor Concentration (PPM)</span>
            <span className="unit-label font-mono">MQ-2 & MQ-135</span>
          </div>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="mq2" name="MQ-2 Combustible Gas" stroke="#fbbf24" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="mq135" name="MQ-135 Air Quality" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAPH 4: IR FLAME SENSOR STATE */}
        <div className="card-glass chart-card">
          <div className="card-box-header">
            <span className="card-label">IR Flame Sensor Detection (0 = Clear, 1 = Flame)</span>
            <span className="unit-label font-mono">Pin 18 Digital</span>
          </div>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 1.2]} ticks={[0, 1]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="stepAfter" dataKey="flame" name="Flame Digital Read" stroke="#ef4444" strokeWidth={3} dot={true} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

function generateFallbackGraphData() {
  const pts = []
  const now = Date.now()
  for (let i = 10; i >= 0; i--) {
    const t = new Date(now - i * 3000).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    pts.push({
      time: t,
      z1: 31.5, z2: 32.0, z3: 31.8, z4: 30.5,
      tIn: 32.3, tOut: 34.0, hIn: 48.0, hOut: 42.0,
      mq2: 2450, mq135: 950, flame: 0
    })
  }
  return pts
}
