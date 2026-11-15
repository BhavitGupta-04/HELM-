import { generateMission, type EventKind } from "./synth";
import { assessIndicator } from "./assess";
import { detectPatterns } from "./fusion";
import { INDICATORS } from "./indicators";
import type { IndicatorId } from "./types";

/**
 * The exact same check tests/validation.test.ts runs, exposed so the Trust & Validation page can run it live in the
 * browser and show a number that is provably the number the test suite checks — not a claim copied from a log.
 */
const ids = Object.keys(INDICATORS) as IndicatorId[];

function patternsAt(seed: number, day: number, events: { kind: EventKind; start: number; length: number; severity: number }[]): string[] {
  const m = generateMission({ seed, days: day + 1, env: "mars", events });
  const a: Record<string, ReturnType<typeof assessIndicator>> = {};
  for (const id of ids) a[id] = assessIndicator(id, m[id].slice(0, day).map((x) => x.value), m[id][day].value);
  return detectPatterns(a as Parameters<typeof detectPatterns>[0]).map((p) => p.id);
}

export interface SensitivityCase { kind: EventKind; pattern: string; minPct: number; pct: number; hits: number; n: number }
export interface ValidationResult { falseAlarmPct: number; falseAlarmChecks: number; falseAlarmHits: number; seeds: number; sensitivity: SensitivityCase[] }

const SENSITIVITY_CASES: [EventKind, string, number][] = [["infection", "infection", 0.9], ["cabin-co2", "cabin-air", 0.9], ["cardio-strain", "cardio-strain", 0.85]];

export function runValidationSuite(seedCount = 30): ValidationResult {
  const seeds = Array.from({ length: seedCount }, (_, i) => i + 1);
  let hits = 0, n = 0;
  for (const s of seeds) for (let d = 40; d < 110; d += 3) { n++; if (patternsAt(s, d, []).length) hits++; }
  const sensitivity: SensitivityCase[] = SENSITIVITY_CASES.map(([kind, pattern, minPct]) => {
    let hit = 0;
    for (const s of seeds) if (patternsAt(s, 80, [{ kind, start: 77, length: 12, severity: 2.1 }]).includes(pattern)) hit++;
    return { kind, pattern, minPct, pct: hit / seeds.length, hits: hit, n: seeds.length };
  });
  return { falseAlarmPct: hits / n, falseAlarmChecks: n, falseAlarmHits: hits, seeds: seedCount, sensitivity };
}
