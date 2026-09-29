import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDistanceToNow } from 'date-fns'

const GODOWN_ID = import.meta.env.VITE_GODOWN_ID ?? 'godown_filling_01'

/**
 * FireEventsLog — Displays live M2 Fire Suppression events, confidence scores,
 * powder release target zones, and critical fire emergency alert banners.
 */
export default function FireEventsLog({ simulatedEvents }) {
  const [events, setEvents] = useState([])

  // If simulated fire events provided via scenario simulator
  useEffect(() => {
    if (simulatedEvents !== undefined) {
      setEvents(simulatedEvents)
    }
  }, [simulatedEvents])
  useEffect(() => {
    async function fetchFireEvents() {
      const { data } = await supabase
        .from('fire_events')
        .select('*')
        .eq('godown_id', GODOWN_ID)
        .order('created_at', { ascending: false })
        .limit(10)

      if (data) setEvents(data)
    }
    fetchFireEvents()
  }, [])

  // Real-time subscription to fire_events table
  useEffect(() => {
    const channel = supabase
      .channel('fire_events_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fire_events' },
        (payload) => {
          const row = payload.new
          if (row) {
            setEvents(prev => [row, ...prev].slice(0, 10))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const activeEvent = events.length > 0 ? events[0] : null
  const isEmergency = activeEvent && activeEvent.confidence >= 75.0

  return (
    <div className="fire-events-container">
      {/* Critical Emergency Banner if fire event is active */}
      {isEmergency && (
        <div className="fire-emergency-banner">
          <div className="banner-pulse-icon">🚨</div>
          <div className="banner-content">
            <div className="banner-title">
              CRITICAL M2 FIRE SUPPRESSION TRIGGERED — {activeEvent.fire_zone?.replace(/_/g, ' ')}
            </div>
            <div className="banner-details">
              Confidence: <strong>{activeEvent.confidence}%</strong> | Action: {activeEvent.action_taken}
            </div>
            {activeEvent.powder_released && (
              <div className="banner-powder-targets">
                <span>💨 Powder Released into:</span>
                {(activeEvent.powder_zones || []).map(z => (
                  <span key={z} className="powder-zone-badge">{z.replace(/_/g, ' ')}</span>
                ))}
                <span className="exit-clear-badge">🚪 Zone 4 Exit Pathway CLEAR</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fire Events History Table / List */}
      <div className="fire-events-card">
        <div className="fire-events-header">
          <div className="fire-events-title">
            <span>🔥</span>
            <span>M2 Fire Suppression & Action Audit Log</span>
          </div>
          <div className="fire-event-count">{events.length} Recorded Events</div>
        </div>

        <div className="fire-events-list">
          {events.length === 0 ? (
            <div className="fire-events-empty">
              No active fire suppression events recorded. System operating normally.
            </div>
          ) : (
            events.map((ev) => {
              const timeAgo = ev.created_at
                ? formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })
                : ''
              const powderList = ev.powder_zones || []
              return (
                <div key={ev.id} className="fire-event-item">
                  <div className="event-item-left">
                    <span className="event-fire-icon">⚡</span>
                    <div>
                      <div className="event-zone-title">{ev.fire_zone?.replace(/_/g, ' ')}</div>
                      <div className="event-action-text">{ev.action_taken}</div>
                      {ev.powder_released && powderList.length > 0 && (
                        <div className="event-powder-chips">
                          <span className="chip-label">Powder Target:</span>
                          {powderList.map(pz => (
                            <span key={pz} className="powder-chip">{pz.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="event-item-right">
                    <div className="event-confidence-badge">
                      M2 Confidence: <strong>{ev.confidence}%</strong>
                    </div>
                    <div className="event-time">{timeAgo}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
