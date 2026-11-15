/** Illustrative forecasts of two classic spaceflight losses, as a function of exercise adherence (0..1).
 *  Not a clinical model. Rates are rounded from NASA Human Research Program summaries (docs/SOURCES.md). */
export interface GhostPoint { day: number; bonePct: number; musclePct: number }

export function boneLossPct(day: number, adherence: number): number {
  const monthlyNoExercise = 1.2; // % per month, weight-bearing sites
  return (day / 30) * monthlyNoExercise * (1 - 0.75 * clamp01(adherence));
}
export function muscleLossPct(day: number, adherence: number): number {
  return 20 * (1 - Math.exp(-day / 14)) * (1 - 0.85 * clamp01(adherence));
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function ghostTrajectory(days: number, adherence: number, step = 5): GhostPoint[] {
  const out: GhostPoint[] = [];
  for (let d = 0; d <= days; d += step) out.push({ day: d, bonePct: boneLossPct(d, adherence), musclePct: muscleLossPct(d, adherence) });
  return out;
}
