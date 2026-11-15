import { INDICATORS } from "./indicators";
import { personalInterval, referenceHistory, robustZ } from "./baseline";
import type { Prior } from "./passport";
import type { Assessment, IndicatorId, Interval, Status } from "./types";
import { STATUS_RANK } from "./types";

/** Which direction is harmful. "either" = both. */
const DIRECTION: Record<IndicatorId, "up" | "down" | "either"> = {
  heartRate: "either", systolic: "either", glucose: "either", temperature: "either",
  sleep: "down", mood: "down", spo2: "down", respRate: "either", hrv: "down", reaction: "up",
};

const LADDER: Status[] = ["nominal", "watch", "caution", "critical"];
const bump = (s: Status, n = 1): Status => LADDER[Math.min(LADDER.indexOf(s === "uncertain" ? "nominal" : s) + n, 2)];

export function harmfulDirection(id: IndicatorId) { return DIRECTION[id]; }

/** Signed deviation in "harm units": positive means moving in the harmful direction. */
export function harmZ(id: IndicatorId, z: number): number {
  const d = DIRECTION[id];
  return d === "up" ? z : d === "down" ? -z : Math.abs(z);
}

/**
 * `prior` is the person's optional Earth baseline. It only matters while their space history is short:
 * once HELM has enough readings, the space baseline takes over. Hard safety limits never move.
 */
export function assessIndicator(id: IndicatorId, fullHistory: number[], value: number, prior?: Prior): Assessment {
  const def = INDICATORS[id];
  const history = referenceHistory(fullHistory);
  const genericSpan = def.earth[1] - def.earth[0];
  const floor = 0.1 * genericSpan;
  const reasons: string[] = [];
  const dir = DIRECTION[id];

  if ((def.hardLow !== undefined && value < def.hardLow) || (def.hardHigh !== undefined && value > def.hardHigh)) {
    reasons.push(`${def.label} of ${value} ${def.unit} is beyond the safety limit.`);
    return { id, status: "critical", value, z: robustZ(history, value, floor), interval: personalInterval(history, floor), reasons, hardLimit: true };
  }

  let interval: Interval | null = personalInterval(history, floor);
  let usedPrior = false;
  if (!interval && prior) {
    interval = { lo: prior.center - prior.half, hi: prior.center + prior.half, center: prior.center, n: 0, alpha: 0.05 };
    usedPrior = true;
    reasons.push(`Using your Earth baseline while HELM learns your space baseline (${history.length}/8 readings).`);
  }
  // The Earth baseline only stands in while space history is short; the body changes in space, so it must not linger.
  const earth: [number, number] = usedPrior && prior ? [prior.center - 1.5 * prior.half, prior.center + 1.5 * prior.half] : def.earth;
  const z = history.length >= 3 ? robustZ(history, value, floor) : prior ? (value - prior.center) / (prior.half / 2) : 0;
  // small excursions past the Earth band are normal measurement noise; require a 10%-of-span margin
  const margin = 0.1 * genericSpan;
  const belowEarthM = value < earth[0] - margin, aboveEarthM = value > earth[1] + margin;
  const outsideEarthHarm = (dir !== "up" && belowEarthM) || (dir !== "down" && aboveEarthM);

  if (!interval) {
    reasons.push(`Calibrating your personal baseline (${history.length}/8 readings).`);
    if (outsideEarthHarm) {
      const dist = belowEarthM ? (earth[0] - value) / genericSpan : (value - earth[1]) / genericSpan;
      const status: Status = dist > 0.5 ? "caution" : "watch";
      reasons.push(`Outside the usual adult range of ${def.earth[0]}–${def.earth[1]} ${def.unit}.`);
      return { id, status, value, z, interval, reasons, hardLimit: false };
    }
    return { id, status: "nominal", value, z, interval, reasons, hardLimit: false };
  }

  const above = value > interval.hi, below = value < interval.lo;
  const surprising = (dir !== "down" && above) || (dir !== "up" && below);
  let status: Status = "nominal";
  const who = usedPrior ? "your Earth baseline" : `your personal ${Math.round((1 - interval.alpha) * 100)}% band`;
  if (surprising) {
    const hz = harmZ(id, z);
    status = hz >= 3.5 ? "caution" : "watch";
    reasons.push(`Outside ${who} of ${fmt(interval.lo, def.decimals)}–${fmt(interval.hi, def.decimals)} ${def.unit}.`);
    // persistence: the previous two readings were also outside the band in the harmful direction
    const prev = fullHistory.slice(-2);
    if (prev.length === 2 && prev.every((p) => (dir !== "down" && p > interval!.hi) || (dir !== "up" && p < interval!.lo))) {
      status = bump(status);
      reasons.push("This has persisted for 3 readings in a row.");
    }
  }
  if (outsideEarthHarm) {
    status = surprising ? bump(status) : (STATUS_RANK[status] < 1 ? "watch" : status);
    reasons.push(usedPrior ? `Also well outside your usual ${fmt(earth[0], def.decimals)}–${fmt(earth[1], def.decimals)} ${def.unit}.` : `Also outside the usual adult range of ${def.earth[0]}–${def.earth[1]} ${def.unit}.`);
  }
  if (!surprising && !outsideEarthHarm) reasons.push(usedPrior ? "Within your Earth baseline." : "Within your personal band.");
  return { id, status, value, z, interval, reasons, hardLimit: false, usedPrior };
}

function fmt(x: number, d: number) { return x.toFixed(d); }

export function worst(statuses: Status[]): Status {
  return statuses.reduce<Status>((a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a), "nominal");
}
