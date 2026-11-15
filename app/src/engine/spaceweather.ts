/** Parsing and rule-of-thumb summary of NASA DONKI space-weather events. Pure functions, no network. */
export type SwKind = "FLR" | "SEP" | "CME";
export type SwSeverity = "minor" | "moderate" | "strong";
export interface SwEvent { id: string; kind: SwKind; time: string; title: string; severity: SwSeverity; detail?: string }

const iso = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};
const arr = (raw: unknown): Record<string, unknown>[] =>
  Array.isArray(raw) ? raw.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];

/** Flare class letter -> severity. A/B/C are routine, M is moderate, X is strong. */
export function flareSeverity(cls: string): SwSeverity | null {
  const c = cls.trim().toUpperCase()[0];
  if (c === "X") return "strong";
  if (c === "M") return "moderate";
  if (c === "A" || c === "B" || c === "C") return "minor";
  return null;
}

export function parseFlares(raw: unknown): SwEvent[] {
  const out: SwEvent[] = [];
  for (const r of arr(raw)) {
    const cls = typeof r.classType === "string" ? r.classType : "";
    const sev = flareSeverity(cls);
    const time = iso(r.peakTime) ?? iso(r.beginTime);
    if (!sev || !time || typeof r.flrID !== "string") continue;
    out.push({ id: r.flrID, kind: "FLR", time, severity: sev, title: `${cls.trim()} solar flare`, detail: typeof r.sourceLocation === "string" ? r.sourceLocation : undefined });
  }
  return out;
}

export function parseSep(raw: unknown): SwEvent[] {
  const out: SwEvent[] = [];
  for (const r of arr(raw)) {
    const time = iso(r.eventTime);
    if (!time || typeof r.sepID !== "string") continue;
    out.push({ id: r.sepID, kind: "SEP", time, severity: "strong", title: "Solar energetic particle event" });
  }
  return out;
}

export function parseCme(raw: unknown): SwEvent[] {
  const out: SwEvent[] = [];
  for (const r of arr(raw)) {
    const time = iso(r.startTime);
    if (!time || typeof r.activityID !== "string") continue;
    const speeds = arr(r.cmeAnalyses).map((a) => a.speed).filter((s): s is number => typeof s === "number" && Number.isFinite(s) && s > 0);
    const speed = speeds.length ? Math.max(...speeds) : undefined;
    const severity: SwSeverity = speed === undefined ? "minor" : speed >= 1500 ? "strong" : speed >= 900 ? "moderate" : "minor";
    out.push({ id: r.activityID, kind: "CME", time, severity, title: speed ? `Coronal mass ejection (${Math.round(speed)} km/s)` : "Coronal mass ejection", detail: speed ? `${Math.round(speed)} km/s` : undefined });
  }
  return out;
}

export function dedupeSort(events: SwEvent[]): SwEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
}

export type SwLevel = "quiet" | "active" | "elevated" | "storm";
export interface SwSummary { level: SwLevel; headline: string; reason: string; counts: Record<SwKind, number> }

const H = 3600_000;
/** Rule of thumb, NOT an official NASA alert: what happened in the last 48 hours decides the level. */
export function summarize(events: SwEvent[], nowMs: number): SwSummary {
  const counts: Record<SwKind, number> = { FLR: 0, SEP: 0, CME: 0 };
  for (const e of events) counts[e.kind]++;
  const recent = events.filter((e) => nowMs - Date.parse(e.time) <= 48 * H && Date.parse(e.time) <= nowMs + 6 * H);
  const sep = recent.find((e) => e.kind === "SEP");
  const xFlare = recent.find((e) => e.kind === "FLR" && e.severity === "strong");
  const active = recent.find((e) => (e.kind === "FLR" && e.severity === "moderate") || e.kind === "CME");
  if (sep) return { level: "storm", counts, headline: "Radiation storm in progress or recent", reason: "A solar energetic particle event was reported in the last 48 hours. These are the events that raise astronaut radiation dose." };
  if (xFlare) return { level: "elevated", counts, headline: "Elevated solar activity", reason: `An ${xFlare.title.toLowerCase()} was reported in the last 48 hours. Strong flares can be followed by particle events.` };
  if (active) return { level: "active", counts, headline: "Active Sun", reason: "A moderate flare or coronal mass ejection was reported in the last 48 hours." };
  return { level: "quiet", counts, headline: "Quiet conditions", reason: "No notable flare, particle event or coronal mass ejection in the last 48 hours." };
}

const KEY_OK = /^[A-Za-z0-9]{10,60}$/;
export const sanitizeApiKey = (k: string): string | null => (KEY_OK.test(k.trim()) ? k.trim() : null);
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export function donkiUrl(kind: SwKind, nowMs: number, days: number, apiKey: string): string {
  return `https://api.nasa.gov/DONKI/${kind}?startDate=${ymd(nowMs - days * 24 * H)}&endDate=${ymd(nowMs)}&api_key=${encodeURIComponent(apiKey)}`;
}
