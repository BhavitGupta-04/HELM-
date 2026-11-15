import { useEffect, useState } from "react";
import { RADLAB_URL, parseRadLab, summarizeRadLab, type RadSummary } from "../engine";
const KEY = "helm.radlab.v1";
type St = "loading" | "live" | "saved" | "offline";
export function RadLabNote() {
  const [sum, setSum] = useState<RadSummary | null>(null), [st, setSt] = useState<St>("loading");
  useEffect(() => {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
    const saved = (): RadSummary | null => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) as RadSummary : null; } catch { return null; } };
    fetch(RADLAB_URL, { signal: ctl.signal }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then((t) => { const s = summarizeRadLab(parseRadLab(t)); if (!s) throw new Error("empty"); setSum(s); setSt("live"); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } })
      .catch(() => { const s = saved(); if (s) { setSum(s); setSt("saved"); } else setSt("offline"); })
      .finally(() => clearTimeout(to));
    return () => { clearTimeout(to); ctl.abort(); };
  }, []);
  return (
    <section className="glass pad" aria-label="Real ISS radiation from NASA RadLab">
      <div style={{ display: "flex", justifyContent: "space-between" }}><div className="eyebrow">Real ISS radiation · NASA RadLab</div>
        <span className="mono" style={{ fontSize: 11, color: st === "live" ? "var(--nominal)" : "var(--muted)" }}>{st === "loading" ? "LOADING" : st.toUpperCase()}</span></div>
      {sum ? (<>
        <div className="mono" style={{ fontSize: 20, margin: "4px 0" }}>{sum.meanUGyPerH.toFixed(1)} <span style={{ fontSize: 12, color: "var(--muted)" }}>µGy/h absorbed · {sum.mGyPerDay.toFixed(2)} mGy/day</span></div>
        <div className="legend">Average of {sum.n} readings from {sum.from} to {sum.to} ({sum.days} days). {Object.entries(sum.byModule).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")} µGy/h. Absorbed dose is not the same as dose equivalent in mSv, which depends on radiation type, so HELM does not convert it. These are station measurements from past years, not the live crew dose.</div>
      </>) : <div className="legend">{st === "loading" ? "Loading…" : "Could not reach NASA RadLab (offline, blocked, or the service is down)."}</div>}
      <div className="legend" style={{ marginTop: 4 }}>Data: NASA Open Science Data Repository (OSDR) RadLab.</div>
    </section>
  );
}
