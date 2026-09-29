# IoT-Based Smart Safety and Worker Alert System for Cracker Factories using ESP32 and AI/ML

## A Zone-Based Fire Detection and Containment System for Sivakasi Filling Godowns

---

**Department of Electronics and Communication Engineering**

**Guided by:** [Guide Name], [Designation]

**Team Members:**
- [Member 1]
- [Member 2]
- [Member 3]
- [Member 4]

**[College / Institution Name] — 2026**

---

## Abstract

The fireworks manufacturing industry in Sivakasi, Tamil Nadu — responsible for approximately 90% of India's fireworks production — has sustained persistently high accident and fatality rates despite formal regulatory oversight by the Petroleum and Explosives Safety Organisation (PESO). Accident investigations consistently identify the filling and mixing sections as the highest-risk process stages, driven by friction-induced ignition, hygroscopic chemical reactivity, and mechanical impact. Existing safety infrastructure relies primarily on manual and periodic inspection rather than continuous automated monitoring, leaving critical pre-ignition conditions undetected until a fire has already started.

This project presents an IoT-based smart safety system specifically designed for a single filling godown in a Sivakasi-style fireworks factory. The system employs a two-tier cascaded artificial intelligence architecture. The first tier, Model 1 (M1), is an unsupervised Isolation Forest model that continuously monitors thermal, humidity differential, and gas drift patterns to detect slow pre-ignition risk buildup before any hotspot or flame appears. The second tier, Model 2 (M2), is a supervised Random Forest classifier that is triggered only when a thermal hotspot exceeds 50°C, fusing multi-sensor features to compute a fire-confidence score and determine the appropriate escalation response.

The hardware platform is a single ESP32 microcontroller interfacing an AMG8833 eight-by-eight thermal array sensor, two DHT22 temperature-humidity sensors (one inside the godown, one outside as an ambient reference), and a complete set of secondary sensors per filling zone — one infrared flame sensor, one MQ-2 combustible gas sensor, and one MQ-135 VOC/air-quality sensor. Each of the three filling zones is additionally equipped with a servo-actuated gravity-fed powder hopper for zone-targeted dry chemical powder release. A DC-motor-driven fan serves dual roles: maintaining safe temperature levels during normal operation by regulating the differential between inside and outside conditions, and activating to push smoke out of the godown during a confirmed fire event. Two relay modules control the fan motor and godown power cutoff independently.

The AMG8833 divides the godown into four zones — three filling zones and one exit zone — enabling spatial localisation of detected events. Upon high-confidence fire detection, the system automatically sounds an evacuation buzzer, cuts godown power, activates the fan to expel smoke, and releases dry chemical powder into the unaffected filling zones to slow fire spread and buy workers evacuation time. A real-time web dashboard provides live visibility into zone risk scores, sensor states, and incident logs. The system is designed with worker life as its stated priority, with all containment logic oriented toward evacuation time rather than fire suppression or product preservation.

---

## Table of Contents

1. Introduction
2. Literature Review
3. Problem Statement
4. Objectives
5. System Architecture
6. Hardware Design and Components
7. Software and Firmware Design
8. Machine Learning System
9. Web Dashboard
10. Results and Discussion
11. Conclusion
12. Future Work
13. References

---

## Chapter 1: Introduction

### 1.1 Background

India's fireworks manufacturing industry is one of the largest in the world, with Sivakasi in Tamil Nadu accounting for approximately 90% of national production. The industry employs hundreds of thousands of workers, many of whom operate in small, physically isolated manufacturing sheds known as godowns. By regulatory design under the Explosives Rules and Petroleum and Explosives Safety Organisation (PESO) guidelines, each stage of the manufacturing process — mixing, filling, drying, and storage — takes place in a separate godown, with shed dimensions legally capped to limit blast damage from any single incident.

Despite this structural isolation, the industry continues to record a high number of accidents and fatalities each year. PESO recorded 91 deaths across 36 accidents nationwide in a single reporting year, and Sivakasi alone documented 236 accidents causing 291 deaths and 204 injuries between 2014 and April 2025. A particularly significant finding from the accident data is that the majority of these incidents occurred within PESO-licensed units, demonstrating that formal licensing and regulation have not translated into effective real-time safety enforcement on the factory floor.

### 1.2 Motivation

Academic and industry investigations into fireworks-factory accidents consistently identify the filling and mixing process stages as the highest-risk areas. Friction-induced ignition — arising from grinding, ramming, or handling operations — and hygroscopic chemical reactivity, which increases as ambient humidity drops, are the two most frequently cited ignition mechanisms. These conditions develop gradually and are detectable through sensor monitoring before any visible flame or smoke appears. However, current safety practice in most small and medium fireworks units relies on manual, periodic checks rather than continuous automated monitoring, creating a systematic gap between risk and response.

This project was motivated by the observation that the sensor and machine-learning technologies required to close this gap are now affordable, well-documented, and feasible for deployment in resource-constrained environments such as a Sivakasi godown. The system is designed not as a theoretical exercise but as a realistic, buildable prototype grounded directly in accident data and domain-specific engineering constraints.

### 1.3 Scope of the Project

The project focuses on a single filling godown — the process stage most frequently associated with fatal accidents — rather than attempting to instrument an entire factory. This scope was deliberately chosen to produce a well-validated, buildable system rather than a superficially broad one.

The godown is monitored by a single AMG8833 eight-by-eight thermal array sensor mounted centrally at ceiling height, dividing the room into four spatial zones: three filling zones and one exit zone. Each of the three filling zones is equipped with a complete secondary sensor set — an infrared flame sensor, an MQ-2 combustible gas sensor, and an MQ-135 VOC and air-quality sensor. Two DHT22 temperature-humidity sensors are deployed: one inside the godown to measure actual working conditions and one outside as an ambient reference, enabling differential monitoring that provides a stronger pre-ignition risk indicator than either sensor alone.

A single ESP32 microcontroller performs edge-level data collection, frame smoothing, hotspot detection, zone localisation, and emergency actuation. It controls two relay modules (fan control and power cutoff), three servo motors (one per fill zone for powder hopper actuation), a buzzer for evacuation alarm, and a DC-motor-driven fan for ventilation management. A Python-based backend running on a central server hosts the two machine learning models and communicates with a React-based web dashboard via Supabase real-time subscriptions.

### 1.4 Document Structure

This report is organised as follows. Chapter 2 reviews relevant published literature on IoT-based fire detection, machine learning for safety systems, and fireworks manufacturing hazards. Chapter 3 formally states the problem. Chapter 4 defines the project objectives. Chapters 5 through 9 document the system architecture, hardware design, software design, machine learning system, and dashboard respectively. Chapter 10 presents results and discussion. Chapters 11 and 12 provide the conclusion and future work, followed by references.

---

## Chapter 2: Literature Review

### 2.1 IoT-Based Fire and Gas Detection Systems

Recent research in IoT-based fire safety has demonstrated a clear transition from single-sensor, fixed-threshold alarm systems toward multi-sensor fusion architectures. ESP32-based systems that combine gas, flame, and temperature sensing with a fusion algorithm — rather than acting on any single sensor crossing a threshold — have been shown to reduce false alarm rates significantly compared to threshold-only baselines. A key recurring finding in this literature is that single-sensor readings are prone to false positives caused by ordinary environmental fluctuations: ambient temperature rises, non-hazardous fumes, or transient heat sources such as sunlight. Multi-sensor fusion, where multiple independently-measured signals must collectively support an alarm decision, addresses this limitation directly.

Camera-based visual verification has emerged as a complementary design pattern in recent fire-IoT literature. Studies have reported that supervisors receiving remote alerts without visual confirmation frequently hesitate or ignore alarms because they cannot independently assess severity. Adding a camera snapshot upon alert trigger, before full evacuation escalation, improves both response speed and alarm credibility. Even the most recent published fire-fusion systems, however, note autonomous on-device fire and smoke classification as a deferred capability, indicating that this remains an open challenge at the edge-computing level.

### 2.2 Machine Learning for Industrial Safety

Machine learning approaches in industrial safety applications have broadly followed two distinct patterns depending on data availability. Where labeled failure data exists in sufficient quantity — such as in manufacturing equipment monitoring with long operational histories — supervised classification and regression models have been successfully applied. Where labeled failure data is rare or cannot be safely collected, as is the case for ignition events in pyrotechnics environments, unsupervised anomaly detection methods have been shown to be more appropriate. Isolation Forest, in particular, has been validated for multi-variate anomaly detection in tabular time-series sensor data, requiring only examples of normal operation for training and flagging statistical deviations from the learned normal distribution.

For supervised fire-event classification on small, tabular, multi-sensor datasets, Random Forest classifiers have become a standard approach in the published fire-fusion literature. Random Forest's robustness to noisy sensor readings, its native output of class probabilities rather than hard binary decisions, and its interpretability via feature importance scores make it well-suited to a prototype system where model behavior must be explainable to evaluators and operators alike. Support Vector Machines (SVM) have also been considered in this literature as a comparison baseline, particularly with radial basis function kernels on normalised feature sets.

### 2.3 Predictive Maintenance and Baseline Normalisation

A key insight from predictive maintenance research is that normalising sensor readings against a locally-derived rolling baseline — rather than comparing against a fixed global threshold — significantly reduces false alarm rates. This approach, applied in adjacent domains such as wind turbine health monitoring, allows the system to distinguish between a value that is anomalous for a given zone at a given time versus a value that is simply higher than an arbitrary global limit. This principle directly motivates the gas baseline drift feature used in M1 and the per-zone frame-smoothed thermal average used in both M1 and M2.

### 2.4 Fireworks Manufacturing Hazard Analysis

Published hazard analyses of the fireworks industry have consistently identified friction and hygroscopic reactivity as the two primary pre-ignition risk factors. Studies focusing on the Sivakasi region have found that most fatal accidents occur in filling and mixing sections, caused primarily by mechanical actions such as friction and impact, chemical reactions, or elevated temperatures during hot weather. A formal job safety analysis of fireworks processing documented that chemical mixtures can be subjected to a frictional load of 17.2 N and an impact energy of 19.6 J during normal mixing operations, establishing a quantitative basis for why these stages are inherently hazardous.

The Explosives Rules 2008 formally recognise temperature as a risk factor by prescribing 6 a.m. to 9 a.m. as the preferred window for chemical mixing, when ambient temperatures in Sivakasi are lowest. Documented natural ambient temperatures in the region range from 25°C to 40°C, with a safe operating humidity band of 40% to 70%. These industry-standard values directly inform the temperature threshold calibration used in this system, specifically the Stage 1 hotspot trigger of 50°C — 10°C above the highest naturally occurring ambient temperature.

### 2.5 Suppressant Selection for Pyrotechnic Fires

The use of water or foam as a suppressant in pyrotechnic manufacturing environments is contraindicated because fireworks compositions typically contain metal powders, such as aluminium and magnesium, that react exothermically with water, potentially producing hydrogen gas and intensifying the fire. Industrial standards for this hazard class designate dry chemical powder — specifically sodium chloride-based or graphite-based Class D agents — as the appropriate suppressant. This constraint directly motivated the choice of dry chemical powder as the containment medium in this system, deployed via a servo-actuated gravity-fed release mechanism.

### 2.6 Summary of Research Gaps

From the literature reviewed, the following specific gaps are identified that this project addresses:
- No published IoT system has been designed specifically for the fireworks filling-section context with zone-level spatial localization.
- Pre-ignition monitoring for static electricity, friction heat, and chemical off-gassing has not been applied in a continuous, automated fashion in this domain — existing practice relies on manual periodic inspection.
- No published system combines thermal zone attribution, multi-sensor fusion fire confidence scoring, and zone-targeted dry powder release in a single integrated architecture.

---

## Chapter 3: Problem Statement

India's fireworks manufacturing industry, centred in Sivakasi, Tamil Nadu, records consistently high accident and fatality rates despite formal regulatory oversight. The majority of these accidents occur in filling and mixing godowns, driven by ignition mechanisms that develop gradually — through friction heat buildup, humidity-related chemical instability, and mechanical impact — before any visible flame or smoke appears.

Current safety practice in most Sivakasi godowns is manual and periodic: grounding resistance is checked monthly, humidity is assessed visually, and fire detection (where present) relies on fixed-threshold single-sensor alarms. These approaches share a fundamental limitation: they only respond after a fire has already started or when a single sensor crosses an arbitrary threshold, providing no early warning of the pre-ignition drift that precedes most incidents. Fixed-threshold systems also produce frequent false alarms, desensitising workers to alerts and reducing the effectiveness of genuine warnings.

No existing system combines continuous pre-ignition monitoring, zone-level spatial localisation of thermal anomalies, multi-sensor fusion fire confidence scoring, and zone-targeted containment action in a single, low-cost, deployable architecture designed specifically for the fireworks-manufacturing context. This project addresses this gap by designing, implementing, and validating such a system for a single filling godown — the highest-risk process stage in Sivakasi-style manufacturing.

---

## Chapter 4: Objectives

The project has the following primary objectives:

1. **To develop a continuous, automated pre-ignition monitoring system** that detects slow drift toward hazardous conditions — rising thermal trends, dropping humidity (measured as an inside-outside differential), and gas baseline drift — before any flame or hotspot event occurs, using an unsupervised Isolation Forest anomaly detection model.

2. **To implement a spatially-aware fire-confidence classification system** that, upon detecting a thermal hotspot, identifies the specific zone within the filling godown where the event is occurring and fuses eleven multi-sensor features into a calibrated confidence score using a supervised Random Forest classifier.

3. **To design and implement a zone-based containment and evacuation response** that, upon high-confidence fire detection, automatically triggers an evacuation buzzer, cuts godown power, activates the ventilation fan to expel smoke from the godown, and releases dry chemical powder into unaffected filling zones to slow fire spread — with worker evacuation as the explicit design priority throughout.

4. **To build a real-time web dashboard** that provides factory supervisors with live visibility into zone risk scores, sensor states, active alerts, and historical incident logs, enabling informed and timely human decision-making.

5. **To validate the system end-to-end** through controlled, safe simulated fire-event scenarios and structured test cases that demonstrate correct zone attribution, correct confidence scoring, correct escalation tier selection, and correct containment zone targeting.

6. **To produce an honest, openly documented evaluation** of the system's capabilities and limitations, including the absence of real ignition-event training data, the prototype-grade nature of the hardware, and the deferred status of occupancy-confirmation and GSM notification features.
