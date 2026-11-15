import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  MAX_TEXT, NUMERIC_FIELDS, PASSPORT_LIMITS, TEXT_FIELDS, sanitizePassport, type Fitness, type NumericField, type Passport,
} from "../engine";

const LABELS: Record<NumericField, { label: string; unit: string; hint: string }> = {
  age: { label: "Age", unit: "years", hint: "" },
  heightCm: { label: "Height", unit: "cm", hint: "" },
  weightKg: { label: "Weight", unit: "kg", hint: "" },
  restingHr: { label: "Usual resting heart rate", unit: "bpm", hint: "Check it first thing in the morning on Earth." },
  systolic: { label: "Usual systolic blood pressure", unit: "mmHg", hint: "The top number." },
  sleepHours: { label: "Usual sleep", unit: "hours", hint: "Hours actually asleep." },
  temperature: { label: "Usual body temperature", unit: "°C", hint: "" },
  glucose: { label: "Usual fasting blood sugar", unit: "mg/dL", hint: "From a past checkup, if you have one." },
  spo2: { label: "Usual blood oxygen", unit: "%", hint: "" },
};
const TEXT_LABELS = {
  conditions: "Health conditions", medications: "Medicines", allergies: "Allergies",
} as const;
const FITNESS: { id: Fitness; label: string }[] = [{ id: "low", label: "Low" }, { id: "average", label: "Average" }, { id: "high", label: "High" }, { id: "athlete", label: "Athlete" }];

type Draft = { nums: Record<NumericField, string>; fitness?: Fitness; texts: Record<(typeof TEXT_FIELDS)[number], string>; include: boolean };

const toDraft = (p: Passport): Draft => ({
  nums: Object.fromEntries(NUMERIC_FIELDS.map((k) => [k, p[k] !== undefined ? String(p[k]) : ""])) as Draft["nums"],
  fitness: p.fitness,
  texts: Object.fromEntries(TEXT_FIELDS.map((k) => [k, p[k] ?? ""])) as Draft["texts"],
  include: !!p.includeNotesInReport,
});

function errorFor(k: NumericField, v: string): string | null {
  if (v.trim() === "") return null;
  const n = Number(v); const [lo, hi] = PASSPORT_LIMITS[k];
  return Number.isFinite(n) && n >= lo && n <= hi ? null : `Enter a value from ${lo} to ${hi}, or leave it blank.`;
}

interface Props { open: boolean; profile: Passport; onSave: (p: Passport) => void; onClear: () => void; onClose: () => void }

export function PassportDrawer({ open, profile, onSave, onClear, onClose }: Props) {
  const [d, setD] = useState<Draft>(() => toDraft(profile));
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setD(toDraft(profile)); setNote(""); setConfirmDelete(false); setTimeout(() => closeRef.current?.focus(), 50); } }, [open, profile]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [open, onClose]);

  const errors = Object.fromEntries(NUMERIC_FIELDS.map((k) => [k, errorFor(k, d.nums[k])])) as Record<NumericField, string | null>;
  const hasError = NUMERIC_FIELDS.some((k) => errors[k]);
  const build = (): Passport => sanitizePassport({
    ...Object.fromEntries(NUMERIC_FIELDS.filter((k) => d.nums[k].trim() !== "").map((k) => [k, Number(d.nums[k])])),
    fitness: d.fitness, ...d.texts, includeNotesInReport: d.include,
  });
  const save = () => { if (hasError) return; onSave(build()); setNote("Saved on this device."); };
  const exportIt = () => {
    const blob = new Blob([JSON.stringify(build(), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "helm-earth-baseline.json"; a.click(); URL.revokeObjectURL(a.href);
  };
  const importIt = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (f.size > 20000) throw new Error("big");
      const p = sanitizePassport(JSON.parse(await f.text()));
      setD(toDraft(p)); setNote("Imported. Review the values, then press Save.");
    } catch { setNote("That file could not be read as a HELM baseline."); }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <AnimatePresence>{open && (
      <>
        <motion.div className="overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true" />
        <motion.aside className="drawer glass" role="dialog" aria-modal="true" aria-label="Earth Baseline Passport"
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
          <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
            <div><div className="eyebrow">Optional · stays on this device</div><h2 style={{ fontSize: 22, marginTop: 4 }}>Earth Baseline Passport</h2></div>
            <button ref={closeRef} className="btn" onClick={onClose} aria-label="Close passport">Close</button>
          </div>
          <p className="sbar" style={{ margin: "10px 0 14px" }}>
            Tell HELM what is normal for you on Earth so it can start personalized on day one. Skip anything you like. HELM works without it, and your space readings replace this baseline as it learns you.
          </p>

          <h3 className="eyebrow" style={{ margin: "6px 0" }}>About you</h3>
          <div className="fgrid">
            {(["age", "heightCm", "weightKg"] as NumericField[]).map((k) => <Field key={k} k={k} d={d} setD={setD} err={errors[k]} />)}
            <div className="field"><span>Fitness level</span>
              <div className="seg" role="group" aria-label="Fitness level">{FITNESS.map((f) => <button key={f.id} aria-pressed={d.fitness === f.id} onClick={() => setD({ ...d, fitness: d.fitness === f.id ? undefined : f.id })}>{f.label}</button>)}</div>
              <small>Used for a starting heart-rate range when you do not know your own.</small></div>
          </div>

          <h3 className="eyebrow" style={{ margin: "14px 0 6px" }}>Your usual numbers on Earth</h3>
          <div className="fgrid">{(["restingHr", "systolic", "sleepHours", "temperature", "glucose", "spo2"] as NumericField[]).map((k) => <Field key={k} k={k} d={d} setD={setD} err={errors[k]} />)}</div>

          <h3 className="eyebrow" style={{ margin: "14px 0 6px" }}>Notes for the flight surgeon</h3>
          <p className="legend" style={{ margin: "0 0 8px" }}>These do not change HELM's thresholds. They are only added to the medical report, and only if you tick the box below.</p>
          {TEXT_FIELDS.map((k) => (
            <label key={k} className="field" style={{ display: "block" }}><span>{TEXT_LABELS[k]}</span>
              <textarea rows={2} maxLength={MAX_TEXT} value={d.texts[k]} onChange={(e) => setD({ ...d, texts: { ...d.texts, [k]: e.target.value } })} aria-label={TEXT_LABELS[k]} /></label>))}
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, margin: "8px 0" }}>
            <input type="checkbox" checked={d.include} onChange={(e) => setD({ ...d, include: e.target.checked })} /> Include these notes in the flight surgeon report</label>

          <p className="legend" style={{ margin: "10px 0" }}>Self-entered, never verified, and never sent anywhere by HELM. Export it to keep a copy.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn primary" onClick={save} disabled={hasError}>Save</button>
            <button className="btn" onClick={exportIt}>Export</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>Import</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => importIt(e.target.files?.[0])} aria-label="Import a HELM baseline file" />
            {!confirmDelete ? <button className="btn danger" onClick={() => setConfirmDelete(true)}>Delete</button>
              : <button className="btn danger" onClick={() => { onClear(); setD(toDraft({})); setConfirmDelete(false); setNote("Deleted from this device."); }}>Really delete everything?</button>}
          </div>
          <p role="status" className="mono" style={{ fontSize: 12, color: "var(--accent)", minHeight: 18, marginTop: 8 }}>{note}</p>
        </motion.aside></>)}</AnimatePresence>
  );
}

function Field({ k, d, setD, err }: { k: NumericField; d: Draft; setD: (d: Draft) => void; err: string | null }) {
  const m = LABELS[k]; const [lo, hi] = PASSPORT_LIMITS[k];
  return (
    <label className="field"><span>{m.label} <em>{m.unit}</em></span>
      <input type="number" inputMode="decimal" step="any" min={lo} max={hi} value={d.nums[k]} placeholder={`${lo}–${hi}`}
        onChange={(e) => setD({ ...d, nums: { ...d.nums, [k]: e.target.value } })} aria-invalid={!!err} style={err ? { borderColor: "var(--critical)" } : undefined} />
      {err ? <small style={{ color: "var(--critical)" }}>{err}</small> : m.hint ? <small>{m.hint}</small> : null}</label>
  );
}
