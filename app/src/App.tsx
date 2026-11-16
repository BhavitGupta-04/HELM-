import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ENVIRONMENTS, HAZARDS, INDICATORS, type Environment, type HazardId, type SystemId } from "./engine";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import { BodyMap } from "./ui/BodyMap";
import { IndicatorCard } from "./ui/IndicatorCard";
import { BlackBox, ChaosDirector, DelayLink, DoseWallet, GhostSelf, HazardRadar, StormOverlay, TriagePanel } from "./ui/Panels";
import { SymptomChecker } from "./ui/SymptomChecker";
import { CarePlan } from "./ui/CarePlan";
import { Starfield } from "./ui/Starfield";
import { CameraPulse } from "./ui/CameraPulse";
import { ReactionTest } from "./ui/ReactionTest";
import { SpaceWeatherPanel } from "./ui/SpaceWeatherPanel";
import { useSpaceWeather } from "./ui/swData";
import { IDS, STATUS_COLOR, useMission } from "./ui/state";
import { PassportDrawer } from "./ui/Passport";
import { TrustDrawer } from "./ui/TrustDrawer";
import { GuidedDemo } from "./ui/GuidedDemo";
import { MissionBriefing, hasSeenBriefing, markBriefingSeen } from "./ui/MissionBriefing";
import { usePassport } from "./ui/passportStore";
import { passportFieldCount } from "./engine";

declare const __APP_VERSION__: string;

const SYSTEM_INFO: Record<SystemId, { title: string; blurb: string }> = {
  brain: { title: "Brain & sleep", blurb: "Sleep, mood and cognition are the first things isolation and a shifted day-night cycle touch." },
  eyes: { title: "Eyes & reflexes", blurb: "Fluid shifts toward the head can change vision. Reaction time is an objective fatigue check." },
  immune: { title: "Immune system", blurb: "Spaceflight changes immune behavior. Temperature is the simplest early warning." },
  lungs: { title: "Lungs & air", blurb: "In a closed habitat, breathing and oxygen saturation are a window into cabin air." },
  heart: { title: "Heart & circulation", blurb: "Without gravity the heart and blood vessels adapt, and some of that adaptation needs watching." },
  gut: { title: "Metabolism", blurb: "Food variety, stress and low activity shift glucose handling." },
  bones: { title: "Bones", blurb: "Bone density falls without load. Tracked through exercise adherence in the Ghost Self forecast." },
  muscle: { title: "Muscle", blurb: "Muscle mass drops quickly without resistance exercise. See the Ghost Self forecast." },
};

export default function App() {
  const passport = usePassport();
  const m = useMission(passport.profile);
  const sw = useSpaceWeather();
  const [passportOpen, setPassportOpen] = useState(false);
  const [trustOpen, setTrustOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(() => !hasSeenBriefing());
  const filled = passportFieldCount(passport.profile);
  const [system, setSystem] = useState<SystemId>("heart");
  const [hazard, setHazard] = useState<HazardId | null>(null);
  const [night, setNight] = useState(false);
  const [extraFlags, setExtraFlags] = useState<SystemId[]>([]);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme = night ? "red" : "dark"; }, [night]);
  const jumpRef = useRef(m.jump); jumpRef.current = m.jump;
  const dayRef = useRef(m.day); dayRef.current = m.day;
  useEffect(() => { if (!playing) return; const id = setInterval(() => jumpRef.current(dayRef.current + 1), 700); return () => clearInterval(id); }, [playing]);

  const ids = IDS.filter((id) => INDICATORS[id].system === system);
  const env = ENVIRONMENTS[m.env];
  const hr = m.assessments.heartRate.value;
  const rcol = m.readiness > 80 ? "var(--nominal)" : m.readiness > 55 ? "var(--watch)" : "var(--critical)";

  return (
    <MotionConfig reducedMotion="user">
      <Starfield warp={m.warp} />
      <main className="app">
        <header className="glass top">
          <div className="brand">
            <svg className="logo" viewBox="0 0 40 40" aria-hidden="true"><motion.circle cx="20" cy="20" r="16" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="60 40" animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "20px 20px" }} /><circle cx="20" cy="20" r="5" fill="var(--accent)" /></svg>
            <div><h1>HELM</h1><small>Health Copilot for when Earth can't answer</small></div>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", justifySelf: "center" }}>
            <div className="seg" role="group" aria-label="Environment">{(Object.keys(ENVIRONMENTS) as Environment[]).map((e) => <button key={e} aria-pressed={m.env === e} onClick={() => m.changeEnv(e)}>{ENVIRONMENTS[e].label.split(" (")[0]}</button>)}</div>
            <DelayLink m={m} />
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}><div className="eyebrow">Crew readiness</div>
              <div style={{ fontSize: 34, fontWeight: 650, color: rcol, lineHeight: 1 }}><AnimatedNumber value={m.readiness} /><span style={{ fontSize: 14, color: "var(--muted)" }}>/100</span></div></div>
            <button className="btn" onClick={() => setBriefingOpen(true)}>Why HELM</button>
            <button className="btn primary" onClick={() => setDemoOpen(true)}>▶ Guided demo</button>
            <button className="btn" onClick={() => setPassportOpen(true)}>Earth baseline{filled > 0 && <span className="pill s-nominal" style={{ padding: "1px 7px" }}>{filled}</span>}</button>
            <button className="btn" onClick={() => setTrustOpen(true)}>Trust &amp; Validation</button>
            <button className="btn" onClick={() => setNight(!night)} aria-pressed={night}>{night ? "Standard light" : "Red night mode"}</button>
          </div>
        </header>

        <div className="grid">
          <div className="col">
            <section className="glass pad">
              <div className="row" style={{ display: "flex", justifyContent: "space-between" }}><span className="eyebrow">Body map · {env.label}</span><span className="legend">{env.gravity}</span></div>
              <BodyMap statuses={m.systemStatus} selected={system} onSelect={setSystem} hazard={hazard} heartBpm={hr} />
            </section>
            <HazardRadar m={m} active={hazard} onPick={setHazard} swLevel={sw.summary.level} />
            <DoseWallet m={m} swLevel={sw.summary?.level} />
          </div>

          <div className="col">
            <motion.section key={system} className="glass pad" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 24 }}>{SYSTEM_INFO[system].title}</h2><span className={`pill s-${m.systemStatus[system]}`}>{m.systemStatus[system]}</span></div>
              <p className="sbar" style={{ margin: "6px 0 0" }}>{SYSTEM_INFO[system].blurb}</p>
              <div className="hazard-row" style={{ marginTop: 8 }}>{(Object.keys(HAZARDS) as HazardId[]).filter((h) => HAZARDS[h].systems.includes(system)).map((h) => <span key={h} className="chip" style={{ color: HAZARDS[h].color, borderColor: `${HAZARDS[h].color}66` }}>{HAZARDS[h].short}</span>)}</div>
            </motion.section>
            {ids.length === 0 ? <section className="glass pad sbar">No direct sensor for this system. Its health is projected in the Ghost Self forecast and driven by exercise adherence.</section> :
              <div className="cards"><AnimatePresence mode="popLayout">{ids.map((id) => <IndicatorCard key={`${m.env}-${id}`} id={id} a={m.assessments[id]} series={m.series[id]} day={m.day} bands={m.bands[id]} reference={m.priors[id]?.center} onLog={(v) => m.logReading(id, v)} />)}</AnimatePresence></div>}
            <SymptomChecker m={m} onSystemFlag={(systems) => setExtraFlags((f) => Array.from(new Set([...f, ...systems])))} onClearFlags={() => setExtraFlags([])} />
            <CarePlan m={m} extraFlags={extraFlags} />
            <ChaosDirector m={m} />
          </div>

          <div className="col">
            <CameraPulse m={m} />
            <ReactionTest m={m} />
            <SpaceWeatherPanel m={m} sw={sw} />
            <TriagePanel m={m} />
            <GhostSelf m={m} />
            <BlackBox m={m} />
          </div>
        </div>

        <footer className="glass timeline">
          <button className="btn primary" onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? "Pause" : "Play mission"}</button>
          <div><input type="range" min={0} max={m.total - 1} value={m.day} onChange={(e) => m.jump(+e.target.value)} aria-label="Mission day" />
            <div className="legend" style={{ display: "flex", justifyContent: "space-between" }}><span>Launch</span><span>{Math.round((m.day / m.total) * 100)}% of mission</span><span>Day {m.total}</span></div></div>
          <div className="mono" style={{ fontSize: 22 }}>Day <AnimatedNumber value={m.day + 1} /></div>
        </footer>
        <p className="legend" style={{ textAlign: "center" }}>HELM is decision support, not a medical diagnosis. Thresholds are prototype values; data shown is simulated. Sources in docs/SOURCES.md. Build v{__APP_VERSION__} · includes Earth Baseline Passport.</p>
      </main>
      <StormOverlay m={m} />
      <PassportDrawer open={passportOpen} profile={passport.profile} onSave={passport.save} onClear={passport.clear} onClose={() => setPassportOpen(false)} />
      <TrustDrawer open={trustOpen} onClose={() => setTrustOpen(false)} />
      <GuidedDemo m={m} open={demoOpen} onClose={() => setDemoOpen(false)} onOpenTrust={() => { setDemoOpen(false); setTrustOpen(true); }} />
      <MissionBriefing
        open={briefingOpen}
        onClose={() => { markBriefingSeen(); setBriefingOpen(false); }}
        onStartDemo={() => { markBriefingSeen(); setBriefingOpen(false); setDemoOpen(true); }}
      />
    </MotionConfig>
  );
}
