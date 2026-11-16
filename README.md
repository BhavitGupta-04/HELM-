# HELM: Health Engine for Long-duration Missions
Website link: https://bhavitgupta-04.github.io/HELM-/ 

Astronauts on long-duration missions face measurable, well-documented physiological risks: bone density loss up to
ten times faster than severe osteoporosis on Earth, vision damage in roughly 70% of ISS crew members
(Spaceflight-Associated Neuro-ocular Syndrome), and up to 75-78% reliance on sleep medication over long missions. A
Mars transit adds a one-way communication delay with Earth of up to 22 minutes, so health decisions increasingly have
to be made onboard, in real time, without a live consult from mission control.

HELM compares each astronaut to **their own baseline in space**, says honestly when it is unsure, and changes its
advice based on how far away Earth is.

## Run it

Requires Node.js 20+ (you have it).

```powershell
cd "C:\Users\k_jin\OneDrive\Documents\Nasa Space App Challenge\app"
npm install
npm run dev        # opens http://localhost:5173
```

Other commands: `npm test` (103 tests across 9 suites), `npm run build` (type-check + production build), `npm run preview`.

> Tip: OneDrive will try to sync thousands of `node_modules` files. Pause OneDrive sync during `npm install`, or work from a
> non-synced folder such as `C:\dev\helm` and copy the `app` folder there.

## What is in this build

- **Personal baseline engine** with conformal prediction bands and hard safety limits — every indicator is judged
  against the individual astronaut's own measured history, not a generic population range
- **Multi-signal pattern detection** (infection, cabin air, isolation strain, cardio strain, metabolic stress,
  sleep crisis)
- **Light-delay triage** (station, Moon, Mars) with an onboard-first rule when a live consult is impossible
- **SBAR flight-surgeon report** plus a checksum-protected low-bandwidth packet
- **Tamper-evident Black Box log** (SHA-256 hash chain) — every reading, event and transmission is chained, and
  changing one entry breaks every later hash
- **Animated hologram body map**, NASA HRP hazard overlay and radar, trend charts with personal bands
- **Chaos Director** (inject mission events), solar particle event shelter mode, radiation dose wallet, Ghost Self
  forecast
- **Symptom check**: describe symptoms in plain text; HELM matches them deterministically against the same patterns
  Chaos Director injects, updates the real simulation, and tells you honestly what it couldn't recognize instead of
  guessing
- **Personalized care plan**: NASA-sourced exercise and diet countermeasures for whichever systems are currently
  flagged, generated immediately from a symptom check or an injected event — not a generated or individualized
  prescription
- **Camera pulse** (beta, on-device): measures heart rate from tiny colour changes in the face, with an **unattended
  watch mode** that keeps measuring on its own and raises a flashing visual alert if it gets no usable reading for
  two attempts in a row, flagging a possible unresponsive crew member
- **Early-warning drift forecasting**: fits a robust trend (Theil-Sen) to each indicator's last 5-10 readings and,
  if it's heading toward the edge of your personal band, shows an estimate like "exits your band in about 2 days" —
  before it actually crosses the line, not only after. Returns nothing rather than a guess when there isn't enough
  history or the trend is flat or moving the safe direction
- **Earth Baseline Passport** (optional): enter your usual Earth numbers so HELM starts personalized on day one.
  Stored only in this browser, with export, import and delete
- **Trust & Validation**: runs the project's automated test suite live, in the browser, on freshly generated
  simulated missions, so the numbers on screen are provably the same ones the test suite checks, not a figure
  copied from a log
- Red night mode, keyboard-accessible body map, reduced-motion support

All health data is simulated until a NASA astronaut dataset is available; the space weather and radiation panels use
real NASA data today (see below). See `docs/VALIDATION.md` and `docs/SOURCES.md` for full methodology and sources.

### In progress: fall and unresponsive-crew detection via custom-rule generative AI

A further detection path is being merged into this build from the author's other work: a natural-language,
custom-rule detection engine, the same generative-AI architecture described in the author's peer-reviewed study
(Gupta et al., *Cureus*, 2025, DOI: [10.7759/cureus.95182](https://doi.org/10.7759/cureus.95182)), which reported
95.8% accuracy across 168 controlled trials for compliance-monitoring rules. Applied to custom detection rules more
broadly, the author's own testing across 100+ trials measured 94% accuracy. In HELM, one such rule detects a crew
member who has fallen or stopped responding and triggers a visual alert plus a notification to an authorized
contact. This is not yet part of the current build above; it will be documented here with its own test results once
merged.

## Try this in the demo

1. Pick **Mars Transit**, drag the delay slider and watch the decision engine change.
2. Click a body node, expand "How, why, what to do".
3. Type a symptom into **Symptom check** (e.g. "I have a fever and my heart feels like it's racing") and watch the
   **Personalized care plan** update immediately below it.
4. Chaos Director: set **severe**, click **Infection**. Patterns fire and triage says act now.
5. Click **Solar particle event** for the shelter countdown.
6. Press **Play mission** to fast-forward and watch bands and the readiness score move.
7. Black Box: **Simulate tampering** and watch the chain break.
8. Click **Earth baseline**, enter a resting heart rate or pick a fitness level, save, then drag the mission slider to
   Day 1-3. A gold dashed line shows your Earth baseline and HELM uses it until it has learned your space baseline.
9. Open **Trust & Validation** and press **Run validation now** to watch 30 fresh simulated missions (720 calm-day
   checks, 90 injected-event trials) run live in your browser.

HELM is decision support, not a medical device or diagnosis.

## Real NASA data: space weather (DONKI)
The "Real space weather" panel loads the last 30 days of solar flares, particle events and coronal mass ejections from NASA DONKI. It shows LIVE, SAVED (cached up to 30 min) or OFFLINE honestly, never invented data. "Replay" runs a real event through the demo crew; the crew's body response is simulated. It works with NASA's shared DEMO_KEY but that is rate limited, so you can paste a free key from api.nasa.gov (stored only in your browser). The Active/Elevated/Storm level is HELM's own rule of thumb, not an official NASA alert. Data: NASA DONKI (CCMC).

## Camera pulse (beta, on-device)
The "Camera pulse" panel measures pulse from tiny colour changes in a patch of the face (POS remote photoplethysmography). No face-recognition model, no cloud: the video stays in the browser and only the average colour of a small patch is used. It always gives its best estimate once it has 30 s of usable video, labelled low confidence when the pulse is not clear, and keeps measuring (up to 60 s) before settling. It only refuses when there is nothing to analyse (too dark, overexposed, no skin in the oval, frame rate too low). It cannot measure blood pressure or glucose (those are manual entries). Accuracy has only been tested on synthetic signals and a synthetic test video, not on real faces yet. A "simulated demo" button exists for devices without a camera and is always labelled SIMULATED.

### Camera pulse update: face tracking and credits
The camera now finds your face with MediaPipe Face Mesh (Apache-2.0, bundled in `public/mediapipe`, runs in the browser) and reads the forehead and both cheeks, so small head movements no longer move the sampled area. If the tracker cannot load or is too slow on a device, HELM falls back to a fixed patch and says so. A second, independent method (plain brightness, Hamming window, FFT peak, the approach of thearn/webcam-pulse-detector, Apache-2.0, re-implemented without copying code) is shown as a cross-check. Tested on synthetic signals and on a real face photograph with a pulse added to it, not yet on live volunteers.

### Camera pulse update: unattended watch and unresponsive-crew alert
A "Unattended watch" toggle keeps the camera measuring on its own, on a timer, for when nobody is there to press
Start, including if the crew member is asleep, unresponsive, or incapacitated. It only auto-logs a reading it would
also call reliable on its own terms; an unreliable pass is retried next cycle, never force-logged. If two unattended
attempts in a row come back with no usable pulse, HELM raises a flashing red light alert on the dashboard reading
"Possible unresponsive crew member," dismissible with an "I'm okay" button. This is a visual flag only, not a
diagnosis: HELM cannot tell an unresponsive crew member apart from one who is simply out of frame.

## Validation and testing
`docs/VALIDATION.md` has the full table. In summary: 103 automated tests pass across 9 suites. The live Trust &
Validation page runs 30 fresh simulated missions per click (720 calm-day false-alarm checks and 90 injected-event
detection trials), with infection, cabin-CO2, and cardio-strain patterns each detected in 100% of injected-event
trials and a false-alarm rate under 5% on calm days. These numbers measure the detector against its own simulator,
which is strong evidence the logic is internally sound and reproducible; the next validation step toward real-world
use is replaying an actual NASA astronaut dataset. Automated testing caught and fixed four real bugs during
development, documented in `docs/VALIDATION.md`.

## About the author
HELM was built solo by Manit Gupta. Related peer-reviewed work: Gupta M, Gairaboni R, Bautista A, et al. "Real-Time
Personal Protective Equipment (PPE) Compliance and Clinical Tool Monitoring Using Generative AI: A Novel Approach for
Adaptive and Automated Healthcare Surveillance." *Cureus* 17(10): e95182 (2025).
DOI: [10.7759/cureus.95182](https://doi.org/10.7759/cureus.95182).
