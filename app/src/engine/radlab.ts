/** Parsing of NASA OSDR RadLab ISS radiation measurements. Pure functions, no network. */
export interface RadSample { time: string; instrument: string; module: string; absorbedUGyPerH: number }
export interface RadSummary { n: number; days: number; from: string; to: string; meanUGyPerH: number; mGyPerDay: number; byModule: Record<string, number> }

const unq = (s: string) => s.trim().replace(/^"(.*)"$/, "$1");

/** Accepts tab/comma separated text with a header row, or a JSON array of records. Skips bad rows. */
export function parseRadLab(text: string): RadSample[] {
  const rows: Record<string, string>[] = [];
  const t = text.trim();
  if (t.startsWith("[")) {
    try { const j: unknown = JSON.parse(t); if (Array.isArray(j)) for (const r of j) if (r && typeof r === "object") rows.push(Object.fromEntries(Object.entries(r as object).map(([k, v]) => [k, String(v)]))); } catch { return []; }
  } else {
    const lines = t.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const head = lines[0].split(sep).map(unq);
    for (const l of lines.slice(1)) { const c = l.split(sep).map(unq); rows.push(Object.fromEntries(head.map((h, i) => [h, c[i] ?? ""]))); }
  }
  const out: RadSample[] = [];
  for (const r of rows) {
    const ms = Date.parse(r.timestamp ?? ""); const v = Number(r.absorbed_dose_rate);
    if (Number.isNaN(ms) || r.absorbed_dose_rate === "" || !Number.isFinite(v) || v < 0) continue;
    out.push({ time: new Date(ms).toISOString(), instrument: r.instrument_id ?? "", module: r.module ?? "unknown", absorbedUGyPerH: v });
  }
  return out;
}

export function summarizeRadLab(s: RadSample[]): RadSummary | null {
  if (!s.length) return null;
  const times = s.map((x) => Date.parse(x.time)).sort((a, b) => a - b);
  const mean = s.reduce((a, x) => a + x.absorbedUGyPerH, 0) / s.length;
  const mods: Record<string, number[]> = {};
  for (const x of s) (mods[x.module] ??= []).push(x.absorbedUGyPerH);
  const byModule = Object.fromEntries(Object.entries(mods).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));
  return { n: s.length, days: new Set(s.map((x) => x.time.slice(0, 10))).size, from: new Date(times[0]).toISOString().slice(0, 10), to: new Date(times[times.length - 1]).toISOString().slice(0, 10), meanUGyPerH: mean, mGyPerDay: (mean * 24) / 1000, byModule };
}
export const RADLAB_URL = "https://visualization.osdr.nasa.gov/radlab/api?format=json";
