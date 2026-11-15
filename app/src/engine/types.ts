export type IndicatorId =
  | "heartRate" | "systolic" | "glucose" | "temperature" | "sleep"
  | "mood" | "spo2" | "respRate" | "hrv" | "reaction";

export type Status = "nominal" | "watch" | "caution" | "critical" | "uncertain";
export const STATUS_RANK: Record<Status, number> = { uncertain: 0, nominal: 0, watch: 1, caution: 2, critical: 3 };

export type SystemId = "brain" | "heart" | "lungs" | "bones" | "muscle" | "eyes" | "gut" | "immune";
export type HazardId = "radiation" | "isolation" | "distance" | "gravity" | "closed";

export interface Reading { day: number; value: number; source: "manual" | "camera" | "sensor" | "synthetic" }

export interface IndicatorDef {
  id: IndicatorId; label: string; short: string; unit: string; system: SystemId;
  hazards: HazardId[];
  /** Earth reference band (resting adult). Prototype values, see docs/SOURCES.md. */
  earth: [number, number];
  /** Absolute safety limits that override statistics. */
  hardLow?: number; hardHigh?: number;
  /** Plausible physical range, used for synthetic data and input validation. */
  plausible: [number, number];
  decimals: number;
  higherIsWorse?: boolean; lowerIsWorse?: boolean;
  how: string[]; why: string; spaceNote: string; actions: string[];
}

export interface Interval { lo: number; hi: number; center: number; n: number; alpha: number }

export interface Assessment {
  id: IndicatorId; status: Status; value: number; z: number; interval: Interval | null;
  reasons: string[]; hardLimit: boolean;
  /** True when the band came from the person's Earth baseline because space history is still short. */
  usedPrior?: boolean;
}

export interface Pattern {
  id: string; label: string; severity: Status; confidence: number;
  drivers: IndicatorId[]; explanation: string; action: string;
}

export type Environment = "station" | "lunar" | "mars";
