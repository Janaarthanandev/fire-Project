import { useState } from 'react'

/**
 * ThermalHeatmap — 8×8 AMG8833 IR Thermal Camera Matrix (64 squares)
 *
 * Props:
 *   thermalGrid  — 64-element flat float[] of pixel temperatures (row-major)
 *   zone         — zone name (for ARIA label)
 *   tier         — current risk tier for context
 */

const HOTSPOT_THRESHOLD = 50 // °C, pixels above this are flagged

// Maps a temperature value to an RGBA color (25°C=blue to 60°C+=white-hot)
function tempToColor(temp) {
  const MIN_TEMP = 25
  const MAX_TEMP = 65
  const t = Math.max(0, Math.min(1, (temp - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)))

  // 5-stop gradient: deep-blue → cyan → teal → amber → orange → red → white-hot
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

function generateFallbackGrid(avgTemp = 36.5, tier = 'Safe') {
  const base = typeof avgTemp === 'number' && !isNaN(avgTemp) ? avgTemp : 38.0
  const isDangerous = tier === 'Dangerous'
  const isModerate  = tier === 'Moderate'

  const grid = []
  // Center of primary thermal anomaly
  const hotspotR = isDangerous ? 3 : isModerate ? 2 : 4
  const hotspotC = isDangerous ? 4 : isModerate ? 5 : 4

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dist = Math.sqrt((r - hotspotR) ** 2 + (c - hotspotC) ** 2)
      // Slight spatial variance
      const noise = Math.sin(r * 2.1 + c * 1.7) * 1.8
      let val = base - dist * 2.2 + noise

      if (isDangerous) {
        // High temp peak in center (e.g. 58°C - 64°C)
        const peakBoost = Math.max(0, (4.0 - dist) * 7.5)
        val += peakBoost
      } else if (isModerate) {
        // Moderate peak (e.g. 48°C - 52°C)
        const peakBoost = Math.max(0, (3.5 - dist) * 4.2)
        val += peakBoost
      }

      grid.push(Math.round(Math.max(22.0, val) * 10) / 10)
    }
  }
  return grid
}

export default function ThermalHeatmap({ thermalGrid = [], avgTemp = 36.5, zone = '', tier = 'Safe' }) {
  const [tooltip, setTooltip] = useState(null)

  // Use provided grid if valid 64 array, else generate fallback 8x8 matrix
  const grid = (Array.isArray(thermalGrid) && thermalGrid.length >= 64)
    ? thermalGrid.slice(0, 64)
    : generateFallbackGrid(avgTemp, tier)

  const hotPixelCount = grid.filter(t => t >= HOTSPOT_THRESHOLD).length
  const peakTemp = Math.max(...grid)
  const peakIdx = grid.indexOf(peakTemp)
  const peakRow = Math.floor(peakIdx / 8) + 1
  const peakCol = (peakIdx % 8) + 1

  return (
    <div className="thermal-heatmap-wrap">
      <div className="thermal-heatmap-header">
        <span className="thermal-heatmap-title">AMG8833 8×8 IR Matrix</span>
        {hotPixelCount > 0 ? (
          <span className="thermal-hotspot-badge">
            {hotPixelCount} hot pixel{hotPixelCount > 1 ? 's' : ''} &gt;{HOTSPOT_THRESHOLD}°C
          </span>
        ) : (
          <span className="thermal-normal-badge">No hotspots</span>
        )}
      </div>

      {/* 8×8 pixel grid */}
      <div className="thermal-grid" aria-label={`Thermal grid for ${zone}`}>
        {grid.map((temp, idx) => {
          const row = Math.floor(idx / 8) + 1
          const col = (idx % 8) + 1
          const isHot = temp >= HOTSPOT_THRESHOLD
          return (
            <div
              key={idx}
              className={`thermal-pixel${isHot ? ' thermal-pixel-hot' : ''}`}
              style={{ backgroundColor: tempToColor(temp) }}
              onMouseEnter={() => setTooltip({ row, col, temp })}
              onMouseLeave={() => setTooltip(null)}
            />
          )
        })}

        {/* Floating tooltip */}
        {tooltip && (
          <div className="thermal-tooltip">
            R{tooltip.row} C{tooltip.col} — {tooltip.temp.toFixed(1)}°C
          </div>
        )}
      </div>

      {/* Legend bar */}
      <div className="thermal-legend">
        <span>25°C</span>
        <div className="thermal-legend-bar" />
        <span>65°C+</span>
      </div>

      {/* Peak info */}
      <div className="thermal-peak-info">
        Peak: <strong>{peakTemp.toFixed(1)}°C</strong> @ Row {peakRow}, Col {peakCol}
      </div>
    </div>
  )
}
