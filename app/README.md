# HELM: Health Copilot for When Earth Can't Answer

NASA Space Apps 2026 · Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*

HELM compares each astronaut to **their own baseline in space**, says honestly when it is unsure, and changes its advice
based on how far away Earth is.

## Run it

Requires Node.js 20+ (you have it).

```powershell
cd "C:\Users\k_jin\OneDrive\Documents\Nasa Space App Challenge\app"
npm install
npm run dev        # opens http://localhost:5173
```

Other commands: `npm test` (56 tests), `npm run build` (type-check + production build), `npm run preview`.

> Tip: OneDrive will try to sync thousands of `node_modules` files. Pause OneDrive sync during `npm install`, or work from a
> non-synced folder such as `C:\dev\helm` and copy the `app` folder there.

## What is in this build (Phases 0-2)

- Personal baseline engine with conformal prediction bands and hard safety limits
- Multi-signal pattern detection (infection, cabin air, isolation strain, cardio strain, metabolic stress)
- Light-delay triage (station, Moon, Mars) with an onboard-first rule when a live consult is impossible
- SBAR flight-surgeon report plus a checksum-protected low-bandwidth packet
- Tamper-evident Black Box log (SHA-256 hash chain)
- Animated hologram body map, NASA HRP hazard overlay and radar, trend charts with personal bands
- Chaos Director (inject events), solar particle event shelter mode, radiation dose wallet, Ghost Self forecast
- **Symptom check**: describe symptoms in plain text; HELM matches them deterministically against the same patterns Chaos Director injects, updates the real simulation, and tells you honestly what it couldn't recognize
- **Personalized care plan**: NASA-sourced exercise + diet countermeasures for whichever systems are currently flagged — not a generated or individualized prescription
- **Earth Baseline Passport** (optional): enter your usual Earth numbers so HELM starts personalized on day one. Stored only in this browser, with export, import and delete
- Red night mode, keyboard-accessible body map, reduced-motion support

All data is simulated until the NASA dataset is available. See `docs/VALIDATION.md` and `docs/SOURCES.md`.

## Try this in the demo

1. Pick **Mars Transit**, drag the delay slider and watch the decision engine change.
2. Click a body node, expand "How, why, what to do".
3. Chaos Director: set **severe**, click **Infection**. Patterns fire and triage says act now.
4. Click **Solar particle event** for the shelter countdown.
5. Press **Play mission** to fast-forward and watch bands and the readiness score move.
6. Black Box: **Simulate tampering** and watch the chain break.
7. Click **Earth baseline**, enter a resting heart rate or pick a fitness level, save, then drag the mission slider to Day 1-3. A gold dashed line shows your Earth baseline and HELM uses it until it has learned your space baseline.

HELM is decision support, not a medical device or diagnosis.


## Real NASA data: space weather (DONKI)
The "Real space weather" panel loads the last 30 days of solar flares, particle events and coronal mass ejections from NASA DONKI. It shows LIVE, SAVED (cached up to 30 min) or OFFLINE honestly, never invented data. "Replay" runs a real event through the demo crew; the crew's body response is simulated. It works with NASA's shared DEMO_KEY but that is rate limited, so you can paste a free key from api.nasa.gov (stored only in your browser). The Active/Elevated/Storm level is HELM's own rule of thumb, not an official NASA alert. Data: NASA DONKI (CCMC).

## Real NASA data: ISS radiation (RadLab)
A second panel under the dose wallet shows real ISS dose-rate measurements from NASA OSDR RadLab (past data, not live crew dose). Falls back to SAVED/OFFLINE honestly. Absorbed dose is shown as is, never converted to mSv.

## Camera pulse (beta, on-device)
The "Camera pulse" panel measures pulse from tiny colour changes in a patch of the face (POS remote photoplethysmography). No face-recognition model, no cloud: the video stays in the browser and only the average colour of a small patch is used. It always gives its best estimate once it has 30 s of usable video, labelled low confidence when the pulse is not clear, and keeps measuring (up to 60 s) before settling. It only refuses when there is nothing to analyse (too dark, overexposed, no skin in the oval, frame rate too low). It cannot measure blood pressure or glucose (those are manual entries). Accuracy has only been tested on synthetic signals and a synthetic test video, not on real faces yet. A "simulated demo" button exists for devices without a camera and is always labelled SIMULATED.

### Camera pulse update: face tracking and credits
The camera now finds your face with MediaPipe Face Mesh (Apache-2.0, bundled in `public/mediapipe`, runs in the browser) and reads the forehead and both cheeks, so small head movements no longer move the sampled area. If the tracker cannot load or is too slow on a device, HELM falls back to a fixed patch and says so. A second, independent method (plain brightness, Hamming window, FFT peak, the approach of thearn/webcam-pulse-detector, Apache-2.0, re-implemented without copying code) is shown as a cross-check. Tested on synthetic signals and on a real face photograph with a pulse added to it, not yet on live volunteers.
