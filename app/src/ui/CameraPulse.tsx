import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FALLBACK_RECT, analyseRppg, demoSamples, looksLikeSkin, roisFromLandmarks, type FaceRois, type Pt, type Rect, type RppgResult, type RppgSample } from "../engine";
import type { Mission } from "./state";

const MIN_S = 30, MAX_S = 60, CHECK_EVERY = 5;
type Phase = "idle" | "starting" | "measuring" | "done" | "error";

/* ---- Face tracker: MediaPipe Face Mesh, bundled with the site (public/mediapipe). Runs fully in the browser. ---- */
interface Tracker { send(i: { image: HTMLVideoElement }): Promise<void>; onResults(cb: (r: { multiFaceLandmarks?: Pt[][] }) => void): void; initialize(): Promise<void>; setOptions(o: object): void; close?: () => void }
declare global { interface Window { FaceMesh?: new (c: { locateFile: (f: string) => string }) => Tracker } }
const BASE = `${import.meta.env.BASE_URL}mediapipe/`;
let trackerLoad: Promise<boolean> | null = null;
function loadTrackerScript(): Promise<boolean> {
  if (window.FaceMesh) return Promise.resolve(true);
  trackerLoad ??= new Promise<boolean>((res) => {
    const s = document.createElement("script"); s.src = `${BASE}face_mesh.js`; s.onload = () => res(!!window.FaceMesh); s.onerror = () => { trackerLoad = null; res(false); };
    document.head.appendChild(s);
  });
  return trackerLoad;
}
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

function describeError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera permission was blocked. Allow the camera for this site in your browser, or use manual entry below.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device. Use manual entry or the simulated demo.";
  if (name === "NotReadableError") return "The camera is in use by another app. Close it and try again.";
  return "The camera could not be started. Use manual entry or the simulated demo.";
}

export function CameraPulse({ m }: { m: Mission }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [skinOk, setSkinOk] = useState(true);
  const [extended, setExtended] = useState(false);
  const [face, setFace] = useState<"loading" | "found" | "none" | "unavailable">("loading");
  const [tooFar, setTooFar] = useState(false);
  const [res, setRes] = useState<RppgResult | null>(null);
  const [trackedPct, setTrackedPct] = useState(0);
  const [liveHint, setLiveHint] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [logged, setLogged] = useState(false);
  const [watchOn, setWatchOn] = useState(false);
  const [watchMin, setWatchMin] = useState(5);
  const [unresponsiveAlert, setUnresponsiveAlert] = useState(false);
  const missStreak = useRef(0);
  const video = useRef<HTMLVideoElement>(null), work = useRef<HTMLCanvasElement>(null), wave = useRef<HTMLCanvasElement>(null), overlay = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null), samples = useRef<RppgSample[]>([]), raf = useRef(0), t0 = useRef(0), nextCheck = useRef(MIN_S), lastTime = useRef(-1);
  const lastSend = useRef(0), sendMs = useRef<number[]>([]), skinCount = useRef(0), trackedCount = useRef(0), stop = useRef(false), tracker = useRef<Tracker | null>(null), busy = useRef(false);
  const latest = useRef<{ rois: FaceRois | null; at: number }>({ rois: null, at: 0 });
  const held = useRef<{ rois: FaceRois; at: number } | null>(null);

  const release = useCallback(() => { stop.current = true; cancelAnimationFrame(raf.current); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; }, []);
  useEffect(() => () => { release(); try { tracker.current?.close?.(); } catch { /* ignore */ } }, [release]);

  const drawWave = useCallback(() => {
    const c = wave.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return;
    const w = c.width, h = c.height; ctx.clearRect(0, 0, w, h);
    const s = samples.current.slice(-150); if (s.length < 10) return;
    const g = s.map((x) => x.g), avg = g.reduce((a, b) => a + b, 0) / g.length, dev = g.map((v) => v - avg), mx = Math.max(0.5, ...dev.map(Math.abs));
    ctx.strokeStyle = "#00e5c3"; ctx.lineWidth = 2; ctx.beginPath();
    dev.forEach((v, i) => { const x = (i / (dev.length - 1)) * w, y = h / 2 - (v / mx) * (h / 2 - 4); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  }, []);

  const drawOverlay = useCallback((rects: Rect[], tracked: boolean) => {
    const c = overlay.current, v = video.current; if (!c || !v || !v.videoWidth) return;
    if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
    const ctx = c.getContext("2d")!; ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = Math.max(2, c.width / 200); ctx.strokeStyle = tracked ? "#00e5c3" : "rgba(255,180,84,.9)"; ctx.fillStyle = tracked ? "rgba(0,229,195,.12)" : "rgba(255,180,84,.1)";
    for (const r of rects) { ctx.fillRect(r.x * c.width, r.y * c.height, r.w * c.width, r.h * c.height); ctx.strokeRect(r.x * c.width, r.y * c.height, r.w * c.width, r.h * c.height); }
  }, []);

  /** Mean skin colour over all regions. Reads the region at its real resolution and averages every pixel
   *  (a shrunken thumbnail only samples a few pixels, which buries the tiny pulse in sensor noise),
   *  skipping pixels that are clearly not skin (hair, eyebrows, glasses). */
  const readRegions = useCallback((v: HTMLVideoElement, rects: Rect[]) => {
    const c = work.current!, ctx = c.getContext("2d", { willReadFrequently: true })!;
    let r = 0, g = 0, b = 0, wsum = 0;
    for (const q of rects) {
      const sw = Math.round(q.w * v.videoWidth), sh = Math.round(q.h * v.videoHeight);
      if (sw < 2 || sh < 2) continue;
      const cap = 192, sc = Math.min(1, cap / Math.max(sw, sh));
      const dw = Math.max(2, Math.round(sw * sc)), dh = Math.max(2, Math.round(sh * sc));
      if (c.width !== dw || c.height !== dh) { c.width = dw; c.height = dh; }
      ctx.drawImage(v, q.x * v.videoWidth, q.y * v.videoHeight, sw, sh, 0, 0, dw, dh);
      const d = ctx.getImageData(0, 0, dw, dh).data;
      let sr = 0, sg = 0, sb = 0, sn = 0, ar = 0, ag = 0, ab = 0; const an = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i], G = d[i + 1], B = d[i + 2];
        ar += R; ag += G; ab += B;
        if (R > G && R > B && R - B >= 8 && R >= 45 && R <= 250 && G > 0.45 * R) { sr += R; sg += G; sb += B; sn++; }
      }
      const useSkin = sn >= an * 0.3;
      const mr = useSkin ? sr / sn : ar / an, mg = useSkin ? sg / sn : ag / an, mb = useSkin ? sb / sn : ab / an;
      const wt = q.w * q.h; r += mr * wt; g += mg * wt; b += mb * wt; wsum += wt;
    }
    if (!wsum) return null;
    return { r: r / wsum, g: g / wsum, b: b / wsum };
  }, []);

  const loop = useCallback(() => {
    if (stop.current) return;
    const v = video.current;
    if (v && work.current && v.readyState >= 2 && v.videoWidth) {
      // Face finding runs at most ~10 times a second and never uses more than about a fifth of the CPU: if it is slow on this device it backs off, and if it is very slow it is switched off (fixed patch instead).
      const ms = sendMs.current, avg = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0, interval = Math.max(100, avg * 4);
      if (ms.length >= 3 && avg > 400) { tracker.current = null; setFace("unavailable"); }
      if (tracker.current && !busy.current && performance.now() - lastSend.current > interval) {
        busy.current = true; const t1 = performance.now(); lastSend.current = t1;
        tracker.current.send({ image: v }).catch(() => undefined).finally(() => { busy.current = false; sendMs.current = [...sendMs.current.slice(-5), performance.now() - t1]; });
      }
      if (v.currentTime !== lastTime.current) {
        lastTime.current = v.currentTime;
        const staleMs = Math.max(500, 1.5 * Math.max(100, (sendMs.current.length ? sendMs.current.reduce((a, b) => a + b, 0) / sendMs.current.length : 0) * 4));
        const fresh = performance.now() - latest.current.at < staleMs ? latest.current.rois : null;
        if (fresh) { held.current = { rois: fresh, at: performance.now() }; }
        const holding = !fresh && held.current && performance.now() - held.current.at < 2500 ? held.current.rois : null;
        const used = fresh ?? holding;
        const rects = used ? used.rects : [FALLBACK_RECT];
        drawOverlay(rects, !!used);
        setFace(!tracker.current ? "unavailable" : used ? "found" : "none"); setTooFar(!!used && used.faceWidth < 0.2);
        const px = readRegions(v, rects);
        if (!px) { raf.current = requestAnimationFrame(loop); return; }
        const { r, g, b } = px;
        const t = (performance.now() - t0.current) / 1000;
        samples.current.push({ t, r, g, b }); if (looksLikeSkin(r, g, b)) skinCount.current++; if (fresh) trackedCount.current++;
        const n = samples.current.length, frac = skinCount.current / n; setSkinOk(frac > 0.5 || n < 15);
        if (n % 3 === 0) drawWave();
        if (t >= nextCheck.current) {
          // Re-calculate with everything recorded so far. Stop as soon as the pulse is clear, otherwise keep measuring up to MAX_S.
          const out = analyseRppg(samples.current); setTrackedPct(Math.round((trackedCount.current / n) * 100));
          if (frac < 0.5) { release(); setRes({ ok: false, reliable: false, reason: "Could not see skin in the highlighted areas. Center your face with even light.", confidence: "low", durationS: t, fps: 0, filtered: [] }); setSimulated(false); setPhase("done"); return; }
          if (out.reliable || !out.ok || t >= MAX_S) { release(); setRes(out); setSimulated(false); setLogged(false); setPhase("done"); return; }
          // Live coaching: tell the person which lever to pull. A faint signal and a shaky one need different fixes,
          // and "sit still" is the wrong advice when stillness was never the problem (common on a real camera).
          setLiveHint(
            (out.motion ?? 0) > 0.012 ? "Lots of movement or changing light. Hold still and avoid a light flickering or changing behind you."
            : (out.snr ?? 0) < 2 ? "Signal is faint so far. Move closer and face a bright, even light (a window or lamp) so your whole forehead is lit."
            : "Getting closer. A brighter, more even light on your face may sharpen this further."
          );
          nextCheck.current = t + CHECK_EVERY; setExtended(true);
        }
        setProgress(Math.min(1, t / (nextCheck.current > MIN_S ? MAX_S : MIN_S)));
      }
    }
    raf.current = requestAnimationFrame(loop);
  }, [drawOverlay, drawWave, readRegions, release]);

  const start = useCallback(async () => {
    setMsg(""); setRes(null); setProgress(0); setLogged(false); setExtended(false); setFace("loading"); setTooFar(false); setLiveHint(null); nextCheck.current = MIN_S; lastTime.current = -1;
    if (!navigator.mediaDevices?.getUserMedia) { setPhase("error"); setMsg(window.isSecureContext ? "This browser does not support camera access." : "The camera needs a secure (https) address."); return; }
    setPhase("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, audio: false });
      stream.current = s; stop.current = false; samples.current = []; skinCount.current = 0; trackedCount.current = 0; latest.current = { rois: null, at: 0 }; held.current = null;
      const v = video.current!; v.srcObject = s; await v.play();
      // Load the face tracker (about 17 MB the first time). If it cannot load, fall back to a fixed patch.
      if (!tracker.current) {
        const okScript = await withTimeout(loadTrackerScript(), 12000);
        if (okScript && window.FaceMesh) {
          try {
            const fm = new window.FaceMesh({ locateFile: (f) => `${BASE}${f}` });
            fm.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
            fm.onResults((r) => { const lm = r.multiFaceLandmarks?.[0]; latest.current = { rois: lm ? roisFromLandmarks(lm) : null, at: performance.now() }; });
            const inited = await withTimeout(fm.initialize(), 20000);
            if (inited !== null) tracker.current = fm;
          } catch { tracker.current = null; }
        }
      }
      sendMs.current = []; t0.current = performance.now(); setPhase("measuring"); raf.current = requestAnimationFrame(loop);
    } catch (e) { release(); setPhase("error"); setMsg(describeError(e)); }
  }, [loop, release]);

  const cancel = () => { release(); setPhase("idle"); setProgress(0); setWatchOn(false); };
  const useDemo = () => { release(); setRes(analyseRppg(demoSamples(72))); setSimulated(true); setLogged(false); setPhase("done"); };
  const logIt = () => {
    if (!res?.ok || res.bpm === undefined || simulated) return;
    m.logReading("heartRate", Math.round(res.bpm));
    void m.log("camera-pulse", { bpm: res.bpm, altBpm: res.altBpm, snr: Number(res.snr?.toFixed(1)), confidence: res.reliable ? res.confidence : "low (rough estimate)", seconds: Math.round(res.durationS), faceTrackedPct: trackedPct, method: `${res.method ?? "POS"} rPPG, on-device` });
    setLogged(true);
  };

  /* ---- Unattended watch: a backup path for when nobody is there to press the button at all (the crew
   *  member is unconscious, asleep, or incapacitated). While on, HELM restarts the scan on its own and
   *  only auto-logs a reading it would also call reliable on its own terms — an unreliable pass is just
   *  retried next cycle, never force-logged, so the honesty guarantee holds with nobody watching either. */
  useEffect(() => {
    if (!watchOn || simulated) return;
    if (phase === "idle") { void start(); return; }
    if (phase === "done" || phase === "error") {
      const t = window.setTimeout(() => void start(), watchMin * 60_000);
      return () => clearTimeout(t);
    }
  }, [watchOn, phase, watchMin, simulated, start]);

  useEffect(() => {
    if (watchOn && phase === "done" && !simulated && !logged && res?.ok && res.reliable && res.bpm !== undefined) logIt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchOn, phase, simulated, logged, res]);

  /* ---- Possible-unresponsive alert: if unattended watch comes back with no usable pulse, cycle after
   *  cycle, nobody fixed the framing — the most likely honest reading is that nobody is there to fix it.
   *  A clean reading resets the count immediately; this never fires on a single bad cycle, only a streak,
   *  and it is a visual flag, not a diagnosis — HELM cannot actually tell "unconscious" from "walked away". */
  const UNRESPONSIVE_STREAK = 2;
  useEffect(() => {
    if (!watchOn || simulated) { missStreak.current = 0; setUnresponsiveAlert(false); return; }
    if (phase === "done") {
      if (res?.ok && res.reliable) missStreak.current = 0;
      else missStreak.current += 1;
    } else if (phase === "error") {
      missStreak.current += 1;
    }
    if (missStreak.current >= UNRESPONSIVE_STREAK) setUnresponsiveAlert(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchOn, phase, simulated, res]);
  const dismissAlert = () => { missStreak.current = 0; setUnresponsiveAlert(false); };
  const saveSignal = () => {
    if (!res || simulated) return;
    const payload = { app: "HELM camera pulse debug", when: new Date().toISOString(), result: { ok: res.ok, reliable: res.reliable, bpm: res.bpm, altBpm: res.altBpm, snr: res.snr, method: res.method, candidates: res.candidates, motion: res.motion, durationS: res.durationS, fps: res.fps, reason: res.reason, faceTrackedPct: trackedPct }, note: "samples are average colours of small skin patches, about 30 per second; no image data", samples: samples.current.map((x) => ({ t: Math.round(x.t * 1000) / 1000, r: Math.round(x.r * 100) / 100, g: Math.round(x.g * 100) / 100, b: Math.round(x.b * 100) / 100 })) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: "application/json" }));
    a.download = "helm-pulse-signal.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const live = phase === "starting" || phase === "measuring";
  const faceNote = face === "found" ? (tooFar ? "Face found but small. Move closer." : "Face found. Reading forehead and cheeks.") : face === "none" ? "No face found. Face the camera in good light." : face === "unavailable" ? "Face tracker not available or too slow on this device. Using a fixed patch: keep your forehead inside the highlighted box." : "Loading face tracker…";

  return (
    <section className="glass panel" aria-label="Camera pulse measurement" data-face={face} data-tracker-ms={Math.round(sendMs.current.length ? sendMs.current.reduce((a, b) => a + b, 0) / sendMs.current.length : 0)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="eyebrow">Camera pulse · beta</div><span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>ON-DEVICE</span>
      </div>
      <div className="legend" style={{ margin: "6px 0 8px" }}>A backup vitals path for when nobody can type a number in — including if the crew member is asleep, unresponsive, or unconscious. Measures pulse from tiny colour changes in skin. Video stays in your browser; nothing is recorded or uploaded, and only the average colour of small patches is used. Not a medical device. It cannot measure blood pressure or glucose.</div>
      <div style={{ position: "relative", display: live ? "block" : "none", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "4 / 3" }}>
        <video ref={video} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
        <canvas ref={overlay} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", pointerEvents: "none" }} aria-hidden="true" />
      </div>
      <canvas ref={work} width={16} height={16} style={{ display: "none" }} />
      {live && <>
        <canvas ref={wave} width={300} height={56} style={{ width: "100%", height: 56, marginTop: 8 }} aria-label="Live pulse waveform" />
        <div style={{ height: 6, borderRadius: 6, background: "rgba(255,255,255,.1)", marginTop: 6, overflow: "hidden" }}><motion.div style={{ height: "100%", background: "var(--accent)" }} animate={{ width: `${progress * 100}%` }} transition={{ ease: "linear", duration: 0.2 }} /></div>
        <div className="legend" role="status" style={{ marginTop: 6, color: face === "found" && !tooFar && skinOk ? undefined : "var(--watch)" }}>
          {phase === "starting" ? "Starting camera and face tracker…" : `${faceNote} ${extended ? (liveHint ?? "Still refining the estimate.") : `Hold still. ${Math.max(0, Math.ceil(MIN_S * (1 - progress)))} s left.`}`}
        </div>
        <button className="btn" style={{ marginTop: 8 }} onClick={cancel}>Cancel</button>
      </>}
      {phase === "done" && res && (
        <div style={{ marginTop: 8 }}>
          {simulated && <div className="legend" style={{ color: "var(--watch)", marginBottom: 4 }}>SIMULATED demo signal. This is not a measurement of you.</div>}
          {res.ok ? <>
            <div className="mono" style={{ fontSize: 30 }}>{res.bpm!.toFixed(0)} <span style={{ fontSize: 13, color: res.reliable ? "var(--muted)" : "var(--watch)" }}>bpm · {res.reliable ? `${res.confidence} confidence` : "rough estimate, low confidence"}</span></div>
            {res.reliable
              ? <div className="legend">The pulse stood out clearly over noise ({res.snr!.toFixed(0)}×) across {Math.round(res.durationS)} s.Camera estimates can be off by several beats.</div>
              : <div className="legend" role="status" style={{ color: "var(--watch)" }}>{res.reason} This number is HELM's best guess from {Math.round(res.durationS)} s and could be wrong. For a better reading: sit still, face a window or lamp, and keep your face in view. Confirm with a pulse count if it matters.</div>}
            {!simulated && <div className="legend" style={{ marginTop: 4 }}>Details: {res.method ?? "POS"} colour method {res.bpm!.toFixed(0)} bpm, brightness cross-check {res.altBpm?.toFixed(0)} bpm ({res.agree ? "they agree" : "they disagree"}), face tracked {trackedPct}% of the time.</div>}
            {!simulated && <button className="btn primary" style={{ marginTop: 8 }} onClick={logIt} disabled={logged}>{logged ? "Logged to heart rate ✓" : res.reliable ? "Log as heart rate" : "Log anyway (marked low confidence)"}</button>}
          </> : <div className="legend" role="status" style={{ color: "var(--watch)" }}>No number this time: {res.reason} Nothing was logged. You can type your pulse into the Heart rate card instead.</div>}
        </div>
      )}
      {phase === "error" && <div className="legend" role="alert" style={{ color: "var(--watch)", marginTop: 8 }}>{msg}</div>}
      {!live && <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button className="btn primary" onClick={() => void start()}>{phase === "done" ? "Measure again" : "Start 30 s measurement"}</button>
        <button className="btn" onClick={useDemo}>Try simulated demo (no camera)</button>
        {phase === "done" && !simulated && samples.current.length > 0 && <button className="btn" onClick={saveSignal}>Download raw signal (debug)</button>}
      </div>}
      <div className="row" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
          <input type="checkbox" checked={watchOn} onChange={(e) => setWatchOn(e.target.checked)} disabled={simulated} />
          Unattended watch — keep trying on its own, every
        </label>
        <select aria-label="Unattended watch interval" value={watchMin} disabled={!watchOn} onChange={(e) => setWatchMin(Number(e.target.value))} style={{ background: "rgba(255,255,255,.06)", border: "1px solid var(--glass-b)", color: "var(--ink)", borderRadius: 9, padding: "4px 8px", fontSize: 12.5 }}>
          <option value={2}>2 min</option>
          <option value={5}>5 min</option>
          <option value={10}>10 min</option>
        </select>
      </div>
      {watchOn && <div className="legend" style={{ marginTop: 4 }}>On: HELM restarts the scan by itself and only logs a reading it would trust on its own — nobody needs to be there to press Start or Log. After {UNRESPONSIVE_STREAK} tries in a row with no usable reading, it flags a possible unresponsive crew member below. {phase === "measuring" || phase === "starting" ? "Measuring now…" : `Next attempt in up to ${watchMin} min.`}</div>}
      {unresponsiveAlert && (
        <motion.div
          role="alert"
          style={{ marginTop: 10, padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--critical)", display: "flex", alignItems: "center", gap: 10 }}
          animate={{ background: ["color-mix(in srgb, var(--critical) 12%, transparent)", "color-mix(in srgb, var(--critical) 38%, transparent)", "color-mix(in srgb, var(--critical) 12%, transparent)"] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        >
          <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 999, background: "var(--critical)", flex: "none", boxShadow: "0 0 14px var(--critical)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--critical)" }}>Possible unresponsive crew member</div>
            <div className="legend" style={{ margin: "2px 0 0" }}>{missStreak.current} unattended attempts in a row found no usable pulse — the crew member may be out of frame, asleep, or unresponsive. This is a visual flag only; HELM can't tell those apart from here.</div>
          </div>
          <button className="btn" onClick={dismissAlert}>I'm okay</button>
        </motion.div>
      )}
    </section>
  );
}
