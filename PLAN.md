# HELM build plan and status

Deadline: morning of Nov 15, 2026. Solo build.

| Phase | Scope | Status |
|---|---|---|
| 0 | Scaffold, tooling, design tokens | Done |
| 1 | Health engine, synthetic missions, 34 tests | Done |
| 2 | Animated dashboard, body map, triage, Black Box, storm mode | Done |
| 2b | Earth Baseline Passport (optional personal history, on-device) | Done |
| 3 | Camera vitals (OpenCV rPPG), fluid-shift tracker, breathing coach | Next. Needs your webcam |
| 4 | Reaction test, voice sample, mood, pupil screen | Next |
| 5 | Mars-sol clock, mission scrubber polish, QR packet | After 3-4 |
| 6 | Quests, streaks, buddy exam, med-kit Treatability Score | Day 3 |
| 7 | Real NASA data importer, optional Pi node | When data is available |
| 8 | Playwright e2e, accessibility audit, validation page | Rolling |
| 9 | Polish, README, demo video script | Last |

## Known limitations (be upfront with judges)
- Thresholds are prototype values and the data is simulated. Detection rates in `docs/VALIDATION.md` are measured on
  simulated data produced by a model that shares assumptions with the detector, so they show the logic works, not clinical accuracy.
- Per-indicator "watch" flags fire on about 10% of calm readings by design; patterns fire on about 5% of calm days.
- A slow drift over weeks gets absorbed into the personal baseline. The hard limits and the Earth-range check are the backstop.
