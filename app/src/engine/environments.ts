import type { Environment, HazardId, SystemId } from "./types";

export interface EnvDef {
  id: Environment; label: string; blurb: string;
  /** One-way light-time delay to Earth in seconds. */
  delayMin: number; delayMax: number; delayDefault: number;
  /** Typical absorbed-equivalent dose rate in mSv/day (published rover/ISS measurements, rounded). */
  doseRate: number; gravity: string; missionDays: number;
}

export const ENVIRONMENTS: Record<Environment, EnvDef> = {
  station: { id: "station", label: "Space Station (LEO)", blurb: "Low Earth orbit, near-live comms.",
    delayMin: 0.25, delayMax: 0.6, delayDefault: 0.5, doseRate: 0.6, gravity: "microgravity", missionDays: 180 },
  lunar: { id: "lunar", label: "Lunar Base / Artemis", blurb: "1.3 s one-way delay, harsher radiation.",
    delayMin: 1.2, delayMax: 1.4, delayDefault: 1.3, doseRate: 1.4, gravity: "1/6 g on surface", missionDays: 210 },
  mars: { id: "mars", label: "Mars Transit", blurb: "3 to 22 minutes one-way. You are your own doctor.",
    delayMin: 180, delayMax: 1320, delayDefault: 720, doseRate: 1.8, gravity: "microgravity in transit", missionDays: 900 },
};

export const CAREER_DOSE_LIMIT_MSV = 600; // NASA-STD-3001 career limit (2022 revision), see docs/SOURCES.md

export interface HazardDef { id: HazardId; label: string; short: string; systems: SystemId[]; blurb: string; color: string; nasaUrl: string; risks: string[] }

export const HAZARDS: Record<HazardId, HazardDef> = {
  radiation: { id: "radiation", label: "Space Radiation", short: "Radiation", color: "#ffb454",
    systems: ["immune", "brain", "heart", "gut"],
    blurb: "Galactic cosmic rays and solar particle events raise cancer, cardiovascular and central-nervous-system risk.",
    nasaUrl: "https://www.nasa.gov/hrp/hazard-space-radiation/", risks: ["Risk of Radiation-Induced Cancers"] },
  isolation: { id: "isolation", label: "Isolation and Confinement", short: "Isolation", color: "#b48cff",
    systems: ["brain", "immune"],
    blurb: "Small crew, no escape, monotony. Affects mood, sleep, cognition and team cohesion.",
    nasaUrl: "https://www.nasa.gov/hrp/hazard-isolation-and-confinement/", risks: ["Risk of Behavioral Changes and Psychiatric Disorders", "Risk of Inadequate Sleep and Irregular Schedules", "Risk of Inadequate Teamwork"] },
  distance: { id: "distance", label: "Distance from Earth", short: "Distance", color: "#5ec8ff",
    systems: ["brain", "gut"],
    blurb: "Delayed comms and no quick return mean the crew must diagnose and treat on its own.",
    nasaUrl: "https://www.nasa.gov/hrp/hazard-distance-from-earth/", risks: [] },
  gravity: { id: "gravity", label: "Gravity Fields", short: "Gravity", color: "#7dffb0",
    systems: ["bones", "muscle", "heart", "eyes"],
    blurb: "Bone and muscle loss, fluid shifts, vision changes and cardiovascular deconditioning.",
    nasaUrl: "https://www.nasa.gov/hrp/hazard-gravity-fields/", risks: ["Risk of Cardiovascular Adaptations", "Risk of Spaceflight-Induced Bone Changes", "Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness", "Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)", "Risk of Altered Sensorimotor and Vestibular Function"] },
  closed: { id: "closed", label: "Hostile/Closed Environments", short: "Habitat", color: "#ff6b8a",
    systems: ["lungs", "immune", "gut", "eyes"],
    blurb: "Air, water, microbes, noise and temperature all depend on life support working.",
    nasaUrl: "https://www.nasa.gov/hrp/hazard-hostile-closed-environments/", risks: ["Risk of Altered Immune System Responses", "Risk of Host-Microorganism Interactions", "Risk of Hypoxia", "Risk of Decompression Sickness", "Risk of Inadequate Food and Nutrition"] },
};
