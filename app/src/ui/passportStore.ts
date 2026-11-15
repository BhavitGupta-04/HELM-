import { useCallback, useState } from "react";
import { sanitizePassport, type Passport } from "../engine";

const KEY = "helm.earthBaseline.v1";

function load(): Passport {
  try { const raw = localStorage.getItem(KEY); return raw ? sanitizePassport(JSON.parse(raw)) : {}; } catch { return {}; }
}

/** The passport lives only in this browser's local storage. Nothing here talks to a network. */
export function usePassport() {
  const [profile, setProfile] = useState<Passport>(load);
  const save = useCallback((p: Passport) => {
    const clean = sanitizePassport(p);
    setProfile(clean);
    try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* storage blocked: keep in memory only */ }
  }, []);
  const clear = useCallback(() => { setProfile({}); try { localStorage.removeItem(KEY); } catch { /* ignore */ } }, []);
  return { profile, save, clear };
}
