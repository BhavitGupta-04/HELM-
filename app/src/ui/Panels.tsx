import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  CAREER_DOSE_LIMIT_MSV, ENVIRONMENTS, EVENT_LABELS, HAZARDS, SHELTER_STEPS, SW_DOSE_MULTIPLIER, buildSbar, cumulativeDose, daysUntilLimit, decodePacket, encodePacket,
  fmtDur, ghostTrajectory, liveDoseRate, triage, type EventKind, type HazardId, type SwLevel,
} from "../engine";
import type { Mission } from "./state";
import { IDS, STATUS_COLOR } from "./state";

/* ---------- Light-speed link ---------- */
export function DelayLink({ m }: { m: Mission }) {
  const env = ENVIRONMENTS[m.env];
  const dur = Math.min(6, Math.max(1.4, 1.2 + Math.log10(m.delaySec + 1) * 1.5));
  return (
    <div style={{ minWidth: 300 }}>
      <div className="row" style={{ display: "flex", justifyContent: "space-between" }}><span className="eyebrow">Light-time to Earth</span><span className="mono" style={{ color: "var(--accent)" }}>{fmtDur(m.delaySec)} one-way</span></div>
      <svg viewBox="0 0 300 36" width="100%" height="36" aria-hidden="true">
        <circle cx="14" cy="18" r="9" fill="#3f8cff" /><circle cx="14" cy="18" r="9" fill="none" stroke="#9fd0ff" opacity=".6" /><path d="M8 15 q5 -3 8 1 t6 -1" stroke="#7dffb0" fill="none" />
        <rect x="278" y="12" width="14" height="12" rx="3" fill="#cfe4ff" /><rect x="272" y="16" width="6" height="4" fill="#5ec8ff" /><rect x="292" y="16" width="6" height="4" fill="#5ec8ff" />
        <line x1="26" y1="18" x2="268" y2="18" stroke="rgba(130,200,255,.3)" strokeDasharray="2 5" />
        <motion.circle key={dur} r="3.5" cy="18" fill="var(--accent)" initial={{ cx: 270 }} animate={{ cx: [270, 28], opacity: [0, 1, 1, 0] }} transition={{ duration: dur, repeat: Infinity, ease: "linear" }} style={{ filter: "drop-shadow(0 0 6px var(--accent))" }} />
      </svg>
      <input type="range" min={Math.log10(env.delayMin)} max={Math.log10(env.delayMax)} step="0.005" value={Math.log10(m.delaySec)}
        onChange={(e) => m.setDelay(Math.pow(10, +e.target.value))} aria-label="One-way communication delay" disabled={env.delayMin === env.delayMax} />
    </div>
  );
}

/* ---------- Triage + SBAR ---------- */
export function TriagePanel({ m }: { m: Mission }) {
  const t = useMemo(() => triage(m.overall, m.delaySec), [m.overall, m.delaySec]);
  const input = useMemo(() => ({ crewId: "CREW-1", missionDay: m.day, environment: ENVIRONMENTS[m.env].label, assessments: Object.values(m.assessments), patterns: m.patterns, notes: m.reportNotes }), [m]);
  const sbar = useMemo(() => buildSbar(input), [input]);
  const packet = useMemo(() => encodePacket(input), [input]);
  const [copied, setCopied] = useState(false);
  const col = STATUS_COLOR[m.overall];
  const copy = async () => { try { await navigator.clipboard.writeText(packet); setCopied(true); setTimeout(() => setCopied(false), 1400); void m.log("transmit", { packet }); } catch { /* clipboard blocked */ } };
  return (
    <section className="glass pad" aria-live="polite">
      <div className="row" style={{ display: "flex", justifyContent: "space-between" }}><span className="eyebrow">Decision engine</span><span className={`pill s-${m.overall}`}>{m.overall}</span></div>
      <AnimatePresence mode="wait"><motion.div key={t.route + m.delaySec.toFixed(0)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
        <h2 style={{ fontSize: 20, margin: "10px 0 6px", color: col }}>{t.headline}</h2>
        <p className="sbar" style={{ margin: 0 }}>{t.rationale}</p>
        {t.groundAdviceEtaSec !== null && <p className="mono" style={{ fontSize: 12, color: "var(--accent2)", margin: "8px 0 0" }}>Earth reply expected in ~{fmtDur(t.groundAdviceEtaSec)}</p>}
        {t.steps.length > 0 && <ol className="sbar" style={{ paddingLeft: 18, margin: "8px 0 0" }}>{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>}
      </motion.div></AnimatePresence>
      {m.patterns.map((p) => (
        <motion.div key={p.id} layout initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} style={{ marginTop: 10, padding: 10, borderRadius: 12, border: `1px solid ${STATUS_COLOR[p.severity]}55`, background: "rgba(255,255,255,.03)" }}>
          <div className="row" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontSize: 13 }}>{p.label}</b><span className="mono" style={{ fontSize: 12, color: STATUS_COLOR[p.severity] }}>{Math.round(p.confidence * 100)}%</span></div>
          <p className="sbar" style={{ margin: "4px 0" }}>{p.explanation}</p><p className="sbar" style={{ margin: 0, color: "var(--ink)" }}>{p.action}</p>
        </motion.div>))}
      <details style={{ marginTop: 12 }}><summary className="eyebrow" style={{ cursor: "pointer" }}>Report for flight surgeon (SBAR)</summary>
        <div className="sbar"><b>Situation</b>{sbar.situation}<b>Background</b>{sbar.background}<b>Assessment</b>{sbar.assessment}<b>Recommendation</b>{sbar.recommendation}</div>
        <p className="eyebrow" style={{ margin: "12px 0 6px" }}>Low-bandwidth packet · {packet.length} bytes · checksum protected</p>
        <div className="packet">{packet}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}><button className="btn primary" onClick={copy}>{copied ? "Copied" : "Copy & log transmission"}</button>
          <span className="legend">decodes to: {decodePacket(packet)?.p.join(", ") || "no pattern"}</span></div>
      </details>
    </section>
  );
}

/* ---------- Hazard radar ---------- */
/** How much the radiation hazard load bumps for the current REAL NASA DONKI level (HELM's own weighting). */
const SW_LOAD_BUMP: Record<SwLevel, number> = { quiet: 0, active: 0.1, elevated: 0.25, storm: 0.45 };

export function HazardRadar({ m, active, onPick, swLevel }: { m: Mission; active: HazardId | null; onPick: (h: HazardId | null) => void; swLevel?: SwLevel }) {
  const env = ENVIRONMENTS[m.env];
  const avg = (ids: typeof IDS) => ids.reduce((s, id) => s + Math.max(0, m.assessments[id].z * (id === "sleep" || id === "mood" || id === "hrv" || id === "spo2" ? -1 : 1)), 0) / ids.length;
  const load: Record<HazardId, number> = {
    radiation: Math.min(1, env.doseRate / 2 + (m.storm ? 0.35 : 0) + SW_LOAD_BUMP[swLevel ?? "quiet"]),
    isolation: Math.min(1, 0.2 + avg(["sleep", "mood", "hrv"]) / 4 + (m.day / m.total) * 0.25),
    distance: Math.min(1, Math.log10(m.delaySec + 1) / 3.2),
    gravity: Math.min(1, 0.25 + m.day / m.total * 0.6),
    closed: Math.min(1, 0.2 + avg(["respRate", "spo2", "reaction", "temperature"]) / 4),
  };
  const keys = Object.keys(HAZARDS) as HazardId[];
  const cx = 130, cy = 120, R = 86;
  const pt = (i: number, f: number) => { const a = -Math.PI / 2 + (i / keys.length) * Math.PI * 2; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f] as const; };
  const d = keys.map((k, i) => { const [x, y] = pt(i, 0.12 + 0.88 * load[k]); return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ") + " Z";
  return (
    <section className="glass pad"><div className="eyebrow">NASA HRP hazard load (HELM estimate)</div>
      <svg viewBox="0 0 260 240" width="100%" role="img" aria-label="Hazard radar chart">
        {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={keys.map((_, i) => pt(i, f).join(",")).join(" ")} fill="none" stroke="rgba(130,180,255,.16)" />)}
        {keys.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="rgba(130,180,255,.12)" />)}
        <motion.path d={d} fill="rgba(0,229,195,.2)" stroke="var(--accent)" strokeWidth="2" animate={{ d }} transition={{ type: "spring", stiffness: 80, damping: 16 }} style={{ filter: "drop-shadow(0 0 8px var(--accent))" }} />
        {keys.map((k, i) => { const [x, y] = pt(i, 1.22); return <text key={k} x={x} y={y + 4} textAnchor="middle" fontSize="10.5" fill={active === k ? HAZARDS[k].color : "var(--muted)"}>{HAZARDS[k].short}</text>; })}
      </svg>
      <div className="hazard-row">{keys.map((k) => <button key={k} className="chip" aria-pressed={active === k} onClick={() => onPick(active === k ? null : k)} style={active === k ? { background: HAZARDS[k].color, borderColor: HAZARDS[k].color } : { borderColor: `${HAZARDS[k].color}66` }}>{HAZARDS[k].short}</button>)}</div>
      <p className="sbar" style={{ minHeight: 40, margin: "10px 0 0" }}>{active ? HAZARDS[active].blurb : "Pick a hazard to see which body systems it touches on the map."}</p>
      {active && <div className="legend" style={{ marginTop: 6 }}>
        {HAZARDS[active].risks.length ? <>Related NASA HRP risks (HELM's own grouping): {HAZARDS[active].risks.map((r) => r.replace("Risk of ", "")).join("; ")}. </> : <>NASA's risk list names no single risk for this hazard. </>}
        <a href={HAZARDS[active].nasaUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>NASA HRP: {HAZARDS[active].label}</a></div>}
    </section>
  );
}

/* ---------- Dose wallet ---------- */
export function DoseWallet({ m, swLevel }: { m: Mission; swLevel?: SwLevel }) {
  const spe = m.storm ? { start: m.storm.day, end: m.storm.day + 1, extra: 25 } : undefined;
  const dose = cumulativeDose(m.env, m.day, spe);
  const frac = Math.min(1, dose / CAREER_DOSE_LIMIT_MSV);
  const C = 2 * Math.PI * 44;
  const level = swLevel ?? "quiet";
  const rate = liveDoseRate(m.env, level);
  const boosted = level === "elevated" || level === "storm";
  return (
    <section className="glass pad" style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 14, alignItems: "center" }}>
      <svg viewBox="0 0 110 110" width="110" aria-label={`Radiation budget used ${Math.round(frac * 100)} percent`} role="img">
        <circle cx="55" cy="55" r="44" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="9" />
        <motion.circle cx="55" cy="55" r="44" fill="none" stroke={frac > .8 ? "var(--critical)" : frac > .5 ? "var(--caution)" : "var(--watch)"} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} transform="rotate(-90 55 55)"
          animate={{ strokeDashoffset: C * (1 - frac) }} initial={{ strokeDashoffset: C }} transition={{ duration: 1, ease: "easeOut" }} style={{ filter: "drop-shadow(0 0 6px var(--watch))" }} />
        <text x="55" y="53" textAnchor="middle" fill="var(--ink)" fontSize="19" fontWeight="650" fontFamily="var(--mono)">{Math.round(frac * 100)}%</text>
        <text x="55" y="69" textAnchor="middle" fill="var(--muted)" fontSize="9">career limit</text>
      </svg>
      <div><div className="eyebrow">Dose wallet</div>
        <div className="mono" style={{ fontSize: 22, margin: "4px 0" }}>{dose.toFixed(0)} <span style={{ fontSize: 12, color: "var(--muted)" }}>of {CAREER_DOSE_LIMIT_MSV} mSv</span></div>
        <div className="legend">{rate.toFixed(2)} mSv/day {boosted ? "(live-adjusted)" : "here"} · ~{daysUntilLimit(m.env, dose, level)} days of budget left</div>
        {boosted && <div className="legend" style={{ color: "var(--watch)", marginTop: 2 }}>Live NASA DONKI space weather is {level}: today's rate is scaled ×{SW_DOSE_MULTIPLIER[level]} (HELM's own illustrative multiplier, see the space weather panel).</div>}
      </div>
    </section>
  );
}

/* ---------- Ghost Self ---------- */
export function GhostSelf({ m }: { m: Mission }) {
  const [adh, setAdh] = useState(0.7);
  const horizon = Math.min(m.total, m.day + 180);
  const pts = useMemo(() => ghostTrajectory(horizon, adh, 6), [horizon, adh]);
  const worstCase = useMemo(() => ghostTrajectory(horizon, 0, 6), [horizon]);
  const W = 300, H = 90, maxY = 25;
  const line = (arr: typeof pts, k: "bonePct" | "musclePct") => arr.map((p, i) => `${i ? "L" : "M"}${(p.day / horizon) * W},${H - (p[k] / maxY) * H}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <section className="glass pad"><div className="eyebrow">Ghost Self · your body at day {horizon}</div>
      <svg viewBox={`0 0 ${W} ${H + 6}`} width="100%" role="img" aria-label="Projected bone and muscle loss">
        <path d={line(worstCase, "musclePct")} fill="none" stroke="rgba(255,255,255,.2)" strokeDasharray="3 4" /><path d={line(worstCase, "bonePct")} fill="none" stroke="rgba(255,255,255,.2)" strokeDasharray="3 4" />
        <motion.path d={line(pts, "musclePct")} fill="none" stroke="var(--caution)" strokeWidth="2" animate={{ d: line(pts, "musclePct") }} />
        <motion.path d={line(pts, "bonePct")} fill="none" stroke="var(--accent2)" strokeWidth="2" animate={{ d: line(pts, "bonePct") }} />
      </svg>
      <div className="legend" style={{ display: "flex", gap: 12 }}><span style={{ color: "var(--caution)" }}>● muscle {last.musclePct.toFixed(1)}%</span><span style={{ color: "var(--accent2)" }}>● bone {last.bonePct.toFixed(1)}%</span><span>dashed = no exercise</span></div>
      <label className="sbar" style={{ display: "block", marginTop: 8 }}>Exercise adherence: <b style={{ display: "inline", color: "var(--ink)" }}>{Math.round(adh * 100)}%</b>
        <input type="range" min="0" max="1" step="0.05" value={adh} onChange={(e) => setAdh(+e.target.value)} aria-label="Exercise adherence" /></label>
      <p className="legend" style={{ margin: 0 }}>Illustrative model from published NASA loss rates. Not a clinical prediction.</p>
    </section>
  );
}

/* ---------- Chaos Director ---------- */
const KINDS: EventKind[] = ["infection", "cabin-co2", "solar-storm", "sleep-crisis", "mood-dip", "cardio-strain"];
export function ChaosDirector({ m }: { m: Mission }) {
  const [sev, setSev] = useState<"mild" | "moderate" | "severe">("moderate");
  return (
    <section className="glass pad"><div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <span className="eyebrow">Chaos Director · inject a mission event</span>
      <div className="seg" role="group" aria-label="Severity">{(["mild", "moderate", "severe"] as const).map((s) => <button key={s} aria-pressed={sev === s} onClick={() => setSev(s)}>{s}</button>)}</div></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {KINDS.map((k) => <button key={k} className="btn" onClick={() => m.inject(k, sev)}>{EVENT_LABELS[k]}</button>)}
        <button className="btn danger" onClick={m.clearEvents}>Clear all</button></div>
      {m.events.length > 0 && <p className="legend" style={{ margin: "10px 0 0" }}>Active: {m.events.map((e) => EVENT_LABELS[e.kind]).join(", ")}</p>}
    </section>
  );
}

/* ---------- Black box ---------- */
export function BlackBox({ m }: { m: Mission }) {
  const last = m.ledgerEntries.slice(-4);
  return (
    <section className="glass pad"><div className="eyebrow">Black Box · tamper-evident log</div>
      <p className="legend" style={{ margin: "6px 0 10px" }}>Every reading, event and transmission is chained with SHA-256. Change one entry and every later hash breaks.</p>
      <div className="chain">{last.length === 0 ? <span className="legend">No entries yet. Log a reading or inject an event.</span> : last.map((e) => <span key={e.index} className={`link ${m.tamperAt === e.index ? "bad" : ""}`} title={e.type}>#{e.index} {e.type} {e.hash.slice(0, 8)}</span>)}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        <button className="btn" onClick={() => m.verify(false)}>Verify chain</button><button className="btn danger" onClick={() => m.verify(true)}>Simulate tampering</button>
        <span className="mono" style={{ fontSize: 12, color: m.tamperAt === -1 ? "var(--nominal)" : "var(--critical)" }}>{m.ledgerEntries.length === 0 ? "" : m.tamperAt === -1 ? "chain intact" : `broken at #${m.tamperAt}`}</span></div>
    </section>
  );
}

/* ---------- Solar particle event overlay ---------- */
export function StormOverlay({ m }: { m: Mission }) {
  const [secs, setSecs] = useState(30 * 60);
  const [done, setDone] = useState<number[]>([]);
  useMemo(() => { setSecs(30 * 60); setDone([]); }, [m.storm?.day]);
  useStorm(!!m.storm, () => setSecs((s) => Math.max(0, s - 1)));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
  return (
    <AnimatePresence>{m.storm && (
      <motion.div className="storm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alertdialog" aria-label="Solar particle event">
        <motion.div className="glass panel" initial={{ scale: .92, y: 20 }} animate={{ scale: 1, y: 0 }}>
          <div className="eyebrow" style={{ color: "var(--watch)" }}>Solar particle event · shelter protocol</div>
          <motion.div className="mono" style={{ fontSize: 76, fontWeight: 650, color: "var(--watch)", margin: "6px 0" }} animate={{ textShadow: ["0 0 10px #ffb454", "0 0 34px #ffb454", "0 0 10px #ffb454"] }} transition={{ duration: 1.6, repeat: Infinity }}>{mm}:{ss}</motion.div>
          {m.storm.source && <div className="legend" style={{ marginBottom: 6 }}>Replaying real NASA DONKI event: {m.storm.source}. The crew's response is simulated.</div>}
          <div className="legend" style={{ marginBottom: 10 }}>Time to reach the storm shelter. Tap steps as you finish them.</div>
          <div style={{ display: "grid", gap: 8 }}>{SHELTER_STEPS.map((s, i) => (
            <button key={s} className="btn" style={{ justifyContent: "flex-start", textAlign: "left", opacity: done.includes(i) ? .5 : 1 }} onClick={() => setDone((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i])}>
              <span style={{ width: 22, height: 22, borderRadius: 7, border: "1.5px solid var(--watch)", display: "grid", placeItems: "center", flex: "none" }}>{done.includes(i) ? "✓" : i + 1}</span>{s}</button>))}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}><button className="btn primary" onClick={() => { void m.log("shelter", { steps: done.length }); m.setStorm(null); }}>Exit shelter and log dose</button></div>
        </motion.div></motion.div>)}</AnimatePresence>
  );
}
import { useEffect } from "react";
function useStorm(active: boolean, tick: () => void) { useEffect(() => { if (!active) return; const id = setInterval(tick, 1000); return () => clearInterval(id); }, [active]); }
