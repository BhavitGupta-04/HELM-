import { useCallback, useEffect, useRef, useState } from "react";
import { dedupeSort, donkiUrl, parseCme, parseFlares, parseSep, sanitizeApiKey, summarize, type SwEvent, type SwKind } from "../engine";

const CACHE = "helm.swCache.v1", KEYSTORE = "helm.nasaKey";
const FRESH_MS = 30 * 60_000, COOLDOWN_MS = 60_000, TIMEOUT_MS = 12_000, DAYS = 30;
export type SwStatus = "idle" | "loading" | "live" | "cached" | "offline";

const read = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : null; } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage may be blocked */ } };

async function fetchKind(kind: SwKind, key: string): Promise<SwEvent[]> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(donkiUrl(kind, Date.now(), DAYS, key), { signal: ctl.signal });
    if (r.status === 429) throw new Error("rate-limit");
    if (!r.ok) throw new Error(`http-${r.status}`);
    const j: unknown = await r.json();
    return kind === "FLR" ? parseFlares(j) : kind === "SEP" ? parseSep(j) : parseCme(j);
  } finally { clearTimeout(t); }
}

export function useSpaceWeather() {
  const [events, setEvents] = useState<SwEvent[]>([]);
  const [status, setStatus] = useState<SwStatus>("idle");
  const [updated, setUpdated] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [apiKey, setKeyState] = useState<string>(() => read<string>(KEYSTORE) ?? "");
  const last = useRef(0);

  const refresh = useCallback(async (force = false) => {
    const cached = read<{ at: number; events: SwEvent[] }>(CACHE);
    if (!force && cached && Date.now() - cached.at < FRESH_MS) { setEvents(cached.events); setUpdated(cached.at); setStatus("cached"); setMessage("Saved data is less than 30 minutes old."); return; }
    if (Date.now() - last.current < COOLDOWN_MS) return;
    last.current = Date.now(); setStatus("loading"); setMessage("");
    const key = sanitizeApiKey(apiKey) ?? "DEMO_KEY";
    const kinds: SwKind[] = ["FLR", "SEP", "CME"];
    const res = await Promise.allSettled(kinds.map((k) => fetchKind(k, key)));
    const ok = res.filter((r): r is PromiseFulfilledResult<SwEvent[]> => r.status === "fulfilled");
    if (ok.length === 0) {
      const why = res.map((r) => (r.status === "rejected" ? String((r.reason as Error)?.message ?? r.reason) : ""));
      setMessage(why.includes("rate-limit") ? "NASA's shared public demo key is rate-limited (it's shared by everyone who hasn't added their own) — showing the most recent real data fetched. A free personal key (nasa.gov/api, instant) unlocks live refresh." : "Could not reach NASA DONKI (offline, blocked, or the service is down).");
      if (cached) { setEvents(cached.events); setUpdated(cached.at); setStatus("cached"); } else setStatus("offline");
      return;
    }
    const merged = dedupeSort(ok.flatMap((r) => r.value));
    const at = Date.now(); write(CACHE, { at, events: merged });
    setEvents(merged); setUpdated(at); setStatus("live");
    if (ok.length < kinds.length) setMessage("Some event types could not be loaded. Showing what NASA returned.");
  }, [apiKey]);

  useEffect(() => { void refresh(false); }, [refresh]);
  const setApiKey = useCallback((k: string) => { const c = sanitizeApiKey(k); if (c) { write(KEYSTORE, c); setKeyState(c); last.current = 0; return true; } return false; }, []);
  const clearApiKey = useCallback(() => { try { localStorage.removeItem(KEYSTORE); } catch { /* ignore */ } setKeyState(""); }, []);
  const summary = summarize(events, Date.now());
  return { events, status, updated, message, summary, refresh, apiKey, setApiKey, clearApiKey };
}
