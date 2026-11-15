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

The live DONKI level is not just displayed: it scales the dose-wallet's "days of budget left" forecast and the radiation-hazard radar value (src/engine/radiation.ts `SW_DOSE_MULTIPLIER`, `liveDoseRate`). The multiplier values (quiet ×1, active ×1.15, elevated ×1.6, storm ×3) are HELM's own illustrative weighting, not an official NASA conversion — same disclaimer as the mSv/day figures below — but the real feed now changes a real number shown to the crew, not just a headline next to it.

## Reaction time test (added)
The 60-second abbreviated test (src/ui/ReactionTest.tsx) is modeled on the structure of the psychomotor vigilance task NASA's Human Research Program uses operationally on ISS crew (sometimes called the Reaction Self Test / PVT-B): random inter-stimulus wait, react as fast as possible, median response time plus "lapses" over 500ms. This is an abbreviated, non-clinical re-implementation for this project, explicitly labeled as such in the UI — not a replica of the validated instrument.


## NASA RadLab (integrated)
Endpoint: https://visualization.osdr.nasa.gov/radlab/api?format=json. A real fetch returned quoted tab-separated text (not JSON) with columns timestamp, instrument_id, absorbed_dose_rate, instrument_family, module; sample covered 2019-12-05 to 2019-12-24. The parser handles TSV and JSON. HELM shows absorbed dose rate (µGy/h, unit per RadLab docs as recalled) and does not convert to mSv. Browser CORS not yet confirmed.


## NASA Human Research Program (official challenge resources)
Fetched and checked: https://www.nasa.gov/hrp/hazards/ names five hazards: Space Radiation; Isolation and Confinement; Distance from Earth; Gravity Fields; Hostile/Closed Environments. https://www.nasa.gov/hrp/risks/ lists 17 risks in three groups; it does not map risks to hazards, so the grouping shown in HELM is HELM's own. It names no risk for medical capability. Neither page gives radiation dose numbers. The CSA radiation article (asc-csa.gc.ca, 2026-02-26) names CANS, bubble detectors, MOSFET, EVARM and Radi-N/Radi-N2, says neutrons are about 30% of ISS radiation, and gives no mSv values. So HELM's dose-rate figures (0.6 / 1.4 / 1.8 mSv/day) remain UNVERIFIED illustrative values and must not be presented as NASA numbers.


## Third-party components and ideas (credited)
- MediaPipe Face Mesh (`@mediapipe/face_mesh`, Apache-2.0, Google): bundled in public/mediapipe. Used only to locate forehead and cheeks. No video leaves the device.
- thearn/webcam-pulse-detector (Apache-2.0): the idea of a brightness-average, Hamming-window, FFT-peak second estimator was re-implemented in TypeScript. No code copied.
- Wang et al. 2017, "Algorithmic principles of remote PPG" (POS projection): implemented from the published description.
- De Haan, G. & Jeanne, V. 2013, "Robust Pulse Rate From Chrominance-Based rPPG" (IEEE Trans. Biomed. Eng.) (CHROM projection): implemented from the published description, as a second colour-combination candidate alongside POS.
- Test face photo (skimage astronaut portrait, NASA, public domain) was used only locally for testing and is not shipped.

## Camera pulse: why the number sometimes stays "low confidence" (and what was checked, 2026-11-14)
A real capture from the user's own camera (60s, 100% face tracked, very low motion) still measured SNR 1.6-2.8 depending on method — below the reliable threshold. Diagnosed directly against the raw per-frame samples (not guessed): the 15-second sliding-window peak frequency jumped between 56 and 155 bpm every few seconds, and whole-recording autocorrelation at every physiologically plausible heart-rate lag was ~0 (a genuine pulse gives a clear positive peak at the true period). Conclusion: this was not a processing bug, it was a genuinely weak colour-modulation signal for that capture (most likely webcam ISP/compression smoothing away the sub-1% colour change a pulse causes). Fix made on the strength of that diagnosis: `analyseRppg` now runs three independent colour-combination candidates (POS, CHROM, plain green) through the same segment-averaging pipeline and reports whichever has the clearest peak, instead of committing to POS alone — measured on this user's real capture, this raised SNR from 1.6 (POS) to 2.8 (green) and brought the two cross-check estimators (main method vs. brightness/FFT) from 6 bpm apart to 1.6 bpm apart. The reliability threshold was recalibrated at the same time (1000 simulated pure-noise seeds), because taking the best of three independent estimates needs a higher bar than judging one alone, or noise would clear the old bar by chance more often. The capture above is still correctly marked low-confidence: on this device, under this lighting, the true signal was still below a trustworthy bar. That is the intended behaviour, not a residual bug — a tool that invents a confident vital sign when the data does not support one is the actual hazard for a spaceflight health instrument.

## Mission Briefing impact statistics (added 2026-11-14)
Four statistics shown on first load (src/ui/MissionBriefing.tsx), each tied to the HELM system that tracks it. All are from NASA's own data or NASA-funded, peer-reviewed research, not estimates:
- SANS ~70% of long-duration crew: NASA JSC Space and Occupational Medicine Branch, "Spaceflight Associated Neuro-ocular Syndrome: A Briefing for Astronaut Candidates" (T. Brunstetter, SANS Clinical Lead), citing NASA LSAH (Lifetime Surveillance of Astronaut Health) data: "About 70% of long-duration crewmembers present w/ signs of SANS (from mild to severe)." Independent peer-reviewed estimates for subsets of findings range 37.5-70% depending on which ocular finding is counted (Ophthalmology 2011; JAMA Ophthalmol 2020) — the 70% "any SANS finding" figure is NASA's own headline number and is what HELM quotes.
- Bone density loss 1-1.5%/month, >10x severe osteoporosis: consistent across multiple NASA-funded studies (UCSF/Baylor CT study, hip bone strength -2.5%/month; Keyak et al., Bone, bone strength -0.6 to -5%/month; meta-analysis in npj Microgravity 2020, "severe bone loss at a rate of 1-1.5% per month"). The ">10x severe osteoporosis" comparison is against the clinical definition of severe osteoporosis progressing at roughly 1-2% per YEAR on Earth.
- "2 of 6 could stand on landing day": Lee, S.M.C. et al. (cited via PMC10786840, Lower body negative pressure study), reporting prior data that "the majority (52 of 56) of Shuttle astronauts could complete the orthostatic test, compared to only 2 of 6 astronauts following missions on the ISS." Small ISS sample (n=6); stated as one NASA flight dataset, not generalized to "most astronauts."
- Sleep medication 75-78%, ~6 of 8.5 scheduled hours: Barger, L.K. et al. 2014, "Prevalence of sleep deficiency and use of hypnotic drugs in astronauts before, during, and after spaceflight," The Lancet Neurology (10-year, NASA/NSBRI-funded study, >4,000 Earth nights and >4,200 spaceflight nights analyzed). 75% of ISS crew and 78% of Shuttle crew reported sleep-medication use at some point; mean in-flight sleep was 5.96h (Shuttle) / 6.09h (ISS) against an 8.5h schedule.

## Symptom checker and Personalized Care Plan (added 2026-11-14)
- `src/engine/symptoms.ts`: a deterministic keyword matcher, not a generative/AI classifier. Free-text symptom descriptions are matched against the same six EventKinds Chaos Director already injects (src/engine/synth.ts EFFECT table), so a match calls the identical `m.inject()` path and changes the real simulation — nothing is scored or guessed silently. Text that matches nothing is reported as unrecognized rather than forced into the nearest category. "bones"/"muscle" complaints are flagged separately since those systems have no live indicator (see App.tsx SYSTEM_INFO) — they route to the care plan instead of the simulation.
- `src/engine/careplan.ts`: NASA-sourced countermeasure protocols (exercise + diet), one per tracked system, shown for whichever systems are currently flagged (live simulation status, or a symptom-checker flag for bones/muscle). Explicitly labeled as NASA's own general countermeasures, not an individualized medical or dietary prescription. Where evidence for a diet-level countermeasure is thin or unsettled (eyes/SANS, lungs/cabin-air), the entry says so rather than inventing one.
  - Exercise schedule (1.5h/day resistive + ~1h/day aerobic, 6 days/week on ARED/T2): NASA "Zero-G Workout" podcast (Andrea Hanson, ISS Exercise Countermeasures Operations Lead); corroborated by a 2006 NASA/CASI ISS countermeasures report (1.5h resistive + 1h aerobic, 6d/wk).
  - Muscle strength -11 to -17%, endurance -10%, BMD -2-7% over a 180-day mission despite the standard exercise load: spaceflight101.com summary of the NASA SPRINT exercise-countermeasure study.
  - Calcium/vitamin D (~400 IU/day supplement), vitamin D metabolism altered in flight: NASA JSC nutritional-biochemistry poster/paper (NTRS 20080026254); NASA JSC "Human Adaptation to Spaceflight: Food and Nutrition" (2021, Smith/Zwart/Douglas/Heer).
  - Pro K study (fruit/vegetable intake, lower animal-protein-to-potassium ratio, adequate calcium, reduces bone mineral loss) and the Nutrition study (omega-3/fish intake associated with reduced post-flight BMD loss): nasa.gov Science-in-Space / Pro K investigation summaries.
  - Food Physiology investigation (enhanced diet — flavonoids, lycopene, omega-3s — measurable immune/gut-microbiome benefit): nasa.gov Food Physiology / "Science in Space: The Space Diet" articles.
  - Fluid loading before landing as an orthostatic-intolerance countermeasure: general NASA cardiovascular countermeasure literature (not re-verified against a single primary source in the time available — flag for confirmation before any claim beyond this prototype).
  - LBNP / "Chibis" device for SANS-related fluid shift: general NASA fluid-shift countermeasure background (same confirmation caveat as above).
