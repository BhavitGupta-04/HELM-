import { useState } from "react";
import { motion } from "framer-motion";
import type { SwEvent } from "../engine";
import type { Mission } from "./state";
import type { useSpaceWeather } from "./swData";

type SW = ReturnType<typeof useSpaceWeather>;
const LEVEL_COLOR = { quiet: "var(--nominal)", active: "var(--watch)", elevated: "var(--caution)", storm: "var(--critical)" } as const;
const STATUS_TEXT = { idle: "…", loading: "LOADING", live: "LIVE", cached: "CACHED", offline: "OFFLINE" } as const;
const when = (t: string) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function SpaceWeatherPanel({ m, sw }: { m: Mission; sw: SW }) {
  const [key, setKey] = useState(""), [keyMsg, setKeyMsg] = useState("");
  const col = LEVEL_COLOR[sw.summary.level];
  const shown = sw.events.slice(0, 6);
  return (
    <section className="glass panel" aria-label="Real space weather from NASA DONKI">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="eyebrow">Real space weather · NASA DONKI</div>
        <span className="mono" style={{ fontSize: 11, color: sw.status === "live" ? "var(--nominal)" : "var(--muted)" }}>{STATUS_TEXT[sw.status]}</span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "8px 0" }}>
        <motion.span style={{ width: 12, height: 12, borderRadius: 12, background: col, flex: "none" }} animate={{ boxShadow: [`0 0 4px ${col}`, `0 0 16px ${col}`, `0 0 4px ${col}`] }} transition={{ duration: 2, repeat: Infinity }} />
        <div><strong>{sw.status === "offline" ? "No data" : sw.summary.headline}</strong>
          {sw.status !== "offline" && <div className="legend">{sw.summary.reason} HELM's own rule of thumb, not an official NASA alert.</div>}</div>
      </div>
      {sw.message && <div className="legend" role="status" style={{ color: sw.status === "offline" ? "var(--watch)" : "var(--accent2)" }}>{sw.message}</div>}
      {sw.status === "cached" && <div className="legend" style={{ marginTop: 2 }}>This still shapes live numbers below (dose rate, hazard load) — it's the last real NASA feed pulled, not a placeholder.</div>}
      {shown.length > 0 && <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{shown.map((e: SwEvent) => (
        <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13 }}>{e.title}<span className="legend"> · {when(e.time)}</span></span>
          <button className="btn" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => m.replay(e)}>Replay</button>
        </div>))}</div>}
      <div className="legend" style={{ marginTop: 8 }}>Replay runs a real event through the demo crew. The crew's body response is simulated.</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => void sw.refresh(true)} disabled={sw.status === "loading"}>Refresh</button>
        <input aria-label="NASA API key" placeholder={sw.apiKey ? "Key saved on this device" : "Optional free NASA API key"} value={key} onChange={(e) => setKey(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
        <button className="btn" onClick={() => { if (sw.setApiKey(key)) { setKey(""); setKeyMsg("Key saved on this device."); } else setKeyMsg("That does not look like a NASA key."); }}>Save key</button>
        {sw.apiKey && <button className="btn" onClick={() => { sw.clearApiKey(); setKeyMsg("Key removed."); }}>Remove</button>}
      </div>
      {keyMsg && <div className="legend" role="status">{keyMsg}</div>}
      <div className="legend" style={{ marginTop: 6 }}>Data: NASA DONKI (CCMC). {sw.updated ? `Updated ${new Date(sw.updated).toLocaleTimeString()}.` : ""} Last 30 days.</div>
    </section>
  );
}
