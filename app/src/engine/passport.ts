import type { IndicatorId } from "./types";

/** Optional pre-flight ("Earth") health background, entered and kept by the user on this device. */
export type Fitness = "low" | "average" | "high" | "athlete";
export interface Passport {
  age?: number; heightCm?: number; weightKg?: number; fitness?: Fitness;
  restingHr?: number; systolic?: number; sleepHours?: number; temperature?: number; glucose?: number; spo2?: number;
  conditions?: string; medications?: string; allergies?: string;
  /** Notes only ever leave the device inside the flight-surgeon report, and only when this is true. */
  includeNotesInReport?: boolean;
}

export const NUMERIC_FIELDS = ["age", "heightCm", "weightKg", "restingHr", "systolic", "sleepHours", "temperature", "glucose", "spo2"] as const;
export type NumericField = (typeof NUMERIC_FIELDS)[number];
export const PASSPORT_LIMITS: Record<NumericField, [number, number]> = {
  age: [18, 90], heightCm: [120, 230], weightKg: [35, 200], restingHr: [35, 120], systolic: [80, 190],
  sleepHours: [3, 12], temperature: [35, 38], glucose: [50, 200], spo2: [85, 100],
};
export const TEXT_FIELDS = ["conditions", "medications", "allergies"] as const;
export const MAX_TEXT = 300;
const FITNESS: Fitness[] = ["low", "average", "high", "athlete"];

/** Keep only known fields with sane values. Anything else (from an imported file, say) is dropped. */
export function sanitizePassport(raw: unknown): Passport {
  const out: Passport = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const k of NUMERIC_FIELDS) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= PASSPORT_LIMITS[k][0] && v <= PASSPORT_LIMITS[k][1]) out[k] = v;
  }
  if (typeof r.fitness === "string" && (FITNESS as string[]).includes(r.fitness)) out.fitness = r.fitness as Fitness;
  for (const k of TEXT_FIELDS) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, MAX_TEXT);
  }
  if (r.includeNotesInReport === true) out.includeNotesInReport = true;
  return out;
}

export function passportFieldCount(p: Passport): number {
  return Object.entries(p).filter(([k, v]) => k !== "includeNotesInReport" && v !== undefined && v !== "").length;
}

export interface Prior { center: number; half: number }

/** What this person's Earth records say is normal for them. Used only until HELM has learned their space baseline. */
export function priorsFor(p: Passport): Partial<Record<IndicatorId, Prior>> {
  const out: Partial<Record<IndicatorId, Prior>> = {};
  const fitHr = p.fitness === "athlete" ? 52 : p.fitness === "high" ? 58 : p.fitness === "low" ? 74 : undefined;
  const hr = p.restingHr ?? fitHr;
  if (hr !== undefined) out.heartRate = { center: hr, half: Math.max(5, 0.12 * hr) };
  if (p.systolic !== undefined) out.systolic = { center: p.systolic, half: 10 };
  if (p.sleepHours !== undefined) out.sleep = { center: p.sleepHours, half: 1 };
  if (p.temperature !== undefined) out.temperature = { center: p.temperature, half: 0.4 };
  if (p.glucose !== undefined) out.glucose = { center: p.glucose, half: 15 };
  if (p.spo2 !== undefined) out.spo2 = { center: p.spo2, half: 2 };
  return out;
}

/** Self-entered notes for the flight-surgeon report. Empty unless the person opted in. */
export function notesForReport(p: Passport): string | undefined {
  if (!p.includeNotesInReport) return undefined;
  const parts = [
    p.conditions && `conditions: ${p.conditions}`, p.medications && `medicines: ${p.medications}`, p.allergies && `allergies: ${p.allergies}`,
  ].filter(Boolean);
  return parts.length ? `Self-entered Earth notes (not a verified record): ${parts.join("; ")}.` : undefined;
}
