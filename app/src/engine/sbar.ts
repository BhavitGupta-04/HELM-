import { INDICATORS } from "./indicators";
import type { Assessment, Pattern } from "./types";
import { STATUS_RANK } from "./types";

export interface SbarInput {
  crewId: string; missionDay: number; environment: string;
  assessments: Assessment[]; patterns: Pattern[];
  /** Optional self-entered Earth notes. Only present when the person opted in. */
  notes?: string;
}
export interface Sbar { situation: string; background: string; assessment: string; recommendation: string }

export function buildSbar(i: SbarInput): Sbar {
  const flagged = i.assessments.filter((a) => STATUS_RANK[a.status] >= 1).sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
  const lead = flagged[0];
  const situation = lead
    ? `${i.crewId}, mission day ${i.missionDay}: ${INDICATORS[lead.id].label} ${lead.value} ${INDICATORS[lead.id].unit} (${lead.status}).`
    : `${i.crewId}, mission day ${i.missionDay}: no deviations.`;
  const background = `Environment: ${i.environment}. Personal baselines are computed from this crewmember's own history; ${i.assessments.length} indicators assessed.${i.notes ? " " + i.notes : ""}`;
  const assessment = [
    ...flagged.map((a) => `${INDICATORS[a.id].short}: ${a.value} ${INDICATORS[a.id].unit}, ${a.status}. ${a.reasons[0] ?? ""}`),
    ...i.patterns.map((p) => `Pattern: ${p.label} (confidence ${Math.round(p.confidence * 100)}%).`),
  ].join(" ") || "All indicators within personal bands.";
  const recommendation = i.patterns[0]?.action ?? (lead ? INDICATORS[lead.id].actions[0] : "Continue routine monitoring.");
  return { situation, background, assessment, recommendation };
}

export function crc32(str: string): number {
  let c, crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    c = (crc ^ str.charCodeAt(i)) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const toB64Url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64Url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

export interface Packet { v: 1; c: string; d: number; e: string; f: [string, number, string][]; p: string[] }

/** Ultra-compact packet for bad links: only flagged indicators and pattern ids. */
export function encodePacket(i: SbarInput): string {
  const pkt: Packet = {
    v: 1, c: i.crewId, d: i.missionDay, e: i.environment,
    f: i.assessments.filter((a) => STATUS_RANK[a.status] >= 1).map((a) => [a.id, +a.value.toFixed(1), a.status[0]]),
    p: i.patterns.map((p) => p.id),
  };
  const body = toB64Url(JSON.stringify(pkt));
  return `${body}.${crc32(body).toString(36)}`;
}

export function decodePacket(s: string): Packet | null {
  const [body, sum] = s.split(".");
  if (!body || !sum || crc32(body).toString(36) !== sum) return null;
  try { return JSON.parse(fromB64Url(body)) as Packet; } catch { return null; }
}
