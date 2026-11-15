import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { INDICATORS, type Assessment, type IndicatorId, type Reading } from "../engine";
import { AnimatedNumber } from "./AnimatedNumber";
import { Sparkline, type Band } from "./Sparkline";
import { STATUS_COLOR } from "./state";

interface Props { id: IndicatorId; a: Assessment; series: Reading[]; day: number; bands: (Band | null)[]; reference?: number; onLog: (v: number) => void }

const SOURCE_HINT: Partial<Record<IndicatorId, string>> = {
  heartRate: "Measure with the Camera pulse panel, or type your own count.",
  systolic: "Enter by hand from a cuff. A camera cannot measure blood pressure.",
  glucose: "Enter by hand from a meter. A camera cannot measure glucose.",
  reaction: "Run the 60-second reaction test panel below instead of typing a guess.",
};

export function IndicatorCard({ id, a, series, day, bands, reference, onLog }: Props) {
  const def = INDICATORS[id];
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const col = STATUS_COLOR[a.status];
  const start = Math.max(0, day - 29);
  const vals = series.slice(start, day + 1).map((r) => r.value);
  const submit = () => { const v = parseFloat(txt); if (Number.isFinite(v) && v >= def.plausible[0] && v <= def.plausible[1]) { onLog(v); setTxt(""); } };
  const invalid = txt !== "" && !(parseFloat(txt) >= def.plausible[0] && parseFloat(txt) <= def.plausible[1]);
  return (
    <motion.article layout className="card" style={{ ["--c" as any]: col }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>
      <div className="row">
        <div><div className="eyebrow">{def.label}</div>
          <div style={{ marginTop: 8 }}><span className="val"><AnimatedNumber value={a.value} decimals={def.decimals} /></span><span className="unit">{def.unit}</span></div></div>
        <span className={`pill s-${a.status}`}>{a.status}</span>
      </div>
      <div style={{ margin: "10px 0 2px" }}><Sparkline values={vals} bands={bands} earth={def.earth} reference={reference} color={col} markIndex={vals.length - 1} /></div>
      <div className="legend">Shaded band = your personal range · faint dashed = typical Earth range{reference !== undefined && <span style={{ color: "var(--watch)" }}> · gold dashed = your Earth baseline ({reference})</span>}</div>
      <p className="reason">{a.reasons.join(" ")}</p>
      {a.status !== "nominal" && def.actions[0] && (
        <div className="sbar" style={{ margin: "6px 0 0", padding: "6px 10px", borderRadius: 10, border: `1px solid ${col}55`, background: `${col}14`, color: "var(--ink)" }}>
          <strong style={{ color: col }}>Do this: </strong>{def.actions[0]}
        </div>
      )}
      {SOURCE_HINT[id] && <div className="legend">{SOURCE_HINT[id]}</div>}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide guide" : "How, why, what to do"}</button>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="number" step="any" inputMode="decimal" placeholder={`${def.unit}`} value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} aria-label={`Log a new ${def.label} value`} aria-invalid={invalid} style={invalid ? { borderColor: "var(--critical)" } : undefined} />
          <button className="btn primary" onClick={submit} disabled={invalid || txt === ""}>Log</button>
        </span>
      </div>
      <AnimatePresence initial={false}>{open && (
        <motion.div className="details" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
          <h4>How to measure</h4><ol>{def.how.map((s) => <li key={s}>{s}</li>)}</ol>
          <h4>Why it matters</h4><p style={{ margin: 0, color: "var(--muted)" }}>{def.why}</p>
          <h4>In space</h4><p style={{ margin: 0, color: "var(--muted)" }}>{def.spaceNote}</p>
          <h4>What to do</h4><ul>{def.actions.map((s) => <li key={s}>{s}</li>)}</ul>
        </motion.div>)}</AnimatePresence>
    </motion.article>
  );
}
