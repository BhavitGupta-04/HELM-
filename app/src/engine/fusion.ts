import type { Assessment, IndicatorId, Pattern, Status } from "./types";

interface Rule {
  id: string; label: string; drivers: [IndicatorId, 1 | -1][]; minDrivers: number;
  explanation: string; action: string; severity: Status;
  /** A signal that must be firing for the pattern to count (keeps patterns specific). */
  required?: IndicatorId;
}

const RULES: Rule[] = [
  { id: "infection", label: "Possible infection or immune activation", severity: "caution", minDrivers: 2,
    drivers: [["temperature", 1], ["heartRate", 1], ["respRate", 1], ["hrv", -1]],
    explanation: "Temperature, heart rate and breathing rise together, a common early infection signature, and spaceflight is known to alter immune function.",
    action: "Isolate from crewmates, hydrate, start the infection checklist and queue a report for the flight surgeon." },
  { id: "cabin-air", label: "Cabin air quality suspect", severity: "caution", minDrivers: 3,
    drivers: [["reaction", 1], ["respRate", 1], ["spo2", -1], ["heartRate", 1]],
    explanation: "Slower reactions, faster breathing and lower oxygen saturation together suggest the environment (CO2 or O2), not just you.",
    action: "Check CO2 and O2 sensors now. If you are in a closed module, move to a ventilated one and ask crewmates how they feel." },
  { id: "isolation-strain", label: "Isolation and fatigue strain", severity: "watch", minDrivers: 3,
    drivers: [["sleep", -1], ["mood", -1], ["hrv", -1], ["reaction", 1]],
    explanation: "Short sleep, low mood and low HRV together are the classic early burnout pattern on long missions.",
    action: "Protect a sleep window, schedule a private call with home, and reduce non-essential load for 48 hours." },
  { id: "cardio-strain", label: "Cardiovascular strain", severity: "caution", minDrivers: 2, required: "systolic",
    drivers: [["heartRate", 1], ["systolic", 1], ["hrv", -1]],
    explanation: "Higher heart rate and pressure with falling HRV indicate the cardiovascular system is under load.",
    action: "Rest and hydrate, avoid heavy exercise, re-measure in 30 minutes, and queue a review if it persists." },
  { id: "metabolic", label: "Metabolic stress", severity: "watch", minDrivers: 2,
    drivers: [["glucose", 1], ["sleep", -1], ["mood", -1]],
    explanation: "High glucose with poor sleep and low mood often reflects stress hormones and disrupted routine.",
    action: "Regularize meals, add light activity, and re-test glucose fasting tomorrow." },
];

export function detectPatterns(a: Partial<Record<IndicatorId, Assessment>>): Pattern[] {
  const out: Pattern[] = [];
  for (const r of RULES) {
    const firing: IndicatorId[] = [];
    let strength = 0;
    for (const [id, sign] of r.drivers) {
      const x = a[id];
      if (!x) continue;
      const signed = x.z * sign;
      // a driver only counts when it moved in the direction this pattern expects
      if (signed >= 2.0) {
        firing.push(id); strength += Math.min(Math.max(signed, 0) / 3, 1);
      }
    }
    if (firing.length >= r.minDrivers && (!r.required || firing.includes(r.required))) {
      const conf = Math.min(1, (strength / r.drivers.length) * 1.2 + 0.2 * (firing.length / r.drivers.length));
      const sev: Status = firing.length === r.drivers.length && r.severity === "watch" ? "caution" : r.severity;
      out.push({ id: r.id, label: r.label, severity: sev, confidence: Math.round(conf * 100) / 100,
        drivers: firing, explanation: r.explanation, action: r.action });
    }
  }
  return out.sort((x, y) => y.confidence - x.confidence);
}
