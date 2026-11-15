import { useEffect, useRef } from "react";

/** Parallax starfield on a canvas. `warp` (0..1) stretches stars into streaks when the mission clock jumps. */
export function Starfield({ warp }: { warp: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const warpRef = useRef(warp);
  warpRef.current = warp;
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext("2d")!;
    let w = 0, h = 0, raf = 0;
    const stars = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * 0.9 + 0.1, tw: Math.random() * 6 }));
    const resize = () => { const d = Math.min(devicePixelRatio, 2); w = c.width = innerWidth * d; h = c.height = innerHeight * d; };
    resize(); addEventListener("resize", resize);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let t = 0, w2 = 0;
    const frame = () => {
      t += 0.016; w2 += (warpRef.current - w2) * 0.08;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (!reduce) { s.x -= (0.00006 + w2 * 0.004) * s.z; if (s.x < 0) { s.x = 1; s.y = Math.random(); } }
        const x = s.x * w, y = s.y * h, a = 0.35 + 0.65 * Math.abs(Math.sin(t * s.z + s.tw));
        ctx.strokeStyle = `rgba(190,215,255,${a * s.z})`; ctx.lineWidth = s.z * 1.6 * (w / 1600 + 0.6);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w2 * 90 * s.z + 0.01, y); ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="stars" aria-hidden="true" />;
}
