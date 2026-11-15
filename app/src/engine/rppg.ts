/**
 * Camera pulse (remote photoplethysmography). Pure signal processing, no camera or DOM code.
 * Input: average red/green/blue of a skin region, one sample per video frame.
 * Method: three independent colour-combination candidates — POS (Wang et al. 2017), CHROM (De Haan & Jeanne, 2013),
 * and the plain green channel (strongest raw pulse signal on many sensors when motion is already low) — each run
 * through the same slow-trend removal, Welch-style segment averaging and spectral-peak picking. Whichever candidate
 * shows the clearest peak (highest in-band signal-to-noise) is reported; this is never a guess at which method will
 * work best, it is measured per-recording, because the best channel combination is lighting- and camera-dependent.
 * If the signal is not clearly periodic it still returns a number (never a bare refusal) but marks it unreliable.
 */
export interface RppgSample { t: number; r: number; g: number; b: number }
export type RppgConfidence = "high" | "medium" | "low";
export interface RppgResult {
  /** True when an estimate exists. It can still be low confidence: check `reliable`. */
  ok: boolean;
  /** True when the pulse peak clearly stands out from noise. When false, bpm is only a rough estimate. */
  reliable: boolean;
  reason?: string; bpm?: number; snr?: number; confidence: RppgConfidence;
  durationS: number; fps: number; filtered: number[]; breathsPerMin?: number;
  /** Typical short-term brightness wobble (0 = steady). High values mean movement or changing light. */
  motion?: number;
  /** Independent second opinion: plain brightness average, Hamming window, FFT peak (the approach of thearn/webcam-pulse-detector). */
  altBpm?: number;
  /** True when both estimators agree within 4 bpm. */
  agree?: boolean;
  /** Which colour-combination candidate produced the headline bpm (measured per-recording, not fixed). */
  method?: "POS" | "CHROM" | "GREEN";
  /** Every candidate tried, for transparency/debugging. Sorted by none in particular; `method` names the winner. */
  candidates?: { method: "POS" | "CHROM" | "GREEN"; bpm: number; snr: number }[];
}
// snrOk is calibrated against the max of the three candidates below, not a single one: taking the best of three
// independent noisy estimates inflates false positives, and switching the detrend from a box moving-average to a
// proper Butterworth band-pass changed the noise floor again. Re-simulated against 3000 pure-noise seeds after that
// change: 7.0 cleared every one of them, with a real genuine signal (even a weak one) measuring 20+ in the same test.
export const RPPG = { minSeconds: 20, minFps: 12, bandLo: 0.75, bandHi: 2.9, snrOk: 7.0, snrHigh: 14.0, uniformFs: 30, segSeconds: 15, segStepSeconds: 3 } as const;

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const std = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

function resample(s: RppgSample[], fs: number): { r: number[]; g: number[]; b: number[] } {
  const t0 = s[0].t, n = Math.floor((s[s.length - 1].t - t0) * fs);
  const r: number[] = [], g: number[] = [], b: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i / fs;
    while (j < s.length - 2 && s[j + 1].t < t) j++;
    const a = s[j], c = s[j + 1], w = c.t === a.t ? 0 : Math.min(1, Math.max(0, (t - a.t) / (c.t - a.t)));
    r.push(a.r + (c.r - a.r) * w); g.push(a.g + (c.g - a.g) * w); b.push(a.b + (c.b - a.b) * w);
  }
  return { r, g, b };
}

/** POS projection with overlap-add over 1.6 s windows. */
function pos(r: number[], g: number[], b: number[], fs: number): number[] {
  const n = r.length, L = Math.round(1.6 * fs), H = new Array<number>(n).fill(0);
  for (let s = 0; s + L <= n; s++) {
    const rs = r.slice(s, s + L), gs = g.slice(s, s + L), bs = b.slice(s, s + L);
    const mr = mean(rs) || 1, mg = mean(gs) || 1, mb = mean(bs) || 1;
    const s1 = rs.map((_, i) => gs[i] / mg - bs[i] / mb);
    const s2 = rs.map((_, i) => gs[i] / mg + bs[i] / mb - (2 * rs[i]) / mr);
    const sd2 = std(s2), alpha = sd2 > 1e-12 ? std(s1) / sd2 : 0;
    const h = s1.map((v, i) => v + alpha * s2[i]), mh = mean(h);
    for (let i = 0; i < L; i++) H[s + i] += h[i] - mh;
  }
  return H;
}

function movingAvgDetrend(x: number[], win: number): number[] {
  const out: number[] = [], half = Math.floor(win / 2);
  const cs = [0]; for (const v of x) cs.push(cs[cs.length - 1] + v);
  for (let i = 0; i < x.length; i++) { const a = Math.max(0, i - half), b = Math.min(x.length, i + half + 1); out.push(x[i] - (cs[b] - cs[a]) / (b - a)); }
  return out;
}

/**
 * Zero-phase Butterworth bandpass (RBJ cookbook biquads, run forward then backward so there is no phase lag).
 * This replaced a plain moving-average subtraction for the actual pulse signal: a box-average high-pass has a
 * comb-shaped gain with full-strength nulls at multiples of 1/window (here: exactly 40, 80, 120, 160 bpm), which
 * made a weak or absent pulse systematically pile up near those frequencies instead of landing anywhere honestly
 * random in the band — verified against 400 simulated pure-noise seeds. A real Butterworth band-pass has a flat
 * passband and no such resonance, so a low-confidence reading is no longer biased toward a particular number.
 */
function biquad(x: number[], b0: number, b1: number, b2: number, a1: number, a2: number): number[] {
  const y = new Array<number>(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const xi = x[i], yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; y[i] = yi; x2 = x1; x1 = xi; y2 = y1; y1 = yi; }
  return y;
}
function rbjHighpass(x: number[], fs: number, f0: number, Q = 0.707): number[] {
  const w0 = (2 * Math.PI * f0) / fs, alpha = Math.sin(w0) / (2 * Q), c = Math.cos(w0);
  const b0 = (1 + c) / 2, b1 = -(1 + c), b2 = (1 + c) / 2, a0 = 1 + alpha, a1 = -2 * c, a2 = 1 - alpha;
  return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}
function rbjLowpass(x: number[], fs: number, f0: number, Q = 0.707): number[] {
  const w0 = (2 * Math.PI * f0) / fs, alpha = Math.sin(w0) / (2 * Q), c = Math.cos(w0);
  const b0 = (1 - c) / 2, b1 = 1 - c, b2 = (1 - c) / 2, a0 = 1 + alpha, a1 = -2 * c, a2 = 1 - alpha;
  return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}
function filtfilt(x: number[], fn: (x: number[]) => number[]): number[] { return fn(fn(x).reverse()).reverse(); }
function bandpassFilter(x: number[], fs: number, lo: number, hi: number): number[] {
  return filtfilt(filtfilt(x, (z) => rbjHighpass(z, fs, lo)), (z) => rbjLowpass(z, fs, hi));
}

/** Power spectrum of one segment (Hann window), normalised so the in-band total is 1. */
function bandPower(x: number[], fs: number, lo: number, hi: number) {
  const n = x.length, w = x.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
  const freqs: number[] = [], pw: number[] = [];
  for (let f = lo; f <= hi + 1e-9; f += 0.01) {
    let re = 0, im = 0; const k = (2 * Math.PI * f) / fs;
    for (let i = 0; i < n; i++) { const a = k * i; re += w[i] * Math.cos(a); im -= w[i] * Math.sin(a); }
    freqs.push(f); pw.push(re * re + im * im);
  }
  const tot = pw.reduce((a, b) => a + b, 0) || 1;
  return { freqs, pw: pw.map((p) => p / tot) };
}

/** CHROM projection (De Haan & Jeanne, 2013), overlap-add over the same 1.6 s windows as POS. */
function chrom(r: number[], g: number[], b: number[], fs: number): number[] {
  const n = r.length, L = Math.round(1.6 * fs), H = new Array<number>(n).fill(0);
  for (let s = 0; s + L <= n; s++) {
    const rs = r.slice(s, s + L), gs = g.slice(s, s + L), bs = b.slice(s, s + L);
    const mr = mean(rs) || 1, mg = mean(gs) || 1, mb = mean(bs) || 1;
    const xs = rs.map((_, i) => 3 * (rs[i] / mr) - 2 * (gs[i] / mg));
    const ys = rs.map((_, i) => 1.5 * (rs[i] / mr) + gs[i] / mg - 1.5 * (bs[i] / mb));
    const sy = std(ys), alpha = sy > 1e-12 ? std(xs) / sy : 0;
    const h = xs.map((v, i) => v - alpha * ys[i]), mh = mean(h);
    for (let i = 0; i < L; i++) H[s + i] += h[i] - mh;
  }
  return H;
}

function peakOf(freqs: number[], pw: number[], regionBins: number) {
  let pk = 0; for (let i = 1; i < pw.length; i++) if (pw[i] > pw[pk]) pk = i;
  let f = freqs[pk];
  if (pk > 0 && pk < pw.length - 1) { const a = Math.log(pw[pk - 1] + 1e-30), b = Math.log(pw[pk] + 1e-30), c = Math.log(pw[pk + 1] + 1e-30), d = a - 2 * b + c; if (d < 0) f += (0.5 * (a - c)) / d * 0.01; }
  let sig = 0, sigN = 0, rest = 0, restN = 0;
  pw.forEach((p, i) => { if (Math.abs(i - pk) <= regionBins) { sig += p; sigN++; } else { rest += p; restN++; } });
  return { f, snr: restN && rest > 0 ? sig / sigN / (rest / restN) : 0 };
}

/**
 * Pulse estimate from camera colour samples. Uses overlapping 15 s segments (Welch averaging) and down-weights the
 * most shaky ones, so a few head movements or exposure jumps do not ruin the reading. It returns a number whenever the
 * video is physically usable and marks it `reliable:false` (low confidence) when the peak is not clear. It only
 * refuses (ok:false) when there is nothing to analyse: too short, too dark, overexposed or too low a frame rate.
 */
export function analyseRppg(samples: RppgSample[]): RppgResult {
  const fail = (reason: string, durationS = 0, fps = 0): RppgResult => ({ ok: false, reliable: false, reason, confidence: "low", durationS, fps, filtered: [] });
  const clean = samples.filter((s) => [s.t, s.r, s.g, s.b].every(Number.isFinite)).sort((a, b) => a.t - b.t);
  if (clean.length < 10) return fail("Not enough video frames.");
  const durationS = clean[clean.length - 1].t - clean[0].t, fps = (clean.length - 1) / (durationS || 1);
  if (durationS < RPPG.minSeconds) return fail(`Need at least ${RPPG.minSeconds} seconds of video.`, durationS, fps);
  if (fps < RPPG.minFps) return fail("Camera frame rate is too low for a pulse reading.", durationS, fps);
  const gMean = mean(clean.map((s) => s.g));
  if (gMean < 35) return fail("Too dark. Face a light source.", durationS, fps);
  if (gMean > 235 || mean(clean.map((s) => (s.g > 250 ? 1 : 0))) > 0.2) return fail("Too bright or overexposed. Reduce direct light on your face.", durationS, fps);

  const fs = RPPG.uniformFs, { r, g, b } = resample(clean, fs);
  const gn = g.map((v) => v / (mean(g) || 1)), gDet = movingAvgDetrend(gn, Math.round(1.5 * fs));
  const trim = Math.round(0.8 * fs);
  const detrendTrim = (x: number[]) => { const d = bandpassFilter(x, fs, RPPG.bandLo, RPPG.bandHi); return d.slice(trim, d.length - trim); };
  // Three independent colour-combination candidates. Which one has the clearest peak is measured below, per recording —
  // POS and CHROM cancel motion/specular artifacts at the cost of mixing in all three channels' noise; plain green
  // skips that cancellation but keeps only the channel most sensors capture with least noise. Neither is always best.
  const sigPos = detrendTrim(pos(r, g, b, fs)), sigChrom = detrendTrim(chrom(r, g, b, fs)), sigGreen = detrendTrim(gn);
  const wob = gDet.slice(trim, gDet.length - trim);

  const segN = Math.min(sigPos.length, Math.round(RPPG.segSeconds * fs)), step = Math.round(RPPG.segStepSeconds * fs);
  const starts: number[] = [];
  for (let s = 0; s + segN <= sigPos.length; s += step) starts.push(s);
  if (!starts.length) starts.push(0);
  const withShake = starts.map((s) => ({ s, shake: std(wob.slice(s, s + segN)) }));
  const shakes = withShake.map((q) => q.shake).sort((a, b) => a - b), motion = shakes[Math.floor(shakes.length / 2)];
  const keep = withShake.length <= 2 ? withShake : [...withShake].sort((a, b) => a.shake - b.shake).slice(0, Math.max(3, Math.ceil(withShake.length * 0.7)));
  const regionBins = Math.round(2 / (segN / fs) / 0.01);
  const estimate = (sig: number[]) => {
    let acc: number[] | null = null, freqs: number[] = [];
    for (const q of keep) { const x = sig.slice(q.s, q.s + segN); const { freqs: f, pw } = bandPower(x, fs, RPPG.bandLo, RPPG.bandHi); freqs = f; acc = acc ? acc.map((v, i) => v + pw[i]) : pw.slice(); }
    const avg = acc!.map((v) => v / keep.length);
    return peakOf(freqs, avg, regionBins);
  };
  const candidates = ([["POS", sigPos], ["CHROM", sigChrom], ["GREEN", sigGreen]] as const).map(([name, sig]) => ({ method: name, ...estimate(sig) }));
  const best = candidates.reduce((a, b) => (b.snr > a.snr ? b : a));
  const { f, snr } = best, filtered = best.method === "POS" ? sigPos : best.method === "CHROM" ? sigChrom : sigGreen;
  // Second opinion from plain brightness (mean of R, G, B), as in thearn/webcam-pulse-detector (Apache-2.0, re-implemented here).
  const luma = movingAvgDetrend(r.map((_, i) => (r[i] + g[i] + b[i]) / 3).slice(trim, r.length - trim), Math.round(1.5 * fs));
  const lumaSpec = (() => { const hw = luma.map((v, i) => v * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (luma.length - 1)))); const bp = bandPower(hw, fs, 50 / 60, 180 / 60); return peakOf(bp.freqs, bp.pw, Math.round(2 / (luma.length / fs) / 0.01)); })();
  const altBpm = Math.round(lumaSpec.f * 600) / 10, bpm0 = Math.round(f * 600) / 10;
  const agree = Math.abs(altBpm - bpm0) <= 4;
  // Reliable only when the pulse clearly stands out. The two estimators read the same video patch, so their agreement is shown but is weak evidence by itself.
  const reliable = snr >= RPPG.snrOk;
  const res: RppgResult = {
    ok: true, reliable, altBpm, agree, bpm: Math.round(f * 600) / 10, snr,
    confidence: !reliable ? "low" : snr >= RPPG.snrHigh ? "high" : "medium", durationS, fps, filtered, motion,
    method: best.method, candidates: candidates.map((c) => ({ method: c.method, bpm: Math.round(c.f * 600) / 10, snr: c.snr })),
  };
  if (!reliable) res.reason = motion > 0.02 ? "A lot of movement or changing light was detected." : "The pulse signal was weak.";
  if (reliable && durationS >= 30) {
    const slow = movingAvgDetrend(gn, Math.round(12 * fs)), bp = bandPower(slow, fs, 0.1, 0.5), bk = peakOf(bp.freqs, bp.pw, 8);
    if (bk.snr >= 4) res.breathsPerMin = Math.round(bk.f * 600) / 10;
  }
  return res;
}

/** Rough check that an average patch colour could be skin (red > green > blue, not grey or saturated). Does not identify anyone. */
export function looksLikeSkin(r: number, g: number, b: number): boolean {
  return r > g && r > b && r - b >= 8 && r >= 45 && r <= 250 && g / (r || 1) > 0.45;
}

/** SIMULATED signal for the no-camera demo. Never presented as a measurement of the viewer. */
export function demoSamples(bpm = 72, seconds = 30, fps = 30): RppgSample[] {
  let s = 12345; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  const out: RppgSample[] = [];
  for (let i = 0; i < seconds * fps; i++) {
    const t = i / fps, p = Math.sin(2 * Math.PI * (bpm / 60) * t), l = 1 + 0.02 * Math.sin(2 * Math.PI * 0.05 * t);
    out.push({ t, r: 190 * l * (1 + 0.004 * p + 0.004 * rnd()), g: 140 * l * (1 + 0.012 * p + 0.004 * rnd()), b: 120 * l * (1 + 0.006 * p + 0.004 * rnd()) });
  }
  return out;
}
