/**
 * Where to read the pulse from, given MediaPipe face-mesh landmarks (468 points, coordinates 0..1 across the frame).
 * Pure geometry, no camera code. Regions: forehead (between hairline and eyebrows) and both cheeks.
 */
export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number; name: "forehead" | "cheek-left" | "cheek-right" }
export interface FaceRois { rects: Rect[]; faceWidth: number }

const ok = (p: Pt | undefined): p is Pt => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

export function roisFromLandmarks(lm: Pt[]): FaceRois | null {
  if (!Array.isArray(lm) || lm.length < 400) return null;
  const top = lm[10], l = lm[234], r = lm[454], b1 = lm[105], b2 = lm[334], b3 = lm[66], b4 = lm[296], cl = lm[50], cr = lm[280];
  if (![top, l, r, b1, b2, b3, b4, cl, cr].every(ok)) return null;
  const faceWidth = Math.abs(r.x - l.x);
  if (faceWidth < 0.08 || faceWidth > 0.95) return null;
  const browY = Math.min(b1.y, b2.y, b3.y, b4.y), h = browY - top.y;
  if (h < 0.015) return null;
  const x0 = Math.min(b1.x, b2.x), x1 = Math.max(b1.x, b2.x);
  const forehead: Rect = { name: "forehead", x: x0, y: top.y + 0.2 * h, w: x1 - x0, h: 0.68 * h };
  const cw = 0.2 * faceWidth, ch = 0.14 * faceWidth;
  const cheek = (p: Pt, name: Rect["name"]): Rect => ({ name, x: p.x - cw / 2, y: p.y - ch / 2, w: cw, h: ch });
  const rects = [forehead, cheek(cl, "cheek-left"), cheek(cr, "cheek-right")]
    .map((q) => ({ ...q, x: Math.max(0, q.x), y: Math.max(0, q.y), w: Math.min(q.w, 1 - Math.max(0, q.x)), h: Math.min(q.h, 1 - Math.max(0, q.y)) }))
    .filter((q) => q.w > 0.01 && q.h > 0.005);
  return rects.length ? { rects, faceWidth } : null;
}

/** Fallback when no face is found: a fixed patch near the centre-top of the frame. */
export const FALLBACK_RECT: Rect = { name: "forehead", x: 0.32, y: 0.2, w: 0.36, h: 0.26 };
