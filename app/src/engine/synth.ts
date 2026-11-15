import { INDICATORS } from "./indicators";
import type { Environment, IndicatorId, Reading } from "./types";

/** Deterministic PRNG so demos and tests are reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(r: () => number) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export type EventKind = "infection" | "cabin-co2" | "solar-storm" | "sleep-crisis" | "mood-dip" | "cardio-strain";
export interface MissionEvent { kind: EventKind; start: number; length: number; severity: number }

const BASE: Record<IndicatorId, { mean: number; sd: number }> = {
  heartRate: { mean: 64, sd: 2.2 }, systolic: { mean: 112, sd: 3.5 }, glucose: { mean: 88, sd: 4 },
  temperature: { mean: 36.7, sd: 0.14 }, sleep: { mean: 7.0, sd: 0.5 }, mood: { mean: 7.5, sd: 0.7 },
  spo2: { mean: 98, sd: 0.5 }, respRate: { mean: 14.5, sd: 0.9 }, hrv: { mean: 58, sd: 5 }, reaction: { mean: 255, sd: 12 },
};

/** Effect of each event on each indicator, in multiples of that indicator's sd per unit severity. */
const EFFECT: Record<EventKind, Partial<Record<IndicatorId, number>>> = {
  infection: { temperature: 4.5, heartRate: 3.5, respRate: 3, hrv: -3, sleep: -1, mood: -1 },
  "cabin-co2": { reaction: 4, respRate: 3.5, spo2: -4, heartRate: 2.5, mood: -1 },
  "solar-storm": { sleep: -3, hrv: -2, mood: -1.5, heartRate: 1.5 },
  "sleep-crisis": { sleep: -5, reaction: 3, mood: -2.5, hrv: -2 },
  "mood-dip": { mood: -4, sleep: -2, hrv: -2 },
  "cardio-strain": { heartRate: 4, systolic: 4, hrv: -3.5 },
};

export const EVENT_LABELS: Record<EventKind, string> = {
  infection: "Infection", "cabin-co2": "Cabin CO2 rise", "solar-storm": "Solar particle event",
  "sleep-crisis": "Sleep crisis", "mood-dip": "Isolation mood dip", "cardio-strain": "Cardio strain",
};

export interface SynthOptions { seed?: number; days: number; env: Environment; events?: MissionEvent[] }

/** Slow spaceflight adaptation: small drifts over the first weeks, then a mid-mission mood dip (third-quarter effect). */
function drift(id: IndicatorId, day: number, env: Environment, total: number): number {
  const adapt = 1 - Math.exp(-day / 20);
  const q3 = Math.exp(-Math.pow((day - total * 0.62) / (total * 0.08 + 6), 2));
  const envStress = env === "mars" ? 1.4 : env === "lunar" ? 1.1 : 1;
  switch (id) {
    case "heartRate": return -2 * adapt;
    case "systolic": return -3 * adapt;
    case "temperature": return 0.18 * adapt;
    case "sleep": return -0.5 * adapt * envStress;
    case "mood": return -1.2 * q3 * envStress;
    case "hrv": return -3 * adapt - 3 * q3 * envStress;
    case "reaction": return 6 * adapt * envStress;
    default: return 0;
  }
}

export function generateMission(o: SynthOptions): Record<IndicatorId, Reading[]> {
  const out = {} as Record<IndicatorId, Reading[]>;
  for (const id of Object.keys(INDICATORS) as IndicatorId[]) {
    const b = BASE[id], def = INDICATORS[id];
    // one PRNG stream per indicator, so extending a mission never changes earlier days
    const r = mulberry32((o.seed ?? 42) * 7919 + [...id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
    const arr: Reading[] = [];
    let ar = 0; // AR(1) noise gives realistic day-to-day persistence
    for (let day = 0; day < o.days; day++) {
      ar = 0.35 * ar + gauss(r) * b.sd;
      let v = b.mean + drift(id, day, o.env, o.days) + ar;
      for (const ev of o.events ?? []) {
        if (day >= ev.start && day < ev.start + ev.length) {
          const eff = EFFECT[ev.kind][id];
          if (eff) { const ramp = Math.min(1, (day - ev.start + 1) / Math.max(1, ev.length * 0.4)); v += eff * b.sd * ev.severity * ramp; }
        }
      }
      v = Math.min(def.plausible[1], Math.max(def.plausible[0], v));
      if (id === "mood") v = Math.round(v);
      arr.push({ day, value: +v.toFixed(def.decimals + (id === "mood" ? 0 : 1)), source: "synthetic" });
    }
    out[id] = arr;
  }
  return out;
}

/** Add a new day of readings to existing series, honoring injected events. */
export function nextDay(series: Record<IndicatorId, Reading[]>, env: Environment, total: number, events: MissionEvent[], seed: number) {
  const day = series.heartRate.length;
  const full = generateMission({ seed, days: day + 1, env, events });
  const next = {} as Record<IndicatorId, Reading[]>;
  for (const id of Object.keys(series) as IndicatorId[]) next[id] = [...series[id], full[id][day]];
  void total; return next;
}
