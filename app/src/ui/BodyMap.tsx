import { motion } from "framer-motion";
import { HAZARDS, type HazardId, type Status, type SystemId } from "../engine";
import { STATUS_COLOR } from "./state";

const NODES: { id: SystemId; x: number; y: number; label: string; lx: number }[] = [
  { id: "brain", x: 150, y: 34, label: "Brain & sleep", lx: 190 },
  { id: "eyes", x: 150, y: 62, label: "Eyes & reflexes", lx: 190 },
  { id: "immune", x: 150, y: 116, label: "Immune", lx: 190 },
  { id: "lungs", x: 116, y: 166, label: "Lungs", lx: 30 },
  { id: "heart", x: 164, y: 192, label: "Heart", lx: 196 },
  { id: "gut", x: 150, y: 262, label: "Metabolism", lx: 196 },
  { id: "bones", x: 150, y: 332, label: "Bones", lx: 196 },
  { id: "muscle", x: 112, y: 420, label: "Muscle", lx: 22 },
];

interface Props { statuses: Record<SystemId, Status>; selected: SystemId; onSelect: (s: SystemId) => void; hazard: HazardId | null; heartBpm: number }

export function BodyMap({ statuses, selected, onSelect, hazard, heartBpm }: Props) {
  const hz = hazard ? HAZARDS[hazard] : null;
  const beat = 60 / Math.max(40, Math.min(150, heartBpm));
  return (
    <div className="body-wrap">
      <svg className="body-svg" viewBox="0 0 300 620" role="group" aria-label="Interactive body map. Select a body system.">
        <defs>
          <linearGradient id="bodyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6fe9ff" stopOpacity=".55" /><stop offset="1" stopColor="#7a6bff" stopOpacity=".18" /></linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <clipPath id="bodyClip"><ellipse cx="150" cy="46" rx="25" ry="31" /><rect x="138" y="72" width="24" height="40" /><path d="M96 112 Q150 98 204 112 L214 150 Q212 240 196 300 L190 332 Q150 348 110 332 L104 300 Q88 240 86 150 Z" />
            <path d="M92 124 L62 214 L56 292" stroke="#000" strokeWidth="24" fill="none" /><path d="M208 124 L238 214 L244 292" stroke="#000" strokeWidth="24" fill="none" />
            <path d="M130 336 L122 452 L120 596" stroke="#000" strokeWidth="32" fill="none" /><path d="M170 336 L178 452 L180 596" stroke="#000" strokeWidth="32" fill="none" /></clipPath>
        </defs>
        {/* hologram body */}
        <g pointerEvents="none" fill="url(#bodyG)" stroke="rgba(130,230,255,.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" opacity=".92">
          <ellipse cx="150" cy="46" rx="25" ry="31" /><rect x="140" y="72" width="20" height="38" rx="6" />
          <path d="M96 112 Q150 98 204 112 L214 150 Q212 240 196 300 L190 332 Q150 348 110 332 L104 300 Q88 240 86 150 Z" />
          <g fill="none" strokeWidth="22" stroke="rgba(130,230,255,.28)"><path d="M92 126 L62 214 L56 292" /><path d="M208 126 L238 214 L244 292" /></g>
          <g fill="none" strokeWidth="32" stroke="rgba(130,230,255,.24)"><path d="M130 338 L122 452 L120 596" /><path d="M170 338 L178 452 L180 596" /></g>
        </g>
        {/* anatomy hints */}
        <g pointerEvents="none" fill="none" stroke="rgba(160,240,255,.35)" strokeWidth="1">
          <path d="M150 112 L150 318" strokeDasharray="2 5" />
          {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${128 - i * 0.5} ${140 + i * 14} Q150 ${134 + i * 14} ${172 + i * 0.5} ${140 + i * 14}`} opacity={0.5} />)}
          <path d="M126 150 Q108 160 112 196 Q124 204 140 196 Q142 168 126 150 Z" /><path d="M174 150 Q192 160 188 196 Q176 204 160 196 Q158 168 174 150 Z" opacity=".0" />
        </g>
        {/* scanning beam */}
        <g pointerEvents="none" clipPath="url(#bodyClip)"><motion.rect x="40" width="220" height="46" fill="url(#scanG)" initial={{ y: -40 }} animate={{ y: 600 }} transition={{ duration: 4.2, repeat: Infinity, ease: "linear" }} />
          <defs><linearGradient id="scanG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#00e5c3" stopOpacity="0" /><stop offset=".85" stopColor="#00e5c3" stopOpacity=".45" /><stop offset="1" stopColor="#d9fff8" stopOpacity=".9" /></linearGradient></defs></g>
        {/* nodes */}
        {NODES.map((n) => {
          const st = statuses[n.id]; const col = STATUS_COLOR[st]; const sel = selected === n.id;
          const hit = hz?.systems.includes(n.id);
          const urgent = st === "caution" || st === "critical";
          return (
            <g key={n.id} className="node" tabIndex={0} role="button" aria-label={`${n.label}: ${st}`} aria-pressed={sel}
              onClick={() => onSelect(n.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(n.id)}>
              {hit && <motion.circle cx={n.x} cy={n.y} r={20} fill="none" stroke={hz!.color} strokeWidth="2" strokeDasharray="3 4"
                animate={{ rotate: 360, scale: [1, 1.15, 1] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: `${n.x}px ${n.y}px` }} />}
              <motion.circle cx={n.x} cy={n.y} r={9} fill={col} opacity={0.22}
                animate={{ r: urgent ? [9, 22, 9] : sel ? [9, 16, 9] : [9, 12, 9], opacity: [0.35, 0.05, 0.35] }}
                transition={{ duration: n.id === "heart" ? beat : urgent ? 1.1 : 2.8, repeat: Infinity, ease: "easeInOut" }} />
              <motion.circle className="node-core" cx={n.x} cy={n.y} r={sel ? 8 : 6} fill={col} stroke="#04101a" strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 7px ${col})` }}
                whileHover={{ scale: 1.5 }} animate={n.id === "heart" ? { scale: [1, 1.28, 1, 1.14, 1] } : {}} transition={n.id === "heart" ? { duration: beat, repeat: Infinity } : { type: "spring" }} />
              <rect x={n.lx > n.x ? n.x - 22 : n.lx - 6} y={n.y - 16} width={n.lx > n.x ? n.lx - n.x + 112 : n.x - n.lx + 30} height="32" rx="10" fill="transparent" />
              {sel && <motion.circle layoutId="selring" cx={n.x} cy={n.y} r={15} fill="none" stroke="#fff" strokeWidth="1.4" />}
              <text className="node-label" x={n.lx} y={n.y + 4} textAnchor={n.lx < n.x ? "start" : "start"}>{n.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
