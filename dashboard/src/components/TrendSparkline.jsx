import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis, XAxis, ReferenceLine } from 'recharts'
import { format } from 'date-fns'

const TIER_COLORS = {
  Safe:      '#10b981',
  Moderate:  '#f59e0b',
  Dangerous: '#ef4444',
}

/**
 * TrendSparkline — mini line chart of last N M1 risk scores for a zone.
 * Props:
 *   history: Array<{ risk_score: number, created_at: string }>  (newest first)
 *   tier: 'Safe' | 'Moderate' | 'Dangerous'
 */
export default function TrendSparkline({ history = [], tier = 'Safe' }) {
  if (!history || history.length < 2) return null

  // Recharts needs data oldest → newest; fixed Y domain ensures consistent scale
  const data = [...history].reverse().map((row) => ({
    score: Math.round(row.risk_score),
    time: row.created_at
      ? format(new Date(row.created_at), 'HH:mm:ss')
      : '',
  }))

  const color = TIER_COLORS[tier] ?? '#6366f1'

  return (
    <div className="sparkline-wrap">
      <div className="sparkline-label">Risk trend — last {data.length} readings</div>
      <ResponsiveContainer width="100%" height={56}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <YAxis
            domain={[0, 100]}
            hide={false}
            tick={{ fontSize: 9, fill: 'rgba(230,237,243,0.4)' }}
            tickLine={false}
            axisLine={false}
            ticks={[0, 40, 70, 100]}
            width={32}
          />
          <XAxis hide dataKey="time" />
          {/* Safe/Dangerous reference lines */}
          <ReferenceLine y={40} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.3} />
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.3} />
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={true}
            animationDuration={400}
          />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div style={{
                  background: '#161b23',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: color,
                }}>
                  <div style={{ color: 'rgba(230,237,243,0.5)', fontSize: 10, marginBottom: 2 }}>
                    {payload[0]?.payload?.time}
                  </div>
                  Score: {payload[0].value}
                </div>
              ) : null
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
