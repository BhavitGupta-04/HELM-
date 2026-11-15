import type { Status } from "./types";

export type Route = "none" | "log" | "queue-live" | "onboard-then-queue" | "emergency";

export interface TriageDecision {
  route: Route; headline: string; rationale: string; steps: string[];
  roundTripSec: number; groundAdviceEtaSec: number | null; transmitNow: boolean;
}

/** Time for a flight surgeon to read and answer a queued report (assumption). */
export const GROUND_REVIEW_SEC = 300;
/** Round trips above this make live consults impractical. */
export const LIVE_CONSULT_MAX_RTT_SEC = 120;

export function triage(severity: Status, oneWayDelaySec: number): TriageDecision {
  const rtt = oneWayDelaySec * 2;
  const eta = rtt + GROUND_REVIEW_SEC;
  switch (severity) {
    case "critical":
      return { route: "emergency", transmitNow: true, roundTripSec: rtt, groundAdviceEtaSec: eta,
        headline: "Act now, call Earth in parallel",
        rationale: `Ground advice cannot arrive for about ${fmtDur(eta)}. Start the onboard protocol immediately and transmit the report at the same time.`,
        steps: ["Start the matching emergency protocol.", "Alert the nearest crewmate.", "Transmit the SBAR packet now.", "Re-measure every 5 minutes and log."] };
    case "caution":
      if (rtt > LIVE_CONSULT_MAX_RTT_SEC)
        return { route: "onboard-then-queue", transmitNow: true, roundTripSec: rtt, groundAdviceEtaSec: eta,
          headline: "Treat onboard first, then send the report",
          rationale: `A live consult is not possible with a ${fmtDur(rtt)} round trip. Follow the onboard steps and expect a reply in about ${fmtDur(eta)}.`,
          steps: ["Follow the recommended onboard actions.", "Transmit the SBAR packet.", "Re-measure in 30 minutes.", "Escalate to emergency if it worsens."] };
      return { route: "queue-live", transmitNow: true, roundTripSec: rtt, groundAdviceEtaSec: eta,
        headline: "Request a live flight surgeon consult",
        rationale: "The link is fast enough for a live conversation. Send the report and open a voice call.",
        steps: ["Transmit the SBAR packet.", "Open a live consult.", "Follow instructions from the flight surgeon."] };
    case "watch":
      return { route: "log", transmitNow: false, roundTripSec: rtt, groundAdviceEtaSec: null,
        headline: "Log it and re-check",
        rationale: "This is a deviation worth tracking but not worth interrupting anyone yet. It will be included in the next routine report.",
        steps: ["Re-measure in 12 hours.", "Follow the suggested actions.", "It auto-escalates if it persists."] };
    default:
      return { route: "none", transmitNow: false, roundTripSec: rtt, groundAdviceEtaSec: null,
        headline: "All clear", rationale: "No action needed.", steps: [] };
  }
}

export function fmtDur(sec: number): string {
  if (sec < 1) return `${Math.round(sec * 1000)} ms`;
  if (sec < 90) return `${Math.round(sec)} s`;
  if (sec < 5400) return `${Math.round(sec / 60)} min`;
  return `${(sec / 3600).toFixed(1)} h`;
}
