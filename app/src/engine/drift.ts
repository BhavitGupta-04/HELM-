import type { Interval } from "./types";

/**
 * Early-warning drift forecasting. Everything else in the engine (assess.ts) only looks backward: it compares
 * the latest reading to a personal band, and at most notices that the last two readings were also outside it.
 * This looks forward instead, using a robust trend fitted to recent daily readings, so HELM can warn that a
 * value is heading out of band before it actually crosses the line, not only after.
 *
 * Deliberately conservative: returns null (never a guessed number) whenever there isn't enough history, the
 * trend is flat, the trend is moving away from the band edge, or the projection would reach more than 14 days
 * out, where a straight-line extrapolation stops being a reasonable model of a biological signal.
 */

export interface DriftProjection {
  /** Estimated days until the value reaches the harmful band edge, at the current trend. Always > 0. */
  daysToEdge: number;
  /** Signed trend in indicator units per day (Theil-Sen estimate). */
  slopePerDay: number;
  /** Which band edge the trend is heading toward. */
  edge: "lo" | "hi";
}

const MIN_POINTS = 5;
const WINDOW = 10;
const MAX_PROJECTION_DAYS = 14;

/** Median of all pairwise slopes between points spaced `dx` days apart (Theil-Sen estimator). Robust to a
 *  single noisy reading in a way an ordinary least-squares fit is not. */
function theilSenSlope(values: number[]): number | null {
  const n = values.length;
  const slopes: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      slopes.push((values[j] - values[i]) / (j - i));
    }
  }
  if (slopes.length === 0) return null;
  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  return slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
}

export function projectDrift(
  history: number[],
  interval: Interval | null,
  direction: "up" | "down" | "either"
): DriftProjection | null {
  if (!interval || history.length < MIN_POINTS) return null;
  const span = interval.hi - interval.lo;
  if (!(span > 0)) return null;

  const recent = history.slice(-WINDOW);
  const slope = theilSenSlope(recent);
  if (slope === null) return null;

  // A trend smaller than 1% of the band's own width per day is noise, not a direction HELM should warn about.
  const noiseFloor = 0.01 * span;
  if (Math.abs(slope) < noiseFloor) return null;

  const edge: "lo" | "hi" =
    direction === "up" ? "hi" : direction === "down" ? "lo" : slope > 0 ? "hi" : "lo";
  const movingTowardEdge = (edge === "hi" && slope > 0) || (edge === "lo" && slope < 0);
  if (!movingTowardEdge) return null;

  const last = recent[recent.length - 1];
  const target = edge === "hi" ? interval.hi : interval.lo;
  const daysToEdge = (target - last) / slope;
  if (!Number.isFinite(daysToEdge) || daysToEdge <= 0 || daysToEdge > MAX_PROJECTION_DAYS) return null;

  return { daysToEdge, slopePerDay: slope, edge };
}

/** One short sentence for the UI. Rounds to whole hours under a day, otherwise whole days, since a decimal
 *  day reads as false precision for a straight-line projection. */
export function describeDrift(p: DriftProjection): string {
  if (p.daysToEdge < 1) {
    const hours = Math.max(1, Math.round(p.daysToEdge * 24));
    return `At this rate, exits your band in about ${hours}h.`;
  }
  const days = Math.round(p.daysToEdge);
  return `At this rate, exits your band in about ${days} day${days === 1 ? "" : "s"}.`;
}
