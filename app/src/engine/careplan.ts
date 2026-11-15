import type { SystemId } from "./types";

export interface CareProtocol { title: string; why: string; exercise: string[]; diet: string[]; source: string }

/**
 * NASA-sourced countermeasure protocols, one per tracked system. These are NASA's own published
 * general countermeasures (exercise hardware schedules, nutrition findings), not an individualized
 * medical or dietary prescription — where the evidence for a diet-level countermeasure is thin or
 * unsettled (eyes, lungs), the entry says so rather than inventing one. See docs/SOURCES.md.
 */
export const CARE_PROTOCOLS: Record<SystemId, CareProtocol> = {
  bones: {
    title: "Bone density protocol",
    why: "Bone mineral density falls 1-1.5% per month at weight-bearing sites without a countermeasure, and ISS crew still lose 2-7% BMD over a 180-day mission even with the standard exercise load.",
    exercise: [
      "Resistive exercise (ARED-style loaded squats, deadlifts, heel raises) — NASA schedules ISS crew 1.5h/day, 6 days/week specifically for this.",
      "Paired with roughly 1h/day aerobic exercise (treadmill or cycle) on the same 6-day schedule.",
    ],
    diet: [
      "Calcium + vitamin D: vitamin D can't be made without UV exposure in a shielded craft, so NASA provides it as a ~400 IU/day supplement; calcium absorption itself drops in spaceflight.",
      "Higher fruit/vegetable intake with a lower ratio of animal protein to potassium, alongside adequate calcium — NASA's Pro K study found this combination reduced bone mineral loss.",
      "Omega-3-rich fish: associated with reduced post-flight bone mineral density loss in NASA's long-duration Nutrition study.",
    ],
    source: "NASA JSC \"Human Adaptation to Spaceflight: Food & Nutrition\" (2021); NASA Pro K & Nutrition studies; NASA exercise countermeasure operations",
  },
  muscle: {
    title: "Muscle maintenance protocol",
    why: "Muscle strength can drop 11-17% and muscular endurance about 10% after a 180-day mission, even under the standard countermeasure exercise load.",
    exercise: [
      "The same resistive-exercise block used for bone — it's the single countermeasure NASA relies on for both.",
      "Total weekly exercise volume matters: NASA's SPRINT study found a higher-intensity, lower-volume protocol performed comparably, but cutting volume too far under-protects both muscle and bone.",
    ],
    diet: [
      "Adequate total energy (calorie) intake — NASA data link under-eating in flight to faster muscle and bone loss, and crew consistently take in less energy than they need.",
      "Sufficient but not excessive protein — NASA notes too much or too little protein can each work against bone health, so protein should complement the calcium/vitamin D plan, not replace it.",
    ],
    source: "NASA SPRINT / ISS exercise countermeasure study (npj Microgravity); NASA JSC nutrition & energy-balance findings",
  },
  heart: {
    title: "Cardiovascular reconditioning protocol",
    why: "Without gravity pulling blood downward, the cardiovascular reflex that keeps blood pressure stable on standing can weaken — in one NASA flight dataset, only 2 of 6 astronauts coming off a long ISS mission could complete a standard standing-tolerance test at all.",
    exercise: [
      "Aerobic exercise (treadmill/cycle) is NASA's primary countermeasure for cardiovascular deconditioning, done alongside the resistive block.",
      "Fluid loading (extra fluids and salt) is a real NASA pre-landing protocol used specifically to counter orthostatic intolerance.",
    ],
    diet: [
      "Short-term extra fluid and sodium intake around high-G events (launch/landing), under flight-surgeon guidance — not a standing daily habit.",
      "Steady hydration day-to-day otherwise; dehydration compounds the orthostatic risk HELM is already flagging.",
    ],
    source: "NASA cardiovascular countermeasure literature; orthostatic intolerance / fluid-loading protocols",
  },
  brain: {
    title: "Sleep & cognition protocol",
    why: "75-78% of ISS/Shuttle crew have used sleep medication in flight, averaging under 6 of a scheduled 8.5 hours — one of the best-documented problems in spaceflight.",
    exercise: [
      "Daytime exercise (already scheduled for bone/muscle) also improves sleep quality, which is part of why NASA keeps the exercise block fixed even on light-duty days.",
    ],
    diet: [
      "Keep caffeine earlier in the crew day; consistent meal timing helps anchor circadian rhythm when there's no natural day/night cycle.",
      "Consistent sleep-period lighting supports melatonin timing the way NASA's own light-schedule countermeasures do — this is also why HELM's red night mode exists.",
    ],
    source: "Barger et al. 2014, The Lancet Neurology (NASA/NSBRI-funded 10-year sleep study)",
  },
  eyes: {
    title: "SANS / fluid-shift protocol",
    why: "About 70% of long-duration crew show signs of SANS, driven by headward fluid shifts in microgravity — NASA's own highest-priority ocular risk.",
    exercise: [
      "NASA uses lower-body negative pressure (LBNP, e.g. the \"Chibis\" device) to pull fluid back toward the legs — an active countermeasure device, not a home exercise.",
    ],
    diet: [
      "Sodium intake is being studied as a lever on fluid shifting, but NASA has not published a settled dietary protocol for SANS specifically — HELM won't invent one here.",
    ],
    source: "NASA JSC SANS briefing (Brunstetter); NASA fluid-shift / LBNP countermeasure research",
  },
  lungs: {
    title: "Respiratory / cabin-air protocol",
    why: "In a closed habitat, cabin CO2 runs higher than Earth-normal by design — HELM's cabin-air pattern is built around that baseline.",
    exercise: [
      "General aerobic conditioning improves tolerance to the mildly elevated CO2 baseline common in closed habitats.",
    ],
    diet: [
      "No specific NASA dietary countermeasure exists for cabin air quality — the real fix is ventilation/scrubber maintenance, which diet and exercise can't substitute for.",
    ],
    source: "NASA cabin environmental control background",
  },
  gut: {
    title: "Metabolic / gut protocol",
    why: "Spaceflight shifts glucose handling and gut-microbiome behavior, linked to diet, stress and reduced activity.",
    exercise: [
      "The same resistive + aerobic block that protects bone and muscle also improves insulin sensitivity.",
    ],
    diet: [
      "NASA's ongoing Food Physiology investigation uses an enhanced diet (more flavonoids, lycopene, omega-3s) and has shown measurable gut-microbiome and immune benefits over the standard spaceflight menu.",
    ],
    source: "NASA Food Physiology investigation (ISS, ongoing)",
  },
  immune: {
    title: "Immune support protocol",
    why: "Spaceflight measurably changes immune function; HELM treats a temperature rise as the simplest early warning sign.",
    exercise: [
      "Consistent, moderate exercise (not overtraining) supports immune function in NASA's own studies pairing exercise and nutrition countermeasures.",
    ],
    diet: [
      "An antioxidant-rich diet is called out in NASA nutrition literature as a low-side-effect countermeasure against the oxidative stress spaceflight causes.",
      "The same enhanced diet from NASA's Food Physiology study (more flavonoids, lycopene, omega-3s) showed a measurable immune-function benefit over the standard menu.",
    ],
    source: "NASA nutrition countermeasure literature; NASA Food Physiology investigation",
  },
};
