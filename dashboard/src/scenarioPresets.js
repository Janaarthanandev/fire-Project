/**
 * scenarioPresets.js — Pre-built scenario state definitions for live interactive testing
 * & screenshot creation on the FireGuard Web Dashboard.
 *
 * Scenarios match the 7 Formal Report Scenarios (M2-1 to M2-7).
 */

export const SCENARIO_PRESETS = {
  normal: {
    id: 'normal',
    name: 'M2-1: Normal Operation',
    badge: '🟢 Safe Baseline',
    badgeClass: 'safe',
    description: 'Baseline normal state. Temp=35°C, No Flame, Gas=85ppm. M1=Safe (12.4), M2=LOG_ONLY (0% confidence). No emergency suppression active.',
    latest: {
      Zone_1_Fill: {
        id: 'r-1',
        godown_id: 'godown_filling_01',
        zone: 'Zone_1_Fill',
        risk_score: 12.4,
        risk_tier: 'Safe',
        zone_thermal_avg: 33.0,
        zone_thermal_trend: 0.2,
        humidity: 60.0,
        gas_level: 85.0,
        gas_baseline_drift: 2.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      },
      Zone_2_Fill: {
        id: 'r-2',
        godown_id: 'godown_filling_01',
        zone: 'Zone_2_Fill',
        risk_score: 10.1,
        risk_tier: 'Safe',
        zone_thermal_avg: 32.5,
        zone_thermal_trend: 0.1,
        humidity: 58.0,
        gas_level: 82.0,
        gas_baseline_drift: 1.5,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      },
      Zone_3_Fill: {
        id: 'r-3',
        godown_id: 'godown_filling_01',
        zone: 'Zone_3_Fill',
        risk_score: 11.8,
        risk_tier: 'Safe',
        zone_thermal_avg: 33.2,
        zone_thermal_trend: 0.2,
        humidity: 59.0,
        gas_level: 84.0,
        gas_baseline_drift: 2.1,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      }
    },
    fireEvents: [],
    alerts: [
      { id: 'a1', zone: 'Zone_1_Fill', risk_tier: 'Safe', risk_score: 12.4, zone_thermal_avg: 33.0, humidity: 60, gas_level: 85, gas_baseline_drift: 2.0, created_at: new Date().toISOString() },
      { id: 'a2', zone: 'Zone_2_Fill', risk_tier: 'Safe', risk_score: 10.1, zone_thermal_avg: 32.5, humidity: 58, gas_level: 82, gas_baseline_drift: 1.5, created_at: new Date().toISOString() },
      { id: 'a3', zone: 'Zone_3_Fill', risk_tier: 'Safe', risk_score: 11.8, zone_thermal_avg: 33.2, humidity: 59, gas_level: 84, gas_baseline_drift: 2.1, created_at: new Date().toISOString() }
    ]
  },

  moderate: {
    id: 'moderate',
    name: 'M2-2: Moderate Risk',
    badge: '🟡 Moderate Drift',
    badgeClass: 'moderate',
    description: 'Thermal rise in Zone 2 (Temp=42°C, Humidity=38%, Gas=165ppm). M1=Moderate (48.5), M2=LOG_ONLY (0% confidence). System flags warning baseline.',
    latest: {
      Zone_1_Fill: {
        id: 'r-1',
        godown_id: 'godown_filling_01',
        zone: 'Zone_1_Fill',
        risk_score: 18.2,
        risk_tier: 'Safe',
        zone_thermal_avg: 34.0,
        zone_thermal_trend: 0.4,
        humidity: 55.0,
        gas_level: 90.0,
        gas_baseline_drift: 4.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      },
      Zone_2_Fill: {
        id: 'r-2',
        godown_id: 'godown_filling_01',
        zone: 'Zone_2_Fill',
        risk_score: 48.5,
        risk_tier: 'Moderate',
        zone_thermal_avg: 42.0,
        zone_thermal_trend: 1.5,
        humidity: 38.0,
        gas_level: 165.0,
        gas_baseline_drift: 35.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      },
      Zone_3_Fill: {
        id: 'r-3',
        godown_id: 'godown_filling_01',
        zone: 'Zone_3_Fill',
        risk_score: 16.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 33.8,
        zone_thermal_trend: 0.3,
        humidity: 56.0,
        gas_level: 88.0,
        gas_baseline_drift: 3.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      }
    },
    fireEvents: [
      {
        id: 'ev-2',
        godown_id: 'godown_filling_01',
        fire_zone: 'Zone_2_Fill',
        confidence: 0.0,
        action_taken: 'LOG_ONLY',
        powder_released: false,
        powder_zones: [],
        created_at: new Date().toISOString()
      }
    ],
    alerts: [
      { id: 'a2', zone: 'Zone_2_Fill', risk_tier: 'Moderate', risk_score: 48.5, zone_thermal_avg: 42.0, humidity: 38, gas_level: 165, gas_baseline_drift: 35.0, created_at: new Date().toISOString() },
      { id: 'a1', zone: 'Zone_1_Fill', risk_tier: 'Safe', risk_score: 18.2, zone_thermal_avg: 34.0, humidity: 55, gas_level: 90, gas_baseline_drift: 4.0, created_at: new Date().toISOString() }
    ]
  },

  high_risk: {
    id: 'high_risk',
    name: 'M2-3: High Risk (Dual Trigger)',
    badge: '🟠 Emergency Fire',
    badgeClass: 'danger',
    description: 'Active pre-ignition & fire in Zone 1 (Temp=58°C, Flame=0.41, Gas=220ppm). M1=Dangerous (76.5), M2=EVACUATE (88% confidence). Powder released into Zone 2 & 3!',
    latest: {
      Zone_1_Fill: {
        id: 'r-1',
        godown_id: 'godown_filling_01',
        zone: 'Zone_1_Fill',
        risk_score: 76.5,
        risk_tier: 'Dangerous',
        zone_thermal_avg: 52.0,
        zone_thermal_trend: 4.5,
        humidity: 34.0,
        gas_level: 220.0,
        gas_baseline_drift: 55.0,
        flame_reading: 0.41,
        created_at: new Date().toISOString()
      },
      Zone_2_Fill: {
        id: 'r-2',
        godown_id: 'godown_filling_01',
        zone: 'Zone_2_Fill',
        risk_score: 24.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 35.0,
        zone_thermal_trend: 0.5,
        humidity: 50.0,
        gas_level: 95.0,
        gas_baseline_drift: 5.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      },
      Zone_3_Fill: {
        id: 'r-3',
        godown_id: 'godown_filling_01',
        zone: 'Zone_3_Fill',
        risk_score: 21.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 34.5,
        zone_thermal_trend: 0.4,
        humidity: 52.0,
        gas_level: 92.0,
        gas_baseline_drift: 4.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      }
    },
    fireEvents: [
      {
        id: 'ev-3',
        godown_id: 'godown_filling_01',
        fire_zone: 'Zone_1_Fill',
        confidence: 88.0,
        action_taken: 'EVACUATE',
        powder_released: true,
        powder_zones: ['Zone_2_Fill', 'Zone_3_Fill'],
        created_at: new Date().toISOString()
      }
    ],
    alerts: [
      { id: 'a1', zone: 'Zone_1_Fill', risk_tier: 'Dangerous', risk_score: 76.5, zone_thermal_avg: 52.0, humidity: 34, gas_level: 220, gas_baseline_drift: 55.0, created_at: new Date().toISOString() },
      { id: 'a2', zone: 'Zone_2_Fill', risk_tier: 'Safe', risk_score: 24.0, zone_thermal_avg: 35.0, humidity: 50, gas_level: 95, gas_baseline_drift: 5.0, created_at: new Date().toISOString() }
    ]
  },

  m2_4_high_m1_safe: {
    id: 'm2_4_high_m1_safe',
    name: 'M2-4: Thermal Spike (M1 Safe)',
    badge: '🔴 M2 Cascade Override',
    badgeClass: 'danger',
    description: '★ Core Project Innovation Scenario! M1 score is Safe (19.0) due to low historical trend, but Stage 1 Thermal Check (63°C > 50°C) triggers M2 → M2 EVACUATES (94% confidence) + Powder Release!',
    latest: {
      Zone_1_Fill: {
        id: 'r-1',
        godown_id: 'godown_filling_01',
        zone: 'Zone_1_Fill',
        risk_score: 19.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 48.0,
        zone_thermal_trend: 3.5,
        humidity: 52.0,
        gas_level: 268.0,
        gas_baseline_drift: 8.0,
        flame_reading: 0.61,
        created_at: new Date().toISOString()
      },
      Zone_2_Fill: {
        id: 'r-2',
        godown_id: 'godown_filling_01',
        zone: 'Zone_2_Fill',
        risk_score: 15.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 33.5,
        zone_thermal_trend: 0.2,
        humidity: 55.0,
        gas_level: 88.0,
        gas_baseline_drift: 3.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      },
      Zone_3_Fill: {
        id: 'r-3',
        godown_id: 'godown_filling_01',
        zone: 'Zone_3_Fill',
        risk_score: 14.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 33.0,
        zone_thermal_trend: 0.1,
        humidity: 56.0,
        gas_level: 85.0,
        gas_baseline_drift: 2.5,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      }
    },
    fireEvents: [
      {
        id: 'ev-4',
        godown_id: 'godown_filling_01',
        fire_zone: 'Zone_1_Fill',
        confidence: 94.0,
        action_taken: 'EVACUATE',
        powder_released: true,
        powder_zones: ['Zone_2_Fill', 'Zone_3_Fill'],
        created_at: new Date().toISOString()
      }
    ],
    alerts: [
      { id: 'a1', zone: 'Zone_1_Fill', risk_tier: 'Safe', risk_score: 19.0, zone_thermal_avg: 48.0, humidity: 52, gas_level: 268, gas_baseline_drift: 8.0, created_at: new Date().toISOString() }
    ]
  },

  edge_triggered: {
    id: 'edge_triggered',
    name: 'M2-5: Edge Failsafe Trip',
    badge: '⚡ Hardware Fast Path',
    badgeClass: 'danger',
    description: 'Severe fire in Zone 1 (Temp=71°C > 65°C, Flame=0.88 > 0.70, Gas=340ppm > 280ppm). ESP32 Edge hardware trips autonomous failsafe (<50ms fast path) before server roundtrip!',
    latest: {
      Zone_1_Fill: {
        id: 'r-1',
        godown_id: 'godown_filling_01',
        zone: 'Zone_1_Fill',
        risk_score: 92.0,
        risk_tier: 'Dangerous',
        zone_thermal_avg: 64.0,
        zone_thermal_trend: 14.0,
        humidity: 40.0,
        gas_level: 340.0,
        gas_baseline_drift: 180.0,
        flame_reading: 0.88,
        created_at: new Date().toISOString()
      },
      Zone_2_Fill: {
        id: 'r-2',
        godown_id: 'godown_filling_01',
        zone: 'Zone_2_Fill',
        risk_score: 22.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 35.5,
        zone_thermal_trend: 0.4,
        humidity: 50.0,
        gas_level: 96.0,
        gas_baseline_drift: 5.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      },
      Zone_3_Fill: {
        id: 'r-3',
        godown_id: 'godown_filling_01',
        zone: 'Zone_3_Fill',
        risk_score: 18.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 34.0,
        zone_thermal_trend: 0.3,
        humidity: 52.0,
        gas_level: 90.0,
        gas_baseline_drift: 4.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      }
    },
    fireEvents: [
      {
        id: 'ev-5',
        godown_id: 'godown_filling_01',
        fire_zone: 'Zone_1_Fill',
        confidence: 100.0,
        action_taken: 'EDGE FAILSAFE (Autonomous <50ms)',
        powder_released: true,
        powder_zones: ['Zone_2_Fill', 'Zone_3_Fill'],
        created_at: new Date().toISOString()
      }
    ],
    alerts: [
      { id: 'a1', zone: 'Zone_1_Fill', risk_tier: 'Dangerous', risk_score: 92.0, zone_thermal_avg: 64.0, humidity: 40, gas_level: 340, gas_baseline_drift: 180.0, created_at: new Date().toISOString() }
    ]
  },

  exit_hotspot: {
    id: 'exit_hotspot',
    name: 'M2-6: Exit Corridor Hotspot',
    badge: '🚪 Exit Protection Rule',
    badgeClass: 'moderate',
    description: 'Hotspot in Zone 4 (Exit Pathway) at 52°C. M2 triggers Supervisor Alert (54% confidence) but NO powder release in Exit Pathway to prevent trapping evacuees!',
    latest: {
      Zone_1_Fill: {
        id: 'r-1',
        godown_id: 'godown_filling_01',
        zone: 'Zone_1_Fill',
        risk_score: 14.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 33.5,
        zone_thermal_trend: 0.2,
        humidity: 58.0,
        gas_level: 86.0,
        gas_baseline_drift: 2.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      },
      Zone_2_Fill: {
        id: 'r-2',
        godown_id: 'godown_filling_01',
        zone: 'Zone_2_Fill',
        risk_score: 15.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 34.0,
        zone_thermal_trend: 0.3,
        humidity: 56.0,
        gas_level: 88.0,
        gas_baseline_drift: 3.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      },
      Zone_3_Fill: {
        id: 'r-3',
        godown_id: 'godown_filling_01',
        zone: 'Zone_3_Fill',
        risk_score: 13.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 33.0,
        zone_thermal_trend: 0.1,
        humidity: 59.0,
        gas_level: 84.0,
        gas_baseline_drift: 1.8,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      }
    },
    fireEvents: [
      {
        id: 'ev-6',
        godown_id: 'godown_filling_01',
        fire_zone: 'Zone_4_Exit',
        confidence: 54.0,
        action_taken: 'SUPERVISOR_ALERT',
        powder_released: false,
        powder_zones: [],
        created_at: new Date().toISOString()
      }
    ],
    alerts: [
      { id: 'a4', zone: 'Zone_4_Exit', risk_tier: 'Moderate', risk_score: 54.0, zone_thermal_avg: 52.0, humidity: 50, gas_level: 92, gas_baseline_drift: 5.0, created_at: new Date().toISOString() }
    ]
  },

  boundary_case: {
    id: 'boundary_case',
    name: 'M2-7: Boundary Case Containment',
    badge: '🔀 Selective Containment',
    badgeClass: 'moderate',
    description: 'Boundary elevated heat in Zone 1 (Temp=54°C, Gas=180ppm). M2 evacuates (78% confidence) and selectively triggers powder release in unaffected zones (Zone 2 & Zone 3).',
    latest: {
      Zone_1_Fill: {
        id: 'r-1',
        godown_id: 'godown_filling_01',
        zone: 'Zone_1_Fill',
        risk_score: 58.0,
        risk_tier: 'Moderate',
        zone_thermal_avg: 51.0,
        zone_thermal_trend: 3.5,
        humidity: 37.0,
        gas_level: 170.0,
        gas_baseline_drift: 38.0,
        flame_reading: 0.15,
        created_at: new Date().toISOString()
      },
      Zone_2_Fill: {
        id: 'r-2',
        godown_id: 'godown_filling_01',
        zone: 'Zone_2_Fill',
        risk_score: 18.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 34.2,
        zone_thermal_trend: 0.4,
        humidity: 55.0,
        gas_level: 90.0,
        gas_baseline_drift: 4.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      },
      Zone_3_Fill: {
        id: 'r-3',
        godown_id: 'godown_filling_01',
        zone: 'Zone_3_Fill',
        risk_score: 16.0,
        risk_tier: 'Safe',
        zone_thermal_avg: 33.6,
        zone_thermal_trend: 0.3,
        humidity: 56.0,
        gas_level: 88.0,
        gas_baseline_drift: 3.0,
        flame_reading: 0.0,
        created_at: new Date().toISOString()
      }
    },
    fireEvents: [
      {
        id: 'ev-7',
        godown_id: 'godown_filling_01',
        fire_zone: 'Zone_1_Fill',
        confidence: 78.0,
        action_taken: 'EVACUATE',
        powder_released: true,
        powder_zones: ['Zone_2_Fill', 'Zone_3_Fill'],
        created_at: new Date().toISOString()
      }
    ],
    alerts: [
      { id: 'a1', zone: 'Zone_1_Fill', risk_tier: 'Moderate', risk_score: 58.0, zone_thermal_avg: 51.0, humidity: 37, gas_level: 170, gas_baseline_drift: 38.0, created_at: new Date().toISOString() }
    ]
  }
}
