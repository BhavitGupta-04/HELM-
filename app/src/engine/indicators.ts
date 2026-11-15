import type { IndicatorDef, IndicatorId } from "./types";

// PROTOTYPE thresholds. Earth reference bands are standard adult resting values;
// hard limits are conservative safety triggers. Spaceflight-specific shifts are
// handled statistically by the personal baseline, not by hand-tuned constants.
export const INDICATORS: Record<IndicatorId, IndicatorDef> = {
  heartRate: {
    id: "heartRate", label: "Resting heart rate", short: "Heart rate", unit: "bpm", system: "heart",
    hazards: ["radiation", "gravity", "isolation"], earth: [60, 100], hardLow: 40, hardHigh: 130,
    plausible: [38, 160], decimals: 0,
    how: ["Sit still for 2 minutes, strapped in or braced.", "Place two fingers on the inside of the wrist, or use the camera scan.", "Count beats for 30 s and double, or let HELM measure for you."],
    why: "Heart rate shows cardiovascular load, hydration, stress and infection earlier than most other signals.",
    spaceNote: "Fluid shifts toward the head in microgravity and the heart has less work to do against gravity, so resting rate often drifts. That is why HELM compares you to your own baseline.",
    actions: ["Hydrate and rest 10 minutes, then re-measure.", "Check for CO2 buildup or cabin temperature changes.", "If still high with fever or chest discomfort, escalate."],
  },
  systolic: {
    id: "systolic", label: "Systolic blood pressure", short: "Blood pressure", unit: "mmHg", system: "heart",
    hazards: ["gravity", "closed", "isolation"], earth: [90, 120], hardLow: 80, hardHigh: 170,
    plausible: [70, 200], decimals: 0,
    how: ["Fit the cuff snugly on the upper arm at heart level.", "Rest 5 minutes first, arm relaxed and supported.", "Take two readings 1 minute apart and enter the average."],
    why: "Blood pressure tracks cardiovascular adaptation and fluid balance.",
    spaceNote: "Without gravity pooling blood in the legs, arterial pressure regulation changes. On return to gravity, low pressure on standing is a known risk.",
    actions: ["Rest, hydrate, and avoid stimulants.", "Log with the activity you just did.", "Persistent highs or symptoms of dizziness: queue a flight surgeon review."],
  },
  glucose: {
    id: "glucose", label: "Blood glucose", short: "Glucose", unit: "mg/dL", system: "gut",
    hazards: ["isolation", "closed"], earth: [70, 110], hardLow: 54, hardHigh: 250,
    plausible: [40, 320], decimals: 0,
    how: ["Wash and dry the fingertip.", "Use a fresh lancet on the side of the fingertip.", "Apply the drop to the test strip and wait for the reading."],
    why: "Glucose reflects nutrition, stress hormones and metabolic health during long missions.",
    spaceNote: "Stress, disrupted meals and reduced activity can shift glucose handling. Food quality and quantity are limited in transit.",
    actions: ["Low: take 15 g fast carbohydrate and re-test in 15 minutes.", "High: hydrate, light activity, re-test and log meals.", "Repeated extremes: escalate."],
  },
  temperature: {
    id: "temperature", label: "Body temperature", short: "Temperature", unit: "°C", system: "immune",
    hazards: ["closed", "radiation", "isolation"], earth: [36.1, 37.3], hardLow: 35.0, hardHigh: 38.5,
    plausible: [34.5, 40.5], decimals: 1,
    how: ["Use the ear or forehead thermometer in the same spot each time.", "Wait 15 minutes after exercise.", "Take two readings and enter the average."],
    why: "A temperature rise is the earliest simple sign of infection or immune activation.",
    spaceNote: "Core temperature is often slightly higher in orbit because heat does not rise away from the body by convection. Immune changes are documented on long missions.",
    actions: ["Mild rise: hydrate, rest, re-check in 2 hours.", "Fever: isolate from crew, start the infection checklist, queue a report.", "High fever: emergency pathway."],
  },
  sleep: {
    id: "sleep", label: "Sleep last night", short: "Sleep", unit: "h", system: "brain",
    hazards: ["isolation", "closed", "distance"], earth: [7, 9], hardLow: 3, plausible: [1, 12], decimals: 1,
    how: ["Enter hours actually asleep, not time in bed.", "Use a wearable if you have one, or estimate honestly.", "Log within an hour of waking."],
    why: "Sleep loss degrades attention, mood and immune function and compounds over weeks.",
    spaceNote: "Crew sleep is commonly shorter in flight because of noise, light cycles and workload. Chronic debt is a known performance risk.",
    actions: ["Keep a fixed sleep window and dim lights 1 hour before.", "Schedule a recovery block on the next light day.", "Two nights under 5 h: reduce risky tasks."],
  },
  mood: {
    id: "mood", label: "Mood", short: "Mood", unit: "/10", system: "brain",
    hazards: ["isolation", "distance", "closed"], earth: [5, 10], hardLow: 2, plausible: [1, 10], decimals: 0,
    how: ["Pick the number that matches how you feel right now.", "10 is great, 5 is neutral, 1 is very low.", "Add a note if something is driving it."],
    why: "Isolation and confinement can affect mood. Early tracking lets the crew act before it affects work or safety.",
    spaceNote: "Long missions show a mid-mission dip in mood and motivation. Seeing the pattern early makes it manageable.",
    actions: ["Schedule a private call or message with someone at home.", "Do a crew social activity.", "Sustained low mood: queue a private behavioral health check-in."],
  },
  spo2: {
    id: "spo2", label: "Blood oxygen", short: "SpO2", unit: "%", system: "lungs",
    hazards: ["closed", "radiation"], earth: [95, 100], hardLow: 90, plausible: [80, 100], decimals: 0,
    how: ["Warm the hand, remove nail polish.", "Clip the pulse oximeter on a still finger.", "Wait until the number is stable for 10 seconds."],
    why: "Oxygen saturation drops when cabin air quality, CO2 or lung function is a problem.",
    spaceNote: "A closed habitat can accumulate CO2 or lose oxygen balance. A falling trend for the whole crew points to the environment, not the person.",
    actions: ["Move to a well-ventilated module and re-measure.", "Check CO2 and O2 levels.", "Below 92 with symptoms: emergency pathway."],
  },
  respRate: {
    id: "respRate", label: "Respiration rate", short: "Breathing", unit: "/min", system: "lungs",
    hazards: ["closed", "gravity"], earth: [12, 20], hardLow: 8, hardHigh: 30, plausible: [6, 40], decimals: 0,
    how: ["Sit still and breathe normally.", "Count one full breath as in plus out for 60 s.", "Or use the camera scan."],
    why: "Breathing rate rises early with infection, high CO2 and stress.",
    spaceNote: "Cabin CO2 and altered lung mechanics change breathing patterns. A rise with headache points to CO2.",
    actions: ["Check CO2 scrubber status.", "Slow-breathing exercise for 3 minutes.", "Rate above 25 at rest: escalate."],
  },
  hrv: {
    id: "hrv", label: "Heart rate variability", short: "HRV", unit: "ms", system: "heart",
    hazards: ["isolation", "radiation", "gravity"], earth: [30, 100], hardLow: 12, plausible: [8, 140], decimals: 0,
    how: ["Rest quietly for 2 minutes.", "Use the camera scan or a chest strap.", "Measure at the same time each day."],
    why: "HRV (RMSSD) reflects recovery and autonomic stress. Falling HRV is an early strain signal.",
    spaceNote: "Autonomic regulation shifts in microgravity. Trend matters far more than one value.",
    actions: ["Prioritize sleep and recovery.", "Do a 5-minute guided breathing session.", "Falling for 5+ days: reduce load and queue a review."],
  },
  reaction: {
    id: "reaction", label: "Reaction time", short: "Reaction", unit: "ms", system: "eyes",
    hazards: ["isolation", "closed", "distance"], earth: [200, 320], hardHigh: 600, plausible: [150, 900], decimals: 0,
    higherIsWorse: true,
    how: ["Run the 60-second reaction test.", "Sit comfortably and tap as soon as the target appears.", "HELM records the median time."],
    why: "Slower reactions are an objective sign of fatigue, high CO2 or cognitive overload.",
    spaceNote: "Fatigue and elevated CO2 both slow response time. Objective tests catch what self-reports miss.",
    actions: ["Take a 20-minute break and re-test.", "Delay safety-critical tasks if still slow.", "Check cabin CO2."],
  },
};

export const INDICATOR_LIST = Object.values(INDICATORS);
