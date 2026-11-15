import type { Interval } from "./types";

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Median absolute deviation scaled to be comparable to a standard deviation. */
export function mad(xs: number[]): number {
  const m = median(xs);
  return 1.4826 * median(xs.map((x) => Math.abs(x - m)));
}

/** Split-conformal quantile: finite-sample corrected (1-alpha) quantile of scores. */
export function conformalQuantile(scores: number[], alpha: number): number {
  const n = scores.length;
  if (n === 0) return Infinity;
  const k = Math.ceil((n + 1) * (1 - alpha));
  if (k > n) return Infinity; // not enough calibration data for this coverage
  const s = [...scores].sort((a, b) => a - b);
  return s[k - 1];
}

export interface BaselineOptions { window: number; alpha: number; minHistory: number }
export const DEFAULTS: BaselineOptions = { window: 7, alpha: 0.05, minHistory: 8 };

/**
 * Personal baseline with a conformal prediction interval.
 * Predictor = median of the last `window` observations. Scores = |y_t - predictor_t|
 * computed in a rolling fashion over history. The interval for a new reading is
 * predictor +/- conformal quantile of those scores. A floor on the half-width
 * stops the band collapsing when a person is very consistent.
 */
export function personalInterval(
  history: number[], floor: number, opts: Partial<BaselineOptions> = {},
): Interval | null {
  const o = { ...DEFAULTS, ...opts };
  if (history.length < o.minHistory) return null;
  const scores: number[] = [];
  for (let t = 3; t < history.length; t++) {
    const past = history.slice(Math.max(0, t - o.window), t);
    scores.push(Math.abs(history[t] - median(past)));
  }
  const center = median(history.slice(-o.window));
  const q = conformalQuantile(scores, o.alpha);
  const half = Math.max(Number.isFinite(q) ? q : mad(history) * 2.5, floor);
  return { lo: center - half, hi: center + half, center, n: scores.length, alpha: o.alpha };
}

/** Robust z-score of a value against the last `window` points. */
export function robustZ(history: number[], value: number, floor: number, window = 14): number {
  const h = history.slice(-window);
  if (h.length < 3) return 0;
  const sd = Math.max(mad(h), floor / 2.5);
  return (value - median(h)) / sd;
}

/** Number of most recent readings kept OUT of the baseline so a developing problem cannot widen its own band. */
export const HOLDOUT = 2;
export function referenceHistory(history: number[]): number[] { return history.slice(0, Math.max(0, history.length - HOLDOUT)); }
