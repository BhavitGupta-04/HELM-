import { useState } from "react";
import { EVENT_LABELS, analyzeSymptoms, type SymptomAnalysis, type SystemId } from "../engine";
import type { Mission } from "./state";

export function SymptomChecker({ m, onSystemFlag, onClearFlags }: { m: Mission; onSystemFlag: (systems: SystemId[]) => void; onClearFlags: () => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<SymptomAnalysis | null>(null);

  const run = () => {
    if (!text.trim()) return;
    const r = analyzeSymptoms(text);
    for (const match of r.matches) m.inject(match.kind, match.severity);
    if (r.systemFlags.length) onSystemFlag(r.systemFlags.map((f) => f.system));
    setResult(r);
  };

  const clear = () => { setText(""); setResult(null); onClearFlags(); m.clearEvents(); };
  const found = !!result && (result.matches.length > 0 || result.systemFlags.length > 0);

  return (
    <section className="glass pad" style={found ? { borderColor: "color-mix(in srgb, var(--accent) 55%, transparent)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)" } : undefined}>
      <div className="eyebrow">Symptom check</div>
      <p className="legend" style={{ margin: "4px 0 8px" }}>Describe what you're feeling — HELM matches it to a real pattern and updates the simulation below.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. I have a fever and my heart feels like it's racing"
        rows={2}
        style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid var(--glass-b)", borderRadius: 10, color: "var(--ink)", padding: "10px 12px", font: "inherit", resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn primary" onClick={run}>Analyze</button>
        <button className="btn" onClick={clear}>Clear</button>
      </div>
      {result && (
        <div style={{ marginTop: 10 }}>
          {result.unrecognized && (
            <p className="sbar">No modeled pattern matched — nothing was changed. HELM doesn't guess.</p>
          )}
          {result.matches.map((mt) => (
            <div key={mt.kind} className="pill s-watch" style={{ margin: "0 6px 6px 0", textTransform: "none", letterSpacing: 0 }}>
              {mt.phrases[0]} → {EVENT_LABELS[mt.kind]} ({mt.severity})
            </div>
          ))}
          {result.systemFlags.map((sf) => (
            <div key={sf.system} className="pill s-caution" style={{ margin: "0 6px 6px 0", textTransform: "none", letterSpacing: 0 }}>
              {sf.phrases[0]} → added to care plan
            </div>
          ))}
          {found && <p className="sbar" style={{ margin: "4px 0 0", fontWeight: 650, color: "var(--accent)" }}>↓ Your updated care plan is right below.</p>}
        </div>
      )}
    </section>
  );
}
