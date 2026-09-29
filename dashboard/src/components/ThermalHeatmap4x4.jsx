import { useState } from 'react'

/**
 * ThermalHeatmap4x4 — Compact 4×4 IR Thermal Matrix (16 squares) for Zone Cards.
 *
 * Props:
 *   thermalGrid  — float[] array of 16 values (or fallback generated)
 *   avgTemp      — zone's average thermal reading
 *   tier         — risk tier ('Safe' | 'Moderate' | 'Dangerous')
 *   zone         — zone identifier
 */

const HOTSPOT_THRESHOLD = 50 // °C

function tempToColor(temp) {
  const MIN_TEMP = 25
  const MAX_TEMP = 65
  const t = Math.max(0, Math.min(1, (temp - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)))

  const stops = [
    [0.00, [13, 18, 55]],
    [0.20, [6, 90, 150]],
    [0.40, [16, 185, 129]],
    [0.60, [245, 158, 11]],
    [0.78, [239, 68, 68]],
    [1.00, [255, 245, 220]],
  ]

  let r = 0, g = 0, b = 0
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]
    const [t1, c1] = stops[i + 1]
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / (t1 - t0)
      r = Math.round(c0[0] + u * (c1[0] - c0[0]))
      g = Math.round(c0[1] + u * (c1[1] - c0[1]))
      b = Math.round(c0[2] + u * (c1[2] - c0[2]))
      break
    }
  }
  return `rgb(${r},${g},${b})`
}

function generate4x4Grid(avgTemp = 36.5, tier = 'Safe') {
  const base = typeof avgTemp === 'number' && !isNaN(avgTemp) ? avgTemp : 35.0
  const isDangerous = tier === 'Dangerous'
  const isModerate  = tier === 'Moderate'

  const grid = []
  const centerR = isDangerous ? 1 : 2
  const centerC = isDangerous ? 2 : 1

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const dist = Math.sqrt((r - centerR) ** 2 + (c - centerC) ** 2)
      const noise = Math.sin(r * 2.5 + c * 1.8) * 1.5
      let val = base - dist * 2.0 + noise

      if (isDangerous) {
        const boost = Math.max(0, (2.5 - dist) * 9.0)
        val += boost
      } else if (isModerate) {
        const boost = Math.max(0, (2.0 - dist) * 4.5)
        val += boost
      }

      grid.push(Math.round(Math.max(22.0, val) * 10) / 10)
    }
  }
  return grid
}

export default function ThermalHeatmap4x4({ thermalGrid = [], avgTemp = 36.5, tier = 'Safe', zone = '' }) {
  const [tooltip, setTooltip] = useState(null)

  // Extract 16 elements if provided, else generate 4x4 grid
  let grid = []
  if (Array.isArray(thermalGrid) && thermalGrid.length >= 16) {
    grid = thermalGrid.slice(0, 16)
  } else {
    grid = generate4x4Grid(avgTemp, tier)
  }

  const hotCount = grid.filter(t => t >= HOTSPOT_THRESHOLD).length
  const peakTemp = Math.max(...grid)

  return (
    <div className="thermal-4x4-wrap">
      <div className="thermal-4x4-header">
        <span className="thermal-4x4-title">4×4 IR Sensor Grid</span>
        <span className={hotCount > 0 ? "thermal-hotspot-badge" : "thermal-normal-badge"}>
          {hotCount > 0 ? `${hotCount} Hotspots` : `Peak ${peakTemp.toFixed(1)}°C`}
        </span>
      </div>

      <div className="thermal-grid-4x4" aria-label={`4x4 Thermal grid for ${zone}`}>
        {grid.map((temp, idx) => {
          const row = Math.floor(idx / 4) + 1
          const col = (idx % 4) + 1
          const isHot = temp >= HOTSPOT_THRESHOLD
          return (
            <div
              key={idx}
              className={`thermal-pixel-4x4${isHot ? ' thermal-pixel-hot' : ''}`}
              style={{ backgroundColor: tempToColor(temp) }}
              onMouseEnter={() => setTooltip({ row, col, temp })}
              onMouseLeave={() => setTooltip(null)}
            />
          )
        })}

        {tooltip && (
          <div className="thermal-tooltip-4x4">
            R{tooltip.row} C{tooltip.col}: {tooltip.temp.toFixed(1)}°C
          </div>
        )}
      </div>
    </div>
  )
}
