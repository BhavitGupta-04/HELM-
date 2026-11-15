import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Mission } from "./state";

/**
 * Abbreviated psychomotor vigilance test (PVT). Modeled on the structure of the NASA PVT-B used in real astronaut
 * fatigue research (a visual stimulus appears after a random wait; the crew member responds as fast as possible;
 * median response time, "lapses" over 500ms, and false starts are scored) — but this is a 60-second abbreviated
 * version built for this project, not the validated clinical PVT-B. It is not a substitute for that instrument.
 * Fatigue, elevated cabin CO2 and cognitive overload all show up here before a person would self-report them.
 */
const DURATION_S = 60, ISI_MIN_MS = 1800, ISI_MAX_MS = 5000, LAPSE_MS = 500;
type Phase = "idle" | "waiting" | "go" | "done";

export function ReactionTest({ m }: { m: Mission }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [rts, setRts] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [logged, setLogged] = useState(false);
  const t0 = useRef(0), trialStart = useRef(0), timer = useRef(0), tickId = useRef(0), stop = useRef(false);
  const rtsRef = useRef<number[]>([]), fsRef = useRef(0);

  const nextTrial = useCallback(() => {
    if (stop.current) return;
    setPhase("waiting");
    const wait = ISI_MIN_MS + Math.random() * (ISI_MAX_MS - ISI_MIN_MS);
    timer.current = window.setTimeout(() => { if (!stop.current) { trialStart.current = performance.now(); setPhase("go"); } }, wait);
  }, []);

  const finish = useCallback(() => {
    stop.current = true; clearTimeout(timer.current); cancelAnimationFrame(tickId.current);
    setPhase("done");
  }, []);

  const start = useCallback(() => {
    setRts([]); setFalseStarts(0); rtsRef.current = []; fsRef.current = 0; setElapsed(0); setLogged(false);
    stop.current = false; t0.current = performance.now();
    const tick = () => {
      const e = (performance.now() - t0.current) / 1000; setElapsed(e);
      if (e >= DURATION_S) { finish(); return; }
      tickId.current = requestAnimationFrame(tick);
    };
    tickId.current = requestAnimationFrame(tick);
    nextTrial();
  }, [nextTrial, finish]);

  const respond = useCallback(() => {
    if (phase === "waiting") {
      // Responded before the stimulus appeared: a false start. Cancel this trial and start a fresh one.
      clearTimeout(timer.current); fsRef.current += 1; setFalseStarts(fsRef.current);
      if (!stop.current && elapsed < DURATION_S) nextTrial();
      return;
    }
    if (phase === "go") {
      const rt = performance.now() - trialStart.current;
      rtsRef.current = [...rtsRef.current, rt]; setRts(rtsRef.current);
      if (!stop.current && elapsed < DURATION_S) nextTrial(); else finish();
    }
  }, [phase, elapsed, nextTrial, finish]);

  useEffect(() => () => { stop.current = true; clearTimeout(timer.current); cancelAnimationFrame(tickId.current); }, []);
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    const onKey = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); respond(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, respond]);

  const sorted = [...rts].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : undefined;
  const lapses = rts.filter((v) => v > LAPSE_MS).length;
  const logIt = () => { if (median === undefined) return; m.logReading("reaction", Math.round(median)); setLogged(true); };

  return (
    <section className="glass panel" aria-label="Reaction time test">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="eyebrow">Reaction time · PVT, 60s</div><span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>ON-DEVICE</span>
      </div>
      <div className="legend" style={{ margin: "6px 0 8px" }}>Modeled on the structure of NASA's real PVT-B fatigue test (random wait, then react as fast as you can) — this is a 60-second abbreviated version for this project, not the validated clinical instrument. Slower reactions are an objective sign of fatigue, high cabin CO2 or cognitive overload.</div>

      {phase === "idle" && <button className="btn primary" onClick={start}>Start 60s test</button>}

      {(phase === "waiting" || phase === "go") && (
        <>
          <div
            role="button" tabIndex={0} aria-label="Tap when the box turns green"
            onPointerDown={respond}
            style={{ height: 160, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", userSelect: "none", transition: "background 60ms", background: phase === "go" ? "var(--nominal)" : "rgba(255,255,255,.06)", border: `2px solid ${phase === "go" ? "var(--nominal)" : "rgba(255,255,255,.12)"}` }}
          >
            <span className="mono" style={{ fontSize: 20, color: phase === "go" ? "#00130a" : "var(--muted)", fontWeight: 700 }}>{phase === "go" ? "TAP NOW" : "Wait…"}</span>
          </div>
          <div style={{ height: 6, borderRadius: 6, background: "rgba(255,255,255,.1)", marginTop: 8, overflow: "hidden" }}><motion.div style={{ height: "100%", background: "var(--accent)" }} animate={{ width: `${Math.min(1, elapsed / DURATION_S) * 100}%` }} transition={{ ease: "linear", duration: 0.2 }} /></div>
          <div className="legend" style={{ marginTop: 6 }}>Trials so far: {rts.length} · false starts: {falseStarts} · {Math.max(0, Math.ceil(DURATION_S - elapsed))}s left. Space bar also works.</div>
        </>
      )}

      {phase === "done" && (
        <div style={{ marginTop: 4 }}>
          {median === undefined ? <div className="legend" role="status">No completed trials. Try again and respond as soon as the box turns green.</div> : <>
            <div className="mono" style={{ fontSize: 30 }}>{median.toFixed(0)} <span style={{ fontSize: 13, color: "var(--muted)" }}>ms median · {rts.length} trials</span></div>
            <div className="legend">{lapses} lapse{lapses === 1 ? "" : "s"} (over {LAPSE_MS} ms) · {falseStarts} false start{falseStarts === 1 ? "" : "s"}. {lapses > 1 || median > 400 ? "Several slow responses — consider a break and checking cabin CO2." : "Responses were quick and consistent."}</div>
            <button className="btn primary" style={{ marginTop: 8 }} onClick={logIt} disabled={logged}>{logged ? "Logged to reaction time ✓" : "Log as reaction time"}</button>
            <button className="btn" style={{ marginTop: 8, marginLeft: 8 }} onClick={start}>Run again</button>
          </>}
        </div>
      )}
    </section>
  );
}
