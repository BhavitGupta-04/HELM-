import type { EventKind } from "./synth";
import type { SystemId } from "./types";

export type SymptomSeverity = "mild" | "moderate" | "severe";

export interface SymptomMatch { kind: EventKind; severity: SymptomSeverity; phrases: string[] }
export interface SystemFlag { system: SystemId; phrases: string[] }
export interface SymptomAnalysis { matches: SymptomMatch[]; systemFlags: SystemFlag[]; unrecognized: boolean }

/**
 * Keyword -> mission event, grounded in the exact physiological effects synth.ts already models for
 * each EventKind (see EFFECT in synth.ts). This is a deterministic keyword match, not a generative
 * guess: every match is shown to the user along with which words triggered it, and unmatched text is
 * reported as unmatched rather than silently forced into the nearest category.
 */
const EVENT_KEYWORDS: Record<EventKind, string[]> = {
  infection: ["fever", "feverish", "chills", "chill", "hot and cold", "sweating", "sweats", "sore throat", "cough", "coughing", "infection", "achy", "aches", "body ache", "flu-like", "flu like"],
  "cabin-co2": ["headache", "head ache", "foggy", "brain fog", "can't focus", "cant focus", "lightheaded", "light headed", "short of breath", "breathless", "stuffy air", "stale air", "hard to breathe", "trouble breathing"],
  "solar-storm": ["radiation exposure", "solar flare", "solar particle", "exposed to radiation"],
  "sleep-crisis": ["can't sleep", "cant sleep", "insomnia", "no sleep", "didn't sleep", "didnt sleep", "exhausted", "sleepless", "restless night", "haven't slept", "havent slept", "can't fall asleep"],
  "mood-dip": ["sad", "feeling down", "depressed", "lonely", "isolated", "irritable", "anxious", "stressed out", "low mood", "unmotivated", "hopeless"],
  "cardio-strain": ["racing heart", "heart racing", "heart is racing", "heart pounding", "palpitations", "chest tightness", "chest pain", "dizzy when i stand", "dizzy standing", "heart is beating fast", "heart beating fast"],
};

/** Systems tracked only through the Ghost Self forecast, not a live indicator (see synth.ts / state.ts).
 *  There is no mission event to inject for these, so a match here flags the system directly for the
 *  Personalized Care Plan instead of changing the simulation. */
const SYSTEM_ONLY_KEYWORDS: Record<"bones" | "muscle", string[]> = {
  bones: ["bone pain", "bones ache", "bone ache", "joint pain", "brittle bones", "bone density", "my bones hurt", "bones hurt"],
  muscle: ["muscle weak", "weak muscles", "muscle loss", "muscle soreness", "muscle pain", "losing muscle", "muscles feel weak", "muscle fatigue"],
};

const SEVERE_WORDS = ["severe", "unbearable", "extreme", "extremely", "really bad", "can't stand", "cant stand", "excruciating", "awful", "intense", "very bad"];
const MILD_WORDS = ["mild", "slight", "a little", "a bit", "minor", "faint", "barely", "slightly"];

function detectSeverity(t: string): SymptomSeverity {
  if (SEVERE_WORDS.some((w) => t.includes(w))) return "severe";
  if (MILD_WORDS.some((w) => t.includes(w))) return "mild";
  return "moderate";
}

export function analyzeSymptoms(text: string): SymptomAnalysis {
  const t = text.toLowerCase();
  const severity = detectSeverity(t);
  const matches: SymptomMatch[] = [];
  for (const kind of Object.keys(EVENT_KEYWORDS) as EventKind[]) {
    const hit = EVENT_KEYWORDS[kind].filter((kw) => t.includes(kw));
    if (hit.length) matches.push({ kind, severity, phrases: hit });
  }
  const systemFlags: SystemFlag[] = [];
  for (const sys of Object.keys(SYSTEM_ONLY_KEYWORDS) as (keyof typeof SYSTEM_ONLY_KEYWORDS)[]) {
    const hit = SYSTEM_ONLY_KEYWORDS[sys].filter((kw) => t.includes(kw));
    if (hit.length) systemFlags.push({ system: sys, phrases: hit });
  }
  return { matches, systemFlags, unrecognized: matches.length === 0 && systemFlags.length === 0 && t.trim().length > 0 };
}
