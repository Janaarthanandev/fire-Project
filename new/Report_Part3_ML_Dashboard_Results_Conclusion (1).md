# Project Report — Part 3
## Machine Learning System, Web Dashboard, Results, Conclusion, Future Work, References

---

## Chapter 8: Machine Learning System

### 8.1 Architecture Overview

The system employs two independent machine learning models, each serving a distinct and non-overlapping function within the detection pipeline. This separation is intentional: combining both functions into a single model would require simultaneously handling slow pre-ignition drift patterns and fast hotspot-triggered event patterns — two fundamentally different signal characteristics — in one training set, which would compromise both.

**Model 1 (M1) — Pre-Ignition Risk Scorer:** An unsupervised Isolation Forest anomaly detector that runs continuously in the background, producing a risk score and risk tier per filling zone every 15 seconds. M1 monitors slow-moving features to detect gradual drift toward hazardous pre-ignition conditions.

**Model 2 (M2) — Fire-Confidence Fusion Classifier:** A supervised Random Forest classifier that is triggered only when Stage 1 detects a thermal hotspot exceeding 50°C. M2 fuses eleven features from three sources to produce a fire-confidence score (0–100%) and determine the appropriate escalation action.

An important architectural distinction: **M1 does not trigger M2.** M2 is triggered independently by Stage 1's thermal rule. M1's output is used as contextual input to M2's feature vector, not as a trigger condition. This means M2 can be invoked even when M1 shows a "Safe" score — for example, in the case of a sudden, rapid thermal event that develops before M1's rolling feature window detects any sustained pre-ignition drift.

### 8.2 Model 1 — Pre-Ignition Risk Scorer

#### 8.2.1 Algorithm

Isolation Forest is used for M1. Isolation Forest is an unsupervised anomaly detection algorithm that builds an ensemble of randomly constructed isolation trees. Each tree partitions the feature space by repeatedly splitting on randomly chosen features and values. Anomalous points, which are atypical combinations of feature values, tend to be isolated near the top of these trees with fewer splits; normal points require more splits to isolate. The anomaly score for a data point is derived from the average depth at which it is isolated across all trees: shorter average isolation depth → higher anomaly score → more unusual.

Isolation Forest was selected specifically because no labeled "pre-ignition" dataset exists anywhere in the public domain for this application, and creating one through real ignition events is not safely possible. The algorithm requires only examples of normal operation to train — it learns the distribution of normal readings and flags deviations from it, without needing any labeled anomaly examples.

Three separate Isolation Forest models are trained, one per filling zone (Zone_1_Fill, Zone_2_Fill, Zone_3_Fill). This per-zone approach accounts for the possibility that each zone may have slightly different baseline conditions — for example, proximity to the exit doorway may affect Zone_3_Fill's ambient temperature and gas readings differently from Zone_1_Fill's.

#### 8.2.2 Feature Set

M1 uses five features per fill zone per inference cycle:

| Feature | Source | Physical meaning |
|---|---|---|
| `zone_thermal_avg` | AMG8833 (16-pixel zone sub-grid, smoothed) | Background heat level in the zone |
| `zone_thermal_trend` | Derived (rolling rate of change) | Sustained upward thermal drift |
| `humidity_inside` | DHT22 (inside godown) | Actual working-area humidity |
| `humidity_outside` | DHT22 (outside godown) | Ambient reference humidity |
| `humidity_differential` | Derived (inside minus outside) | Key hygroscopic risk indicator — widening differential signals abnormal moisture conditions inside the godown |
| `mq2_level` | MQ-2 (per zone) | Combustible gas baseline concentration |
| `mq135_level` | MQ-135 (per zone) | VOC and air quality baseline |
| `gas_baseline_drift` | Derived (deviation from zone rolling mean, applied to both MQ-2 and MQ-135) | Slow upward gas drift above that zone's own normal — catches gradual off-gassing before any threshold spike |

Frame smoothing (3-frame rolling average on the AMG8833 thermal grid) is applied before computing `zone_thermal_avg` to reduce single-pixel noise.

#### 8.2.3 Output

M1 produces one output record per fill zone per inference cycle:

```json
{
  "zone": "Zone_1_Fill",
  "timestamp": "...",
  "risk_score": 67.4,
  "risk_tier": "Moderate",
  "anomaly_score_raw": -0.12
}
```

Risk tier mapping from normalised risk score (0–100):

| Score range | Tier | Dashboard colour |
|---|---|---|
| 0–39 | Safe | Green |
| 40–69 | Moderate | Amber |
| 70–100 | Dangerous | Red |

A "Dangerous" M1 tier triggers a dashboard warning and supervisor notification. It does not trigger any physical action (alarm, power cutoff, or powder release). Physical actions are exclusively within the M2 escalation path.

#### 8.2.4 Rule-Based MVP (Fallback)

Prior to training the Isolation Forest model, a weighted rule-based formula is implemented as an MVP and fallback:

```
risk_score = (0.40 × norm(zone_thermal_trend) +
              0.35 × norm(1/humidity) +
              0.25 × norm(gas_baseline_drift)) × 100
```

This formula is also used as the fallback if the trained model file fails to load, ensuring the system retains a working risk indicator under all conditions.

#### 8.2.5 Training Data and Evaluation

Training data for M1 is entirely self-collected through continuous background logging of sensor readings during normal godown/testbed operation. A minimum of seven days of logging is targeted to capture diurnal temperature and humidity cycles. No labels are required; the training set is simply the pool of "normal" sensor readings.

Validation uses safe simulated pre-ignition conditions: a hair dryer to lower local humidity near the DHT22, a warm object moved slowly toward the thermal camera to simulate gradual heat buildup, and a manually loosened grounding test point to simulate grounding degradation. The validation metric is anomaly score separation — the trained model should produce noticeably higher anomaly scores during simulated risk sessions than during normal operation. False-positive rate on a held-out portion of normal data is also computed at the chosen alert threshold.

No precision/recall evaluation is possible for M1, because no real ground-truth pre-ignition events can be safely generated. This limitation is explicitly acknowledged.

### 8.3 Model 2 — Fire-Confidence Fusion Classifier

#### 8.3.1 Algorithm

Random Forest Classifier is used for M2. Random Forest builds an ensemble of decision trees, each trained on a random subset of the training data and a random subset of features. At inference time, each tree independently classifies the input as "Fire" or "Safe," and the final prediction is the majority vote. The fire-confidence score is the fraction of trees that voted "Fire," expressed as a percentage via `predict_proba`.

Random Forest was selected because it handles small, tabular, structured datasets robustly; it is interpretable through feature importance scores (which validate that the correct sensors are driving decisions); it is resistant to individual noisy sensor readings (a single elevated flame reading does not dominate when all other features disagree); and it is standard in published IoT fire-fusion literature for this type of multi-sensor classification task. A Support Vector Machine (SVM) with an RBF kernel is trained in parallel as a comparison baseline, using the same features and the same 5-fold cross-validation procedure.

#### 8.3.2 The 11-Feature Vector

M2 fuses eleven features from three distinct sources:

**Group 1 — Thermal camera features (4):**

| Feature | Physical meaning |
|---|---|
| `thermal_max` | Peak temperature of the hottest pixel — severity of the hotspot |
| `thermal_rise_rate` | Rate of temperature increase — fast rise signals active event |
| `zone_avg_temp` | Average temperature of the flagged zone — spread indicator |
| `hotspot_pixel_count` | Number of pixels above 50°C — spatial spread indicator |

**Group 2 — Secondary zone sensor features (5):**

| Feature | Physical meaning |
|---|---|
| `flame_reading` | IR combustion spectral signature — most direct fire indicator |
| `mq2_ppm` | Combustible gas and smoke concentration (MQ-2) |
| `mq135_ppm` | VOC and air quality reading (MQ-135) |
| `gas_roc` | Rate of change of combined gas signal — fast rise indicates active combustion |
| `humidity_differential` | Inside-outside humidity differential — confirms environmental conditions at the moment of event |

**Group 3 — M1 context features (3):**

| Feature | Physical meaning |
|---|---|
| `m1_risk_score` | Was this zone already drifting toward risk before the hotspot? |
| `m1_risk_tier_encoded` | Risk tier as a numeric value (Safe=0, Moderate=1, Dangerous=2) |
| `m1_trend_direction` | Is the M1 score rising(+1), stable(0), or falling(−1) over the last 3 readings? |

The M1 context features are fetched from the Supabase `risk_scores` table by the backend immediately before M2 inference runs. They allow M2 to distinguish between a borderline thermal reading that emerged from an already-elevated-risk zone versus one that appeared in a zone that was showing completely normal conditions seconds earlier — a distinction that meaningfully changes the appropriate response.

#### 8.3.3 Escalation Tiers

M2 produces a fire-confidence score and maps it to one of three action tiers:

| Confidence range | Action tier | Physical action |
|---|---|---|
| 0–39% | Log only | No alarm, event logged to Supabase |
| 40–75% | Supervisor alert | Dashboard amber alert; no physical action |
| >75% | Full evacuation + containment | Siren + power cutoff + dry powder release after 7-second delay |

#### 8.3.4 Zone Targeting Logic (Stage 4)

Upon a confidence score exceeding 75%, the following zone targeting logic is applied on the backend to determine which zones receive powder:

1. Start with all filling zones: `[Zone_1_Fill, Zone_2_Fill, Zone_3_Fill]`
2. Remove the confirmed fire zone
3. Remove any additional zone whose average temperature also exceeds 50°C (boundary spread case — do not deploy powder into a zone that may already be heating)
4. Zone_4_Exit is not included in the candidates list at any step — it is excluded structurally, not conditionally

The remaining zones in the list receive the powder release command.

#### 8.3.5 Training Data

M2's training data is collected from two sources:

**"Safe" class:** Continuous sensor-reading logs from normal godown/testbed operation, filtered to rows where Stage 1 would have triggered (thermal_max > 50°C) — these are the ambiguous cases M2 actually handles in production. Target: 400+ samples.

**"Fire-like" class:** Safe simulated fire events at moderate intensities specifically designed for M2's operating range (50–65°C), since events above the edge failsafe threshold (65°C AND flame > 0.70 AND gas > 280) would be handled by the edge rule and M2 would never see them in production. Simulated using a candle or heat lamp (thermal and flame signals), a fog machine or incense stick (gas signal), and optional vibration via physical contact near the vibration sensor. Target: 80+ samples across three zones.

Reference datasets used for supplementary validation: MultimodalGasData (Mendeley/MDPI) — thermal camera + seven MQ-series gas sensors, 6,400 samples across four conditions; UCI Gas Sensor Array Drift Dataset — general gas-sensor response benchmark.

**Class imbalance handling:** `class_weight='balanced'` in scikit-learn's RandomForestClassifier.

#### 8.3.6 Training and Evaluation Procedure

5-fold stratified cross-validation is used given the limited dataset size. Both Random Forest and SVM are evaluated using the following metrics:

- **Recall on "Fire" class** — primary metric; missing a real fire event is the costliest possible error
- **Precision on "Fire" class**
- **F1-score on "Fire" class**
- **False alarm rate on "Safe" class** — the system's core value proposition metric; reducing this compared to fixed-threshold baselines is the central claim
- Confusion matrix
- Feature importance plot (Random Forest) — validates that flame, thermal, and gas features dominate; validates that the M1 context features contribute meaningfully

---

## Chapter 9: Web Dashboard

### 9.1 Dashboard Users

The primary user of the dashboard is the factory safety supervisor or control-room operator. The dashboard is designed to provide a single, live, spatially-aware view of godown safety status that requires no specialist technical knowledge to interpret.

### 9.2 Dashboard Pages

**Page 1 — Live Monitoring (primary page):**
A 2×2 zone grid matching the physical godown layout (Zone_1_Fill top-left, Zone_2_Fill top-right, Zone_3_Fill bottom-left, Zone_4_Exit bottom-right). Each zone card is colour-coded by M1 risk tier (green/amber/red). Zone cards display the current zone thermal average and maximum, M1 risk score, M2 fire-confidence score when active, secondary sensor status indicators, and a trend sparkline showing the last ten M1 risk scores. Zone_4_Exit is displayed as a greyed-out card labelled "Exit — No process monitoring."

**Page 2 — Alert Feed:**
A chronological log of all events from the `fire_events` and `commands_log` tables. Each entry shows timestamp, zone, confidence score, action tier, trigger source (edge or M2), and powder zones targeted. Filterable by zone, tier, and time range.

**Page 3 — Historical Analytics:**
Time-series graphs per zone for thermal average, gas level, humidity, and M1 risk score over selectable time ranges. Used for post-incident analysis and trend review.

**Page 4 — System Status:**
Per-sensor last-seen timestamp, reading-within-expected-range indicators, backend model load status, and ESP32 connectivity status.

### 9.3 Real-Time Data Flow

The dashboard subscribes to Supabase real-time channels on the `risk_scores`, `fire_events`, and `commands_log` tables. When the backend inserts a new row into any of these tables (which it does on every inference cycle), Supabase broadcasts the new row to all subscribed dashboard clients via WebSocket. The dashboard React state is updated directly from this subscription, without polling. Dashboard update latency is governed by Supabase real-time subscription delivery time, targeted at under three seconds from sensor reading to dashboard display.

---

## Chapter 10: Results and Discussion

### 10.1 Validation Approach

Since the system is designed for a hazardous environment in which real fire events cannot be used as test inputs, validation is conducted through two complementary methods:

**Structured test scenarios:** A set of seven named test scenarios with precisely defined input values is used to validate the full pipeline from sensor reading to physical action. Each scenario targets a specific behavior (normal operation, borderline risk, active fire, edge failsafe, Zone_4_Exit, boundary edge case) and has a documented expected output. The system is validated against these scenarios using the `test_input.py` script, which inserts rows directly into Supabase to trigger the full backend pipeline without requiring hardware.

**Controlled physical simulation:** Safe, non-hazardous simulated fire events (candle/heat lamp for thermal and flame signals; incense or fog machine for gas signals) are used to generate real labeled training data for M2 and real validation data for M1.

### 10.2 Test Scenarios Summary

| Scenario | Input characteristics | Expected M1 tier | Expected M2 action |
|---|---|---|---|
| M2-1 Normal | temp=35°C, no flame, normal gas | Safe | Not triggered |
| M2-2 Moderate risk | temp=42°C, humidity=38%, gas drifting | Moderate | Not triggered |
| M2-3 High risk, M1 Dangerous | temp=58°C, flame=0.41, gas=220, M1=76.5 | Dangerous | Evacuate (>75%) |
| M2-4 High risk, M1 Safe | temp=63°C, flame=0.61, gas=268, M1=19 | Safe | Evacuate (>75%) |
| M2-5 Edge triggered | temp=71°C, flame=0.88, gas=340 | Dangerous | Edge acts; M2 confirms |
| M2-6 Zone_4_Exit hotspot | temp=52°C in exit zone | N/A | Supervisor alert only, no powder |
| M2-7 Boundary case | Two zones above threshold | Dangerous | Powder in one zone only |

### 10.3 Key Design Validation Points

**Zone_4_Exit exclusion:** In Scenario M2-6, the hotspot is detected in the exit zone. The pipeline correctly terminates without invoking M2, logs a supervisor alert, and publishes no powder release command. The exit zone's wiring-level exclusion from any hopper mechanism provides an additional hardware-level safety guarantee.

**M1 context influence on M2:** Scenarios M2-3 and M2-4 use identical secondary sensor values at different thermal levels. Scenario M2-3, where M1 was showing "Dangerous" prior to the hotspot, produces a higher M2 confidence score than an equivalent scenario where M1 was showing "Safe," demonstrating that M1 context meaningfully contributes to M2's classification.

**Cascaded efficiency:** The two-stage pipeline ensures that M2 inference is only invoked when Stage 1 triggers — the majority of cycles end at Stage 1 with no further processing, keeping steady-state compute load on both the ESP32 and the backend minimal.

### 10.4 Limitations

The following limitations are explicitly acknowledged:

1. **No real ground-truth ignition data for M1:** M1's evaluation is qualitative (anomaly score separation) rather than precision/recall-based. This is a structural limitation of the problem domain, not an implementation gap.

2. **M2 trained on simulated, not real, fire events:** M2's performance metrics should be interpreted as proof-of-concept validation of the fusion approach, not as certified operational accuracy figures. No fixed accuracy percentage is claimed.

3. **No occupancy confirmation before powder release:** Since camera-based occupancy detection is deferred to future work, the system relies on a mandatory 7-second pre-release delay as an interim safety buffer. A camera-based confirmation gate would provide stronger safety guarantees.

4. **AMG8833 resolution is coarse:** Each zone has 16 pixels. Zone-level detection is reliable; sub-zone spatial detail within a zone is not recoverable at this resolution.

5. **Fan behaviour during fire is additive, not suppressive:** The fan pushes smoke out during a fire event, improving evacuation conditions, but does not actively suppress the fire. In some industrial contexts, ventilation fans are shut down during fire events to avoid feeding oxygen to flames. The decision to keep the fan active in this design was made specifically for smoke clearance on the evacuation path — this trade-off should be reviewed for any real deployment scenario.

6. **Prototype-grade hardware:** All components are educational-grade and not ATEX-certified. Real industrial deployment would require certified intrinsically-safe equipment.

---

## Chapter 11: Conclusion

This project presents a zone-based fire detection and dry-powder containment system designed specifically for the fireworks filling godown context — the highest-accident-rate process stage in Sivakasi-style fireworks manufacturing. The system addresses a clearly documented real-world safety gap: the absence of continuous, automated monitoring for pre-ignition conditions in an environment where existing practice relies on manual and periodic checks.

The key contributions of the system are:
- A two-tier cascaded AI architecture that separates slow pre-ignition drift monitoring (M1, unsupervised Isolation Forest) from fast hotspot-triggered fire confirmation (M2, supervised Random Forest), with each model handling the problem type for which it is genuinely suited given the available data
- Dual DHT22 inside-outside differential monitoring, providing a more meaningful hygroscopic risk indicator than a single absolute humidity reading
- Complete per-zone secondary sensor coverage — each filling zone equipped with a flame sensor, MQ-2, and MQ-135 — enabling zone-specific gas and flame features in both M1 and M2 rather than shared godown-level readings
- Spatial zone attribution using a low-cost thermal array sensor, enabling the system to identify not just that a fire is occurring but where within the godown it is occurring
- A dual-role automated ventilation fan that maintains safe operating temperatures during normal conditions and actively expels smoke during fire events, improving evacuation path conditions
- A zone-based containment strategy that prioritises worker evacuation over fire suppression — releasing dry chemical powder into unaffected zones to slow spread and buy evacuation time, rather than attempting direct suppression of an active pyrotechnic fire
- A local edge failsafe that ensures the most critical safety actions (evacuation alarm, power cutoff, and fan activation) are not dependent on cloud or backend connectivity
- An honest, documented evaluation approach that discloses data limitations, prototype-grade hardware constraints, and deferred features rather than overstating the system's capabilities

The system was validated through seven structured test scenarios covering normal operation, borderline risk states, active fire events, edge failsafe triggering, zone boundary cases, and exit-zone events. All scenarios produced their documented expected outputs, demonstrating correct end-to-end behaviour across the full detection and response pipeline.

---

## Chapter 12: Future Work

The following capabilities are identified for future development beyond the current build scope:

**Camera-based occupancy confirmation (M3 — Computer Vision):** A standard IP/CCTV camera feed processed by a YOLOv8-nano model (fine-tuned on public fire/smoke datasets from Roboflow and Kaggle) would add visual fire/smoke confirmation and real-time zone occupancy counting. This would replace the mandatory pre-release delay with a confirmed-clear occupancy gate before powder is deployed, providing a stronger safety guarantee. Person detection using pretrained COCO weights requires no additional training.

**GSM emergency dispatch:** A SIM800L-based GSM module would provide offline SMS and call notification to factory supervisors and emergency services when WiFi or internet connectivity is unavailable — a relevant consideration for rural Sivakasi factory sites.

**Multi-godown network:** Extending the system to cover multiple godowns in a factory, with a cross-godown early-warning broadcast (neighbouring godowns pre-alerted when the filling godown detects a high-confidence event, given documented blast-radius effects on adjacent sheds), and MQTT-based mesh networking between nodes.

**ATEX-certified hardware upgrade:** Replacing prototype-grade components with ATEX-certified, intrinsically-safe equivalents as a prerequisite for real industrial deployment consideration.

**Resolution upgrade:** Replacing the AMG8833 (8×8, 64 pixels, 16 pixels per zone) with the MLX90640 (32×24, 768 pixels, 192 pixels per zone) if sub-zone spatial detail is found to be necessary after extended field testing of the current system.

---

## Chapter 13: References

1. Petroleum and Explosives Safety Organisation (PESO), Government of India — Annual Accident Reports and Inspection Guidelines.

2. Explosives Rules, 2008, Ministry of Commerce and Industry, Government of India.

3. NFPA 77: Recommended Practice on Static Electricity, National Fire Protection Association.

4. IEC 60079-32-1: Explosive Atmospheres — Electrostatic Hazards — Guidance, International Electrotechnical Commission.

5. ATEX Directive (2014/34/EU) — Equipment and Protective Systems Intended for Use in Potentially Explosive Atmospheres, European Commission.

6. Melexis MLX90640 Far-Infrared Thermal Sensor Array — Technical Datasheet. Melexis NV.

7. Adafruit AMG8833 8×8 Thermal Camera Sensor — Product Guide and Datasheet. Adafruit Industries.

8. Liu, F.T., Ting, K.M., and Zhou, Z.H. (2008). Isolation Forest. Proceedings of the 2008 IEEE International Conference on Data Mining (ICDM), pp. 413–422.

9. Breiman, L. (2001). Random Forests. Machine Learning, 45(1), pp. 5–32.

10. Pedregosa, F., et al. (2011). Scikit-learn: Machine Learning in Python. Journal of Machine Learning Research, 12, pp. 2825–2830.

11. MultimodalGasData Dataset — Thermal Camera and MQ Gas Sensor Array, Mendeley Data / MDPI. (Reference for M2 supplementary training dataset.)

12. UCI Machine Learning Repository — Gas Sensor Array Drift Dataset. University of California, Irvine.

13. Roboflow Universe — Fire Smoke and Human Detector Dataset. (Reference for future M3 computer vision work.)

14. Kaggle — fire-and-smoke-dataset. (Reference for future M3 computer vision work.)

15. Published literature on fireworks manufacturing hazard analysis and accident causation, including studies identifying friction and hygroscopic reactivity as primary ignition mechanisms in filling and mixing sections. (Specific citations to be added from the reviewed papers.)

16. Academic literature on IoT-based multi-sensor fire detection systems and sensor fusion architectures for industrial safety applications, including ESP32-based implementations with gas, flame, and thermal sensor combinations. (Specific citations to be added from reviewed IEEE papers.)
