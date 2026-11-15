import { motion } from "framer-motion";
import { useMemo } from "react";

export interface Band { lo: number; hi: number }
interface Props { values: number[]; bands?: (Band | null)[]; earth?: [number, number]; reference?: number; color: string; width?: number; height?: number; markIndex?: number }

/** Line + personal conformal band + Earth reference band. The last point is the "now" marker. */
export function Sparkline({ values, bands, earth, reference, color, width = 280, height = 64, markIndex }: Props) {
  const geo = useMemo(() => {
    const all = [...values, ...(bands ?? []).flatMap((b) => (b ? [b.lo, b.hi] : [])), ...(reference !== undefined ? [reference] : [])];
    let lo = Math.min(...all), hi = Math.max(...all);
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
    const x = (i: number) => (values.length < 2 ? 0 : (i / (values.length - 1)) * width);
    const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;
    const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    let band = "";
    if (bands) {
      const pts = bands.map((b, i) => (b ? { i, b } : null)).filter(Boolean) as { i: number; b: Band }[];
      if (pts.length > 1) band = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.b.hi).toFixed(1)}`).join(" ") + " " +
        [...pts].reverse().map((p) => `L${x(p.i).toFixed(1)},${y(p.b.lo).toFixed(1)}`).join(" ") + " Z";
    }
    const eb = earth ? { y1: y(Math.min(earth[1], hi)), y2: y(Math.max(earth[0], lo)) } : null;
    const mi = markIndex ?? values.length - 1;
    return { line, band, eb, mx: x(mi), my: y(values[mi] ?? values[values.length - 1]), ry: reference !== undefined ? y(reference) : null };
  }, [values, bands, earth, reference, width, height, markIndex]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Trend with your personal band" style={{ overflow: "visible" }}>
      {geo.eb && geo.eb.y2 > geo.eb.y1 && <rect x="0" y={geo.eb.y1} width={width} height={geo.eb.y2 - geo.eb.y1} fill="rgba(120,170,255,.06)" stroke="rgba(120,170,255,.18)" strokeDasharray="3 4" />}
      {geo.ry !== null && <line x1="0" x2={width} y1={geo.ry} y2={geo.ry} stroke="var(--watch)" strokeWidth="1.5" strokeDasharray="6 4" opacity=".85" />}
      {geo.band && <path d={geo.band} fill={color} opacity="0.14" />}
      <motion.path key={values.length} d={geo.line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      <circle cx={geo.mx} cy={geo.my} r="4.5" fill={color}><animate attributeName="r" values="4.5;7;4.5" dur="1.8s" repeatCount="indefinite" /></circle>
      <circle cx={geo.mx} cy={geo.my} r="2" fill="#fff" />
    </svg>
  );
}
