import { useCallback, useMemo, useRef, useState } from "react";
import {
  INDICATORS, ENVIRONMENTS, assessIndicator, detectPatterns, generateMission, personalInterval, referenceHistory, worst, Ledger, STATUS_RANK, priorsFor, notesForReport,
  type Assessment, type Passport, type Environment, type EventKind, type IndicatorId, type MissionEvent, type Pattern, type Reading, type Status, type SystemId, type LedgerEntry,
} from "../engine";

export const IDS = Object.keys(INDICATORS) as IndicatorId[];
const SEED = 7; // a calm-start demo mission (see docs/VALIDATION.md)
export const SEVERITY = { mild: 1.3, moderate: 2.1, severe: 3.4 } as const;

export function useMission(profile: Passport = {}) {
  const [env, setEnv] = useState<Environment>("mars");
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const total = ENVIRONMENTS[env].missionDays;
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [viewDay, setViewDay] = useState(44);
  const [delay, setDelay] = useState<number | null>(null);
  const [storm, setStorm] = useState<{ day: number; source?: string } | null>(null);
  const [warp, setWarp] = useState(0);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [tamperAt, setTamperAt] = useState<number>(-1);
  const ledger = useRef(new Ledger());

  const delaySec = delay ?? ENVIRONMENTS[env].delayDefault;
  const priors = useMemo(() => priorsFor(profile), [profile]);
  const reportNotes = useMemo(() => notesForReport(profile), [profile]);

  const base = useMemo(() => generateMission({ seed: SEED, days: total, env, events }), [env, total, events]);
  const series = useMemo(() => {
    const out = {} as Record<IndicatorId, Reading[]>;
    for (const id of IDS) out[id] = base[id].map((r) => (overrides[`${id}:${r.day}`] !== undefined ? { ...r, value: overrides[`${id}:${r.day}`], source: "manual" as const } : r));
    return out;
  }, [base, overrides]);

  const day = Math.min(viewDay, total - 1);
  const assessments = useMemo(() => {
    const out = {} as Record<IndicatorId, Assessment>;
    for (const id of IDS) out[id] = assessIndicator(id, series[id].slice(0, day).map((r) => r.value), series[id][day].value, priors[id]);
    return out;
  }, [series, day, priors]);

  const bands = useMemo(() => {
    const out = {} as Record<IndicatorId, ({ lo: number; hi: number } | null)[]>;
    const start = Math.max(0, day - 29);
    for (const id of IDS) {
      const floor = 0.1 * (INDICATORS[id].earth[1] - INDICATORS[id].earth[0]);
      const vals = series[id].map((r) => r.value);
      out[id] = [];
      for (let t = start; t <= day; t++) { const iv = personalInterval(referenceHistory(vals.slice(0, t)), floor); out[id].push(iv ? { lo: iv.lo, hi: iv.hi } : priors[id] ? { lo: priors[id]!.center - priors[id]!.half, hi: priors[id]!.center + priors[id]!.half } : null); }
    }
    return out;
  }, [series, day, priors]);

  const patterns: Pattern[] = useMemo(() => detectPatterns(assessments), [assessments]);

  const systemStatus = useMemo(() => {
    const m = {} as Record<SystemId, Status>;
    (["brain", "heart", "lungs", "bones", "muscle", "eyes", "gut", "immune"] as SystemId[]).forEach((s) => (m[s] = "nominal"));
    for (const id of IDS) { const s = INDICATORS[id].system; m[s] = worst([m[s], assessments[id].status]); }
    for (const p of patterns) for (const id of p.drivers) { const s = INDICATORS[id].system; if (STATUS_RANK[p.severity] > STATUS_RANK[m[s]]) m[s] = p.severity; }
    return m;
  }, [assessments, patterns]);

  const overall: Status = useMemo(() => worst([...Object.values(assessments).map((a) => a.status), ...patterns.map((p) => p.severity)]), [assessments, patterns]);

  const readiness = useMemo(() => {
    const pen = { nominal: 0, uncertain: 0, watch: 4, caution: 11, critical: 28 } as const;
    let r = 100 - Object.values(assessments).reduce((n, a) => n + pen[a.status], 0) - patterns.reduce((n, p) => n + 6 * p.confidence, 0);
    return Math.max(0, Math.min(100, Math.round(r)));
  }, [assessments, patterns]);

  const log = useCallback(async (type: string, payload: unknown) => {
    await ledger.current.append(type, payload);
    setLedgerEntries([...ledger.current.entries]);
  }, []);

  const jump = useCallback((d: number) => {
    setViewDay((cur) => { const n = Math.max(0, Math.min(total - 1, d)); setWarp(Math.min(1, Math.abs(n - cur) / 8)); setTimeout(() => setWarp(0), 650); return n; });
  }, [total]);

  const inject = useCallback((kind: EventKind, sev: keyof typeof SEVERITY) => {
    const ev: MissionEvent = { kind, start: Math.max(0, day - 3), length: 12, severity: SEVERITY[sev] };
    setEvents((e) => [...e.filter((x) => x.kind !== kind), ev]);
    if (kind === "solar-storm") setStorm({ day });
    void log("event", { kind, sev, day });
  }, [day, log]);

  const replay = useCallback((ev: { id: string; title: string; severity: "minor" | "moderate" | "strong" }) => {
    const sev = ev.severity === "strong" ? "severe" : ev.severity === "moderate" ? "moderate" : "mild";
    const e: MissionEvent = { kind: "solar-storm", start: Math.max(0, day - 3), length: 12, severity: SEVERITY[sev as keyof typeof SEVERITY] };
    setEvents((x) => [...x.filter((y) => y.kind !== "solar-storm"), e]);
    setStorm({ day, source: ev.title });
    void log("event", { kind: "replay", source: "NASA DONKI", id: ev.id, day });
  }, [day, log]);

  const clearEvents = useCallback(() => { setEvents([]); setStorm(null); setOverrides({}); void log("event", { kind: "clear", day }); }, [day, log]);

  const logReading = useCallback((id: IndicatorId, v: number) => {
    setOverrides((o) => ({ ...o, [`${id}:${day}`]: v }));
    void log("reading", { id, v, day });
  }, [day, log]);

  const changeEnv = useCallback((e: Environment) => { setEnv(e); setDelay(null); setEvents([]); setOverrides({}); setStorm(null); setViewDay(44); }, []);

  const verify = useCallback(async (tamper: boolean) => {
    // Simulating tampering needs something in the chain to corrupt. On a fresh session nothing has
    // been logged yet, so seed a couple of real entries first rather than silently doing nothing.
    if (tamper && ledger.current.entries.length < 2) {
      await ledger.current.append("reading", { id: "heartRate", v: series.heartRate[day]?.value ?? 64, day });
      await ledger.current.append("reading", { id: "systolic", v: series.systolic[day]?.value ?? 112, day });
      setLedgerEntries([...ledger.current.entries]);
    }
    const entries = tamper ? JSON.parse(JSON.stringify(ledger.current.entries)) as LedgerEntry[] : ledger.current.entries;
    if (tamper && entries.length > 1) (entries[Math.floor(entries.length / 2)].payload as any) = { forged: true };
    setTamperAt(await ledger.current.verify(entries));
    if (tamper) setLedgerEntries(entries);
    else setLedgerEntries([...ledger.current.entries]);
  }, [series, day]);

  return { priors, reportNotes, env, changeEnv, total, day, jump, series, assessments, bands, patterns, systemStatus, overall, readiness, events, inject, replay, clearEvents, logReading,
    delaySec, setDelay, storm, setStorm, warp, ledgerEntries, tamperAt, verify, log };
}
export type Mission = ReturnType<typeof useMission>;
export const STATUS_COLOR: Record<Status, string> = { nominal: "var(--nominal)", watch: "var(--watch)", caution: "var(--caution)", critical: "var(--critical)", uncertain: "var(--uncertain)" };
