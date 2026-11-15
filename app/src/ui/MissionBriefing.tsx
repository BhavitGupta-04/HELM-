import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onStartDemo: () => void;
}

const SEEN_KEY = "helm.briefing.seen.v1";

interface Stat { pct: string; label: string; detail: string; system: string }

const STATS: Stat[] = [
  { pct: "70%", label: "get vision damage (SANS)", detail: "NASA's own top-priority long-duration risk.", system: "Eyes & reflexes" },
  { pct: "1–1.5%", label: "bone density lost / month", detail: "Over 10x faster than severe osteoporosis on Earth.", system: "Bones" },
  { pct: "2 of 6", label: "could stand on landing day", detail: "One NASA ISS flight dataset.", system: "Heart & circulation" },
  { pct: "75–78%", label: "rely on sleep medication", detail: "10-year NASA-funded study.", system: "Brain & sleep" },
];

const WHAT_HELM_DOES = [
  "Builds each astronaut their own personal baseline — not a generic range.",
  "Detects real multi-signal patterns automatically, and gives a solution instantly.",
  "Decides onboard when Earth is minutes away — no live consult needed.",
];

/**
 * First-contact framing for a judge who only ever gets a link, not a live presenter. Opens once per browser
 * (best-effort via localStorage — never load-bearing, just a convenience), leads with documented, sourced
 * astronaut-health statistics (not a hypothetical), ties each one to the HELM system that actually tracks it,
 * names who it serves beyond the one crew on screen, and hands straight off to the Guided Demo.
 */
export function MissionBriefing({ open, onClose, onStartDemo }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) setTimeout(() => closeRef.current?.focus(), 50); }, [open]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [open, onClose]);

  return (
    <AnimatePresence>{open && (
      <motion.div className="storm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Mission briefing">
        <motion.div className="glass panel" style={{ maxWidth: 760, maxHeight: "88vh", overflowY: "auto" }} initial={{ scale: .92, y: 20 }} animate={{ scale: 1, y: 0 }}>
          <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
            <span className="eyebrow">Mission briefing</span>
            <button ref={closeRef} className="btn" onClick={onClose} aria-label="Close briefing">Skip</button>
          </div>

          <h2 style={{ fontSize: 24, margin: "10px 0 10px" }}>Every long-duration astronaut faces this — today, measured, not projected.</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, margin: "0 0 16px" }}>
            {STATS.map((s) => (
              <div key={s.label} className="glass pad" style={{ padding: 12 }}>
                <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{s.pct}</div>
                <div style={{ fontSize: 13, fontWeight: 650 }}>{s.label}</div>
                <div className="legend" style={{ margin: "4px 0 0" }}>{s.detail} · {s.system}</div>
              </div>
            ))}
          </div>

          <motion.div
            style={{ padding: "12px 16px", margin: "0 0 14px", borderRadius: 12, border: "1.5px solid var(--critical)", display: "flex", alignItems: "center", gap: 10 }}
            animate={{ background: ["color-mix(in srgb, var(--critical) 10%, transparent)", "color-mix(in srgb, var(--critical) 26%, transparent)", "color-mix(in srgb, var(--critical) 10%, transparent)"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <span aria-hidden="true" style={{ width: 13, height: 13, borderRadius: 999, background: "var(--critical)", flex: "none", boxShadow: "0 0 12px var(--critical)" }} />
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--critical)" }}>
              Unresponsive-crew detection: when nobody can press a button, HELM keeps watching on its own —
              and flashes this same light, live on the dashboard, if a crew member stops responding.
            </div>
          </motion.div>

          <div style={{ padding: "14px 16px", margin: "0 0 16px", borderRadius: 12, border: "1.5px solid var(--accent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
            <div className="eyebrow" style={{ color: "var(--accent)" }}>What HELM does about it</div>
            <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
              {WHAT_HELM_DOES.map((line) => <li key={line} style={{ fontWeight: 600, fontSize: 14.5, margin: "4px 0" }}>{line}</li>)}
            </ul>
          </div>

          <p className="legend" style={{ margin: "0 0 16px" }}>
            Why it matters: Mars is 3–22 minutes away by radio, one-way. <strong>Trust &amp; Validation</strong> runs
            the real detection check live, in this browser. Sources: <code>docs/SOURCES.md</code>.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn primary" onClick={onStartDemo}>▶ Start the 2-minute guided demo</button>
            <button className="btn" onClick={onClose}>Explore the dashboard myself</button>
          </div>
        </motion.div>
      </motion.div>
    )}</AnimatePresence>
  );
}

export function hasSeenBriefing(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}

export function markBriefingSeen(): void {
  try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* best-effort only */ }
}
