import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import ZoneCard from './ZoneCard'

const ZONES = ['Zone_1_Fill', 'Zone_2_Fill', 'Zone_3_Fill']
const GODOWN_ID = import.meta.env.VITE_GODOWN_ID ?? 'godown_filling_01'
const HISTORY_LIMIT = 30

/**
 * ZoneGrid — 2×2 grid of zone cards.
 * Subscribes to risk_scores real-time channel and maintains:
 *   - latest: { [zone]: latest_row }
 *   - history: { [zone]: last_N_rows }
 */
export default function ZoneGrid({ onLatestUpdate, simulatedLatest }) {
  const [latest, setLatest]   = useState({})
  const [history, setHistory] = useState({})

  // If simulated dataset is provided via Scenario Simulator
  useEffect(() => {
    if (simulatedLatest) {
      setLatest(simulatedLatest)
      onLatestUpdate?.(simulatedLatest)
    }
  }, [simulatedLatest, onLatestUpdate])
  useEffect(() => {
    async function fetchInitial() {
      for (const zone of ZONES) {
        const { data } = await supabase
          .from('risk_scores')
          .select('*')
          .eq('godown_id', GODOWN_ID)
          .eq('zone', zone)
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT)

        if (data && data.length > 0) {
          setLatest(prev => {
            const updated = { ...prev, [zone]: data[0] }
            onLatestUpdate?.(updated)
            return updated
          })
          setHistory(prev => ({ ...prev, [zone]: data }))
        }
      }
    }
    fetchInitial()
  }, [onLatestUpdate])

  // Subscribe to real-time inserts on risk_scores
  useEffect(() => {
    const channel = supabase
      .channel('risk_scores_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'risk_scores' },
        (payload) => {
          const row = payload.new
          if (!row || !ZONES.includes(row.zone)) return

          setLatest(prev => {
            const updated = { ...prev, [row.zone]: row }
            onLatestUpdate?.(updated)
            return updated
          })
          setHistory(prev => {
            const existing = prev[row.zone] ?? []
            const updated  = [row, ...existing].slice(0, HISTORY_LIMIT)
            return { ...prev, [row.zone]: updated }
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="zone-grid" id="zone-grid">
      {/* Zone_1_Fill — top left */}
      <ZoneCard
        zone="Zone_1_Fill"
        latest={latest['Zone_1_Fill']}
        history={history['Zone_1_Fill'] ?? []}
      />
      {/* Zone_2_Fill — top right */}
      <ZoneCard
        zone="Zone_2_Fill"
        latest={latest['Zone_2_Fill']}
        history={history['Zone_2_Fill'] ?? []}
      />
      {/* Zone_3_Fill — bottom left */}
      <ZoneCard
        zone="Zone_3_Fill"
        latest={latest['Zone_3_Fill']}
        history={history['Zone_3_Fill'] ?? []}
      />
      {/* Zone_4_Exit — bottom right (greyed, no monitoring) */}
      <ZoneCard
        zone="Zone_4_Exit"
        isExit={true}
      />
    </div>
  )
}
