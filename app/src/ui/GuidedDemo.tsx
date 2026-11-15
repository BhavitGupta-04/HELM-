import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Mission } from "./state";

/**
 * A guided walkthrough that drives the real mission engine underneath, step by step, with a caption explaining
 * what to look at. Nothing here is a separate slideshow: every step calls the same Mission functions the manual
 * controls (Chaos Director, the day slider) call, so when it's dismissed the dashboard shows the real outcome of
 * what was narrated. Built because judges only get a link, not someone standing next to them explaining it.
 */
interface Step { caption: string; sub: string; run?: (m: Mission) => void }
const STEPS: Step[] = [
  { caption: "HELM — a health copilot for crews Earth can't reach in real time.", sub: "This two-minute walkthrough drives the real engine underneath, not a slideshow. Click Next when you're ready." },
  { caption: "We're on a transit to Mars: 3 to 22 minutes one-way radio delay.", sub: "Earth cannot just \"be on call\" at that distance — decisions have to happen onboard.", run: (m) => m.changeEnv("mars") },
  { caption: "Day 44. Every reading is compared against this crew member's own resting range, not a generic chart.", sub: "Look at the cards in the middle column — the shaded band is personal, the dashed line is a typical Earth range." },
  { caption: "Now we'll simulate a developing cardiovascular strain.", sub: "Rising heart rate and blood pressure, falling heart-rate variability — a real early-warning combination.", run: (m) => m.inject("cardio-strain", "moderate") },
  { caption: "Jumping forward 6 days.", sub: "HELM doesn't act on one bad reading. It waits for a pattern across several signals, over time.", run: (m) => m.jump(50) },
  { caption: "There — a detected pattern, not just a red number.", sub: "Switch to the \"Heart & circulation\" system on the left to see it: a confidence score, plain-language reasoning, and a recommended action." },
  { caption: "Because Earth is minutes away, HELM decides for itself whether to wait for a live consult or act now.", sub: "See the Triage panel in the right column — it factors in the actual communication delay for this environment." },
  { caption: "Every reading and decision is sealed in a tamper-evident hash chain.", sub: "See Black Box in the right column. Change one entry and every later hash breaks — nothing can be quietly edited afterward." },
  { caption: "Vitals need no extra hardware.", sub: "Heart rate comes from the laptop camera (Camera pulse panel) and reaction time from a built-in test — both honestly scored for confidence instead of faking a number." },
  { caption: "Everything you just saw is checked against simulated missions, live.", sub: "Open Trust & Validation and press \"Run validation now\" — it runs the same check the automated test suite runs, in your browser, right now." },
];

export function GuidedDemo({ m, open, onClose, onOpenTrust }: { m: Mission; open: boolean; onClose: () => void; onOpenTrust: () => void }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  const ran = useRef(new Set<number>());
  useEffect(() => { if (open) { setI(0); ran.current = new Set(); } }, [open]);
  useEffect(() => {
    if (!open || ran.current.has(i)) return;
    ran.current.add(i);
    STEPS[i].run?.(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i]);
  useEffect(() => {
    if (!open || !auto || i >= STEPS.length - 1) return;
    const t = setTimeout(() => setI((n) => Math.min(STEPS.length - 1, n + 1)), 7000);
    return () => clearTimeout(t);
  }, [open, auto, i]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") setI((n) => Math.min(STEPS.length - 1, n + 1)); if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1)); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [open, onClose]);

  const step = STEPS[i], last = i === STEPS.length - 1;
  return (
    <AnimatePresence>{open && (
      <motion.div className="storm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Guided demo">
        <motion.div className="glass panel" style={{ maxWidth: 640 }} initial={{ scale: .92, y: 20 }} animate={{ scale: 1, y: 0 }}>
          <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow">Guided demo · step {i + 1} of {STEPS.length}</span>
            <button className="btn" onClick={onClose} aria-label="Close guided demo">Exit</button>
          </div>
          <h3 style={{ fontSize: 22, margin: "12px 0 6px" }}>{step.caption}</h3>
          <p className="sbar" style={{ margin: 0 }}>{step.sub}</p>
          {last && <button className="btn primary" style={{ marginTop: 14 }} onClick={onOpenTrust}>Open Trust &amp; Validation</button>}
          <div style={{ display: "flex", gap: 6, margin: "16px 0 6px" }}>{STEPS.map((_, k) => <span key={k} style={{ height: 5, flex: 1, borderRadius: 3, background: k <= i ? "var(--accent)" : "rgba(255,255,255,.14)" }} />)}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>Back</button>
              <button className="btn primary" onClick={() => (last ? onClose() : setI((n) => Math.min(STEPS.length - 1, n + 1)))}>{last ? "Finish" : "Next"}</button>
            </div>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--muted)" }}><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-advance every 7s</label>
          </div>
        </motion.div>
      </motion.div>
    )}</AnimatePresence>
  );
}
