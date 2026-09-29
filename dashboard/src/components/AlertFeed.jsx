import { formatDistanceToNow } from 'date-fns'

/**
 * AlertFeed — live scrolling list of the latest risk_scores rows.
 * Props:
 *   alerts: Array of risk_scores rows (newest first, max 20)
 */
export default function AlertFeed({ alerts = [] }) {
  const tierClass = (tier) => tier?.toLowerCase() ?? 'safe'

  return (
    <div className="alert-feed" id="alert-feed">
      <div className="alert-feed-header">
        <div className="alert-feed-title">
          <span>⚡</span>
          Live Event Feed
        </div>
        <div className="alert-count">{alerts.length} events</div>
      </div>

      <div className="alert-list" id="alert-list">
        {alerts.length === 0 ? (
          <div className="alert-empty">
            Waiting for sensor data — run <code>python test_input.py --scenario normal</code>
          </div>
        ) : (
          alerts.map((alert) => {
            const tc = tierClass(alert.risk_tier)
            const timeAgo = alert.created_at
              ? formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })
              : ''
            return (
              <div className="alert-item" key={alert.id}>
                <div className={`alert-tier-dot ${tc}`} />
                <div className="alert-body">
                  <div className="alert-zone">{alert.zone}</div>
                  <div className="alert-sensors">
                    {alert.zone_thermal_avg != null && `T:${Number(alert.zone_thermal_avg).toFixed(1)}°C`}
                    {alert.humidity          != null && `  H:${Number(alert.humidity).toFixed(0)}%`}
                    {alert.gas_level         != null && `  G:${Number(alert.gas_level).toFixed(0)}`}
                    {alert.gas_baseline_drift!= null && `  Δ:${Number(alert.gas_baseline_drift)>0?'+':''}${Number(alert.gas_baseline_drift).toFixed(1)}`}
                  </div>
                </div>
                <div className="alert-score">
                  <div className={`alert-score-value ${tc}`}>
                    {Math.round(alert.risk_score)}
                  </div>
                  <div className="alert-time">{timeAgo}</div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
