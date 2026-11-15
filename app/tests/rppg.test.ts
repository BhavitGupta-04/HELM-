import { describe, it, expect } from "vitest";
import { analyseRppg, type RppgSample } from "../src/engine";

// Deterministic noise so tests never flake.
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; }; }
interface Opt { bpm?: number; seconds?: number; fps?: number; amp?: number; noise?: number; base?: [number, number, number]; drift?: number; breathHz?: number; seed?: number; jitter?: boolean; move?: number }
function synth(o: Opt = {}): RppgSample[] {
  const { bpm = 72, seconds = 30, fps = 30, amp = 0.012, noise = 0.004, base = [190, 140, 120], drift = 0.02, breathHz = 0, seed = 1, jitter = false, move = 0 } = o;
  const rnd = rng(seed), out: RppgSample[] = []; const n = Math.round(seconds * fps);
  for (let i = 0; i < n; i++) {
    const t = i / fps + (jitter ? rnd() * 0.01 : 0);
    const p = Math.sin(2 * Math.PI * (bpm / 60) * t), light = 1 + drift * Math.sin(2 * Math.PI * 0.05 * t) + move * Math.sin(2 * Math.PI * 0.3 * t) + (breathHz ? 0.01 * Math.sin(2 * Math.PI * breathHz * t) : 0);
    out.push({ t, r: base[0] * light * (1 + 0.3 * amp * p + noise * rnd()), g: base[1] * light * (1 + amp * p + noise * rnd()), b: base[2] * light * (1 + 0.5 * amp * p + noise * rnd()) });
  }
  return out;
}

describe("camera pulse (rPPG)", () => {
  for (const bpm of [48, 60, 72, 90, 120, 150]) {
    it(`recovers ${bpm} bpm within 2 bpm from a clean synthetic signal`, () => {
      const r = analyseRppg(synth({ bpm })); expect(r.ok).toBe(true); expect(Math.abs(r.bpm! - bpm)).toBeLessThanOrEqual(2);
    });
  }
  it("works with noisy irregular frame timing", () => { const r = analyseRppg(synth({ bpm: 80, jitter: true, noise: 0.008, seed: 5 })); expect(r.ok).toBe(true); expect(Math.abs(r.bpm! - 80)).toBeLessThanOrEqual(3); });
  it("survives slow lighting drift", () => { const r = analyseRppg(synth({ bpm: 66, drift: 0.04 })); expect(r.ok).toBe(true); expect(Math.abs(r.bpm! - 66)).toBeLessThanOrEqual(2); });
  it("never calls pure noise reliable, but still gives a labelled rough estimate", () => {
    let wrong = 0; for (let s = 1; s <= 60; s++) { const r = analyseRppg(synth({ amp: 0, noise: 0.01, seed: s, drift: 0 })); expect(r.ok).toBe(true); expect(r.bpm).toBeGreaterThanOrEqual(42); expect(r.bpm).toBeLessThanOrEqual(180); if (r.reliable) wrong++; }
    expect(wrong).toBe(0);
  });
  it("rejects too-short video", () => { const r = analyseRppg(synth({ seconds: 10 })); expect(r.ok).toBe(false); expect(r.reason).toMatch(/20 seconds/); });
  it("rejects low frame rate", () => { expect(analyseRppg(synth({ fps: 8 })).ok).toBe(false); });
  it("rejects dark and overexposed video", () => {
    expect(analyseRppg(synth({ base: [20, 15, 12] })).reason).toMatch(/dark/i);
    expect(analyseRppg(synth({ base: [255, 255, 250] })).reason).toMatch(/bright/i);
  });
  it("heavy movement or lighting change still gives an estimate, never a refusal", () => { const r = analyseRppg(synth({ move: 0.25 })); expect(r.ok).toBe(true); expect(r.bpm).toBeDefined(); });
  it("survives brief exposure jumps and head-movement spikes", () => {
    const base = synth({ bpm: 78, amp: 0.006, noise: 0.008, seconds: 40, seed: 9 });
    const spiked = base.map((s) => ((s.t > 12 && s.t < 12.8) || (s.t > 27 && s.t < 27.6)) ? { ...s, r: s.r * 1.12, g: s.g * 1.12, b: s.b * 1.12 } : s);
    const r = analyseRppg(spiked); expect(r.ok).toBe(true); expect(Math.abs(r.bpm! - 78)).toBeLessThanOrEqual(3);
  });
  it("a longer recording makes a weak pulse reliable at least as often as a short one", () => {
    let s30 = 0, l60 = 0;
    for (let seed = 1; seed <= 20; seed++) { if (analyseRppg(synth({ amp: 0.003, noise: 0.012, seconds: 30, seed })).reliable) s30++; if (analyseRppg(synth({ amp: 0.003, noise: 0.012, seconds: 60, seed })).reliable) l60++; }
    expect(l60).toBeGreaterThanOrEqual(s30);
  });
  it("picks whichever colour candidate has the clearest peak, not POS by default", () => {
    // A signal where only the green channel carries any pulse at all (red/blue flat): POS and CHROM, which mix all
    // three channels, should lose to plain GREEN here. This is the real-world pattern this ensemble is for: on some
    // cameras/lighting, the colour-ratio methods dilute a signal that a single channel carries cleanly.
    const rnd = rng(3), out: RppgSample[] = []; const n = 30 * 30;
    for (let i = 0; i < n; i++) { const t = i / 30, p = Math.sin(2 * Math.PI * (75 / 60) * t); out.push({ t, r: 190 * (1 + 0.004 * rnd()), g: 140 * (1 + 0.02 * p + 0.004 * rnd()), b: 120 * (1 + 0.004 * rnd()) }); }
    const r = analyseRppg(out);
    expect(r.ok).toBe(true); expect(r.method).toBe("GREEN"); expect(Math.abs(r.bpm! - 75)).toBeLessThanOrEqual(2);
    expect(r.candidates?.length).toBe(3);
  });
  it("taking the best of three candidates never calls pure noise reliable either", () => {
    let wrong = 0; for (let s = 1; s <= 100; s++) { const r = analyseRppg(synth({ amp: 0, noise: 0.01, seed: s + 1000, drift: 0 })); if (r.reliable) wrong++; }
    expect(wrong).toBe(0);
  });
  it("an unreliable reading is not biased toward a particular number (no comb-filter artifact)", () => {
    // A box-average detrend has full-strength gain exactly at multiples of 1/window, which used to pile up low-
    // confidence guesses at 40/80/120/160 bpm regardless of the actual (absent) signal. The band-pass fix should
    // spread unreliable guesses roughly across the band instead of stacking on those specific numbers.
    const bpms: number[] = [];
    for (let s = 1; s <= 200; s++) { const r = analyseRppg(synth({ amp: 0, noise: 0.01, seed: s + 2000, drift: 0 })); bpms.push(r.bpm!); }
    const nearComb = bpms.filter((b) => [40, 80, 120, 160].some((k) => Math.abs(b - k) <= 3)).length;
    expect(nearComb / bpms.length).toBeLessThan(0.3);
  });
  it("gives a breathing estimate only when the slow rhythm is clear", () => {
    const r = analyseRppg(synth({ seconds: 40, breathHz: 0.25, drift: 0 })); expect(r.reliable).toBe(true);
    if (r.breathsPerMin !== undefined) expect(Math.abs(r.breathsPerMin - 15)).toBeLessThanOrEqual(2);
    expect(analyseRppg(synth({ seconds: 25 })).breathsPerMin).toBeUndefined();
  });
});

import { looksLikeSkin, demoSamples } from "../src/engine";
describe("camera helpers", () => {
  it("accepts skin-like colours and rejects walls, screens and darkness", () => {
    expect(looksLikeSkin(190, 140, 120)).toBe(true); expect(looksLikeSkin(120, 80, 60)).toBe(true);
    expect(looksLikeSkin(128, 128, 128)).toBe(false); expect(looksLikeSkin(30, 20, 10)).toBe(false); expect(looksLikeSkin(60, 120, 200)).toBe(false);
  });
  it("demo signal analyses to its stated rate", () => { const r = analyseRppg(demoSamples(72)); expect(r.ok).toBe(true); expect(Math.abs(r.bpm! - 72)).toBeLessThanOrEqual(2); });
});
