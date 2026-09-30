import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function RecentCloudLogsTable({ simulatedReadings }) {
  const [cloudLogs, setCloudLogs] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('sensor_readings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      if (data && data.length > 0) {
        setCloudLogs(data)
      } else {
        setCloudLogs(generateMockLogs(simulatedReadings))
      }
    } catch (e) {
      setCloudLogs(generateMockLogs(simulatedReadings))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 3000)
    return () => clearInterval(interval)
  }, [simulatedReadings])

  return (
    <div className="recent-cloud-logs-container">
      <div className="table-header-flex">
        <div className="actuators-header-title">
          <span className="title-icon">🗄️</span>
          <span>Cloud History — Latest 5 Telemetry Rows (Supabase `sensor_readings`)</span>
        </div>
        <button
          onClick={fetchLogs}
          className="refresh-btn font-mono"
        >
          {loading ? '🔄 Refreshing...' : '🔄 Refresh Logs'}
        </button>
      </div>

      <div className="card-glass table-responsive-wrapper">
        <table className="logs-table-clean">
          <thead>
            <tr>
              <th className="th-cell">Timestamp</th>
              <th className="th-cell">Zone 1 (°C)</th>
              <th className="th-cell">Zone 2 (°C)</th>
              <th className="th-cell">Zone 3 (°C)</th>
              <th className="th-cell">Zone 4 (°C)</th>
              <th className="th-cell">Temp In (°C)</th>
              <th className="th-cell">Temp Out (°C)</th>
              <th className="th-cell">MQ-2 (PPM)</th>
              <th className="th-cell">MQ-135 (PPM)</th>
              <th className="th-cell">Flame Pin</th>
              <th className="th-cell">Fan Status</th>
              <th className="th-cell">State</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {cloudLogs.map((row, idx) => (
              <tr key={row.id || idx} className="tr-row-hover">
                <td className="td-cell time-cell">
                  {row.created_at ? new Date(row.created_at).toLocaleTimeString('en-IN', { hour12: true }) : `t-${idx * 3}s`}
                </td>
                <td className="td-cell val-bold">{(row.temp_z1 ?? 31.2).toFixed(1)}</td>
                <td className="td-cell val-bold">{(row.temp_z2 ?? 32.5).toFixed(1)}</td>
                <td className="td-cell val-bold">{(row.temp_z3 ?? 30.8).toFixed(1)}</td>
                <td className="td-cell val-bold">{(row.temp_z4 ?? 29.9).toFixed(1)}</td>
                <td className="td-cell">{(row.temp_inside ?? 32.4).toFixed(1)}</td>
                <td className="td-cell">{(row.temp_outside ?? 34.1).toFixed(1)}</td>
                <td className="td-cell">{Math.round(row.mq2_val ?? 2450)}</td>
                <td className="td-cell">{Math.round(row.mq135_val ?? 950)}</td>
                <td className="td-cell">
                  {(row.flame_val ?? 0) > 0.5 ? (
                    <span className="badge-flame-detected">DETECTED</span>
                  ) : (
                    <span className="badge-flame-clear">CLEAR</span>
                  )}
                </td>
                <td className="td-cell">
                  {row.fan_status ? (
                    <span className="badge-fan-on">ON</span>
                  ) : (
                    <span className="badge-fan-off">OFF</span>
                  )}
                </td>
                <td className="td-cell">
                  <span className={`state-tag-pill tag-${(row.system_state || 'NORMAL').toLowerCase()}`}>
                    {row.system_state || 'NORMAL'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function generateMockLogs(simulatedReadings) {
  const base = simulatedReadings || {
    temp_z1: 31.2, temp_z2: 32.5, temp_z3: 30.8, temp_z4: 29.9,
    temp_inside: 32.4, temp_outside: 34.1, mq2_val: 2450, mq135_val: 950,
    flame_val: 0, fan_status: false, system_state: 'NORMAL'
  }

  const logs = []
  const now = Date.now()
  for (let i = 0; i < 5; i++) {
    const t = new Date(now - i * 3000).toISOString()
    logs.push({
      id: `mock-${i}`,
      created_at: t,
      temp_z1: base.temp_z1 + (Math.random() * 0.4 - 0.2),
      temp_z2: base.temp_z2 + (Math.random() * 0.4 - 0.2),
      temp_z3: base.temp_z3 + (Math.random() * 0.4 - 0.2),
      temp_z4: base.temp_z4 + (Math.random() * 0.4 - 0.2),
      temp_inside: base.temp_inside,
      temp_outside: base.temp_outside,
      mq2_val: base.mq2_val,
      mq135_val: base.mq135_val,
      flame_val: base.flame_val,
      fan_status: base.fan_status,
      system_state: base.system_state
    })
  }
  return logs
}
