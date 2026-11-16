# Validation (current)

Run `npm test`. Measured on simulated Mars-transit missions, 30 seeds each:

| Check | Result |
|---|---|
| Conformal coverage on stationary noise (property test, alpha=0.1) | between 85% and 97% |
| False-alarm days (any pattern firing on a calm day) | about 5% (test limit: under 10%) |
| Infection event detected as infection pattern | 100% of runs (test limit: 90%) |
| Cabin CO2 event detected as cabin-air pattern | 100% of runs (test limit: 90%) |
| Cardio-strain event detected | 100% of runs (test limit: 85%) |
| Severe infection trips the temperature hard limit | yes |
| Packet round-trip and corruption detection | pass |
| Passport: bad or unknown fields dropped, notes capped, junk input safe | pass |
| Passport: athlete baseline avoids a day-one false flag, but far-off values and hard limits still trip | pass |
| Passport: Earth baseline stops being used once enough space history exists | pass |
| Passport notes reach the report only when opted in, and never the compact packet | pass |
| Ledger detects a tampered entry | pass, reports the first bad index |

## Honest caveat
The simulator and detector were written together. Perfect detection here shows the logic is internally consistent, not
that it works on real astronauts. The next validation step is replaying the real NASA dataset and published spaceflight
ranges, and for the camera vitals, comparing against a pulse oximeter.

## Early-warning drift forecasting (added 2026-11-15)
`src/engine/drift.ts` adds forward-looking projection on top of the existing backward-only detection in
`assess.ts` (which only compares the latest reading to a personal band and checks the last 2 readings for
persistence). `projectDrift` fits a Theil-Sen median-of-pairwise-slopes trend over the last 5-10 daily readings
and, if the trend is moving toward the harmful band edge, estimates days until it would cross — shown on the
indicator card as "At this rate, exits your band in about Nh/days." It returns `null` (no guess shown) when
there are fewer than 5 readings, the trend is flatter than 1% of the band's width per day, the trend is moving
away from the harmful edge, or the projection would exceed 14 days out, since a straight-line extrapolation is
not a reasonable model that far ahead for a biological signal. Covered by `tests/drift.test.ts` (10 tests):
a clearly trending series projects a sane estimate; flat/noisy, away-trending, too-short, and too-far-out cases
all correctly return null. This is a statistical projection from the simulated trend, not a clinical prediction,
and is clearly labeled as such in the UI ("Projected from the recent trend, not a confirmed event").

## Bugs found and fixed by testing
- The Earth baseline kept widening the "normal" range even after HELM had learned the person's space baseline, so a real change in space would have been ignored. It now only stands in while space history is short (found by a test).
- Body-map nodes were unclickable because decorative layers intercepted pointer events (found in headless browser run).
- The pattern detector counted unrelated indicators (any "caution" status), so one severe infection also claimed four
  other conditions. Now only signals moving in the pattern's own direction count, and cardio-strain requires blood pressure.
- A developing problem could widen its own baseline band and hide itself. The last 2 readings are now held out of calibration.
