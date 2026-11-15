import { CAREER_DOSE_LIMIT_MSV, ENVIRONMENTS } from "./environments";
import type { Environment } from "./types";
import type { SwLevel } from "./spaceweather";

export interface DoseState { cumulativeMsv: number; day: number }

/**
 * How much today's dose rate is scaled by the current real NASA DONKI space-weather level. Illustrative, HELM's
 * own multiplier (not an official NASA conversion factor — see docs/SOURCES.md) — but it makes the live feed
 * actually change the radiation-budget forecast shown to the crew, not just display a headline next to it.
 */
export const SW_DOSE_MULTIPLIER: Record<SwLevel, number> = { quiet: 1, active: 1.15, elevated: 1.6, storm: 3 };

/** Today's dose rate (mSv/day) adjusted for live solar activity, for "days of budget left" style forecasts. */
export function liveDoseRate(env: Environment, swLevel: SwLevel = "quiet"): number {
  return ENVIRONMENTS[env].doseRate * SW_DOSE_MULTIPLIER[swLevel];
}

/** Dose per day with an optional solar particle event multiplier on a given day window. */
export function doseForDay(env: Environment, day: number, spe?: { start: number; end: number; extra: number }): number {
  const base = ENVIRONMENTS[env].doseRate;
  const inSpe = spe && day >= spe.start && day <= spe.end;
  return base + (inSpe ? spe!.extra : 0);
}

export function cumulativeDose(env: Environment, days: number, spe?: { start: number; end: number; extra: number }): number {
  let t = 0;
  for (let d = 0; d <= days; d++) t += doseForDay(env, d, spe);
  return t;
}

export function careerFraction(msv: number): number { return Math.min(1, msv / CAREER_DOSE_LIMIT_MSV); }

export function daysUntilLimit(env: Environment, msv: number, swLevel: SwLevel = "quiet"): number {
  const rate = liveDoseRate(env, swLevel);
  return Math.max(0, Math.floor((CAREER_DOSE_LIMIT_MSV - msv) / rate));
}

export const SHELTER_STEPS = [
  "Move to the storm shelter (most shielded module, water and equipment walls).",
  "Bring your personal dosimeter, med kit and 24 h of water.",
  "Close hatches and tell the crew by intercom.",
  "Check dose rate every 5 minutes. Stay until it falls below threshold.",
  "After exit: log dose, symptoms (nausea, fatigue), and send the report.",
];
