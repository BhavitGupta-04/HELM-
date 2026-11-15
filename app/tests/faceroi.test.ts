import { describe, it, expect } from "vitest";
import { roisFromLandmarks, type Pt } from "../src/engine";

function face(over: Partial<Record<number, Pt>> = {}): Pt[] {
  const lm: Pt[] = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));
  const set: Record<number, Pt> = { 10: { x: 0.5, y: 0.22 }, 234: { x: 0.3, y: 0.5 }, 454: { x: 0.7, y: 0.5 }, 105: { x: 0.42, y: 0.38 }, 334: { x: 0.58, y: 0.38 }, 66: { x: 0.44, y: 0.39 }, 296: { x: 0.56, y: 0.39 }, 50: { x: 0.38, y: 0.58 }, 280: { x: 0.62, y: 0.58 }, ...over };
  for (const [i, p] of Object.entries(set)) lm[Number(i)] = p;
  return lm;
}
describe("face regions", () => {
  it("puts the forehead region between the hairline and the eyebrows", () => {
    const f = roisFromLandmarks(face())!.rects.find((r) => r.name === "forehead")!;
    expect(f.y).toBeGreaterThan(0.22); expect(f.y + f.h).toBeLessThan(0.38); expect(f.x).toBeGreaterThanOrEqual(0.4); expect(f.x + f.w).toBeLessThanOrEqual(0.6);
  });
  it("adds both cheeks inside the face width", () => {
    const rs = roisFromLandmarks(face())!.rects; expect(rs.map((r) => r.name).sort()).toEqual(["cheek-left", "cheek-right", "forehead"]);
    for (const r of rs) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.w).toBeLessThanOrEqual(1); expect(r.y + r.h).toBeLessThanOrEqual(1); expect(r.w).toBeGreaterThan(0); expect(r.h).toBeGreaterThan(0); }
  });
  it("follows the face when it moves", () => {
    const moved = face(Object.fromEntries(Object.entries({ 10: { x: 0.8, y: 0.12 }, 234: { x: 0.6, y: 0.4 }, 454: { x: 0.95, y: 0.4 }, 105: { x: 0.72, y: 0.28 }, 334: { x: 0.88, y: 0.28 }, 66: { x: 0.74, y: 0.29 }, 296: { x: 0.86, y: 0.29 }, 50: { x: 0.68, y: 0.48 }, 280: { x: 0.9, y: 0.48 } }).map(([k, v]) => [Number(k), v])));
    const f = roisFromLandmarks(moved)!.rects[0]; expect(f.x).toBeGreaterThan(0.7);
  });
  it("rejects missing, tiny, or broken landmark data", () => {
    expect(roisFromLandmarks([])).toBeNull();
    expect(roisFromLandmarks(face({ 234: { x: 0.5, y: 0.5 }, 454: { x: 0.52, y: 0.5 } }))).toBeNull();
    expect(roisFromLandmarks(face({ 10: { x: 0.5, y: NaN } }))).toBeNull();
    expect(roisFromLandmarks(face({ 10: { x: 0.5, y: 0.38 } }))).toBeNull();
    expect(roisFromLandmarks(null as unknown as Pt[])).toBeNull();
  });
});
