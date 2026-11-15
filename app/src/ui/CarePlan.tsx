import { CARE_PROTOCOLS, type SystemId } from "../engine";
import type { Mission } from "./state";

const ALL_SYSTEMS: SystemId[] = ["brain", "heart", "lungs", "bones", "muscle", "eyes", "gut", "immune"];
const SYSTEM_LABEL: Record<SystemId, string> = {
  brain: "Brain & sleep", heart: "Heart & circulation", lungs: "Lungs & air", bones: "Bones",
  muscle: "Muscle", eyes: "Eyes & reflexes", gut: "Metabolism", immune: "Immune system",
};

export function CarePlan({ m, extraFlags }: { m: Mission; extraFlags: SystemId[] }) {
  const flagged = ALL_SYSTEMS.filter((s) => m.systemStatus[s] !== "nominal" || extraFlags.includes(s));
  const live = flagged.length > 0;
  return (
    <section
      className="glass pad"
      style={live ? { borderColor: "color-mix(in srgb, var(--caution) 60%, transparent)", boxShadow: "0 0 24px -8px var(--caution)", background: "color-mix(in srgb, var(--caution) 6%, var(--panel, rgba(255,255,255,.03)))" } : undefined}
    >
      <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="eyebrow">Personalized care plan</div>
        {live && <span className="pill s-caution">{flagged.length} flagged</span>}
      </div>
      {flagged.length === 0 ? (
        <p className="sbar" style={{ margin: "6px 0 0" }}>All systems nominal — maintain the standard routine: ~2.5h/day resistive + aerobic exercise, steady hydration, calcium/vitamin D.</p>
      ) : (
        flagged.map((s) => {
          const p = CARE_PROTOCOLS[s];
          return (
            <div key={s} style={{ margin: "10px 0 0", paddingTop: 10, borderTop: "1px solid var(--glass-b)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--caution)" }}>{SYSTEM_LABEL[s]} <span style={{ color: "var(--ink)", fontWeight: 600 }}>— {p.title}</span></div>
              <div className="legend" style={{ margin: "4px 0 6px" }}>{p.why}</div>
              <div className="sbar"><b style={{ color: "var(--accent)" }}>Exercise:</b><ul style={{ margin: "4px 0 6px 18px" }}>{p.exercise.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
              <div className="sbar"><b style={{ color: "var(--accent)" }}>Diet:</b><ul style={{ margin: "4px 0 6px 18px" }}>{p.diet.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
              <div className="legend">Source: {p.source}</div>
            </div>
          );
        })
      )}
    </section>
  );
}
