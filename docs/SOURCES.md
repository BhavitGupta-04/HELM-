# Sources and assumptions

Thresholds and rates are PROTOTYPE values written from general knowledge and must be confirmed against the NASA pages
below before submission.

- NASA Human Research Program, Human Research Roadmap: https://humanresearchroadmap.nasa.gov (five hazards of human spaceflight)
- Career radiation limit 600 mSv: NASA-STD-3001 (2022 revision). Confirm exact wording.
- Dose rates used: station ~0.6, lunar surface ~1.4, deep-space transit ~1.8 mSv/day (rounded from ISS, Chang'e-4 and Curiosity RAD measurements). Confirm.
- Bone loss ~1 to 1.5% per month at weight-bearing sites without countermeasures; muscle loss of up to ~20% in 5 to 11 days of unloading (NASA HRP summaries). Confirm.
- Earth reference ranges for heart rate, blood pressure, glucose, temperature, SpO2, respiration are standard adult resting values.
- Light-time: Moon ~1.3 s one-way; Mars ~3 to 22 minutes one-way.
- The 60-second reaction test follows the idea of NASA's Reaction Self Test (psychomotor vigilance).
- Conformal prediction: split-conformal with finite-sample correction (Vovk et al.; Angelopoulos & Bates tutorial).


## NASA DONKI (integrated)
Endpoints used: api.nasa.gov/DONKI/FLR, SEP, CME (startDate, endDate, api_key). Field names (flrID, classType, peakTime, sepID, eventTime, activityID, startTime, cmeAnalyses.speed) follow the public DONKI docs; parsing tolerates missing fields. Tests use hand-made payloads in that shape, not real recorded responses. Live behavior in a browser (CORS, rate limits) has not been confirmed from the build environment, which cannot reach NASA.


## NASA RadLab (integrated)
Endpoint: https://visualization.osdr.nasa.gov/radlab/api?format=json. A real fetch returned quoted tab-separated text (not JSON) with columns timestamp, instrument_id, absorbed_dose_rate, instrument_family, module; sample covered 2019-12-05 to 2019-12-24. The parser handles TSV and JSON. HELM shows absorbed dose rate (µGy/h, unit per RadLab docs as recalled) and does not convert to mSv. Browser CORS not yet confirmed.


## NASA Human Research Program (official challenge resources)
Fetched and checked: https://www.nasa.gov/hrp/hazards/ names five hazards: Space Radiation; Isolation and Confinement; Distance from Earth; Gravity Fields; Hostile/Closed Environments. https://www.nasa.gov/hrp/risks/ lists 17 risks in three groups; it does not map risks to hazards, so the grouping shown in HELM is HELM's own. It names no risk for medical capability. Neither page gives radiation dose numbers. The CSA radiation article (asc-csa.gc.ca, 2026-02-26) names CANS, bubble detectors, MOSFET, EVARM and Radi-N/Radi-N2, says neutrons are about 30% of ISS radiation, and gives no mSv values. So HELM's dose-rate figures (0.6 / 1.4 / 1.8 mSv/day) remain UNVERIFIED illustrative values and must not be presented as NASA numbers.


## Third-party components and ideas (credited)
- MediaPipe Face Mesh (`@mediapipe/face_mesh`, Apache-2.0, Google): bundled in public/mediapipe. Used only to locate forehead and cheeks. No video leaves the device.
- thearn/webcam-pulse-detector (Apache-2.0): the idea of a brightness-average, Hamming-window, FFT-peak second estimator was re-implemented in TypeScript. No code copied.
- Wang et al. 2017, "Algorithmic principles of remote PPG" (POS projection): implemented from the published description.
- Test face photo (skimage astronaut portrait, NASA, public domain) was used only locally for testing and is not shipped.
