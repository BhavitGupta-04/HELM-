  import { describe, it, expect } from "vitest";
import {
  median, mad, conformalQuantile, personalInterval, assessIndicator, detectPatterns, triage,
  generateMission, buildSbar, encodePacket, decodePacket, Ledger, INDICATORS, cumulativeDose, ENVIRONMENTS,
  boneLossPct, muscleLossPct, mulberry32, nextDay, daysUntilLimit, liveDoseRate, SW_DOSE_MULTIPLIER,
} from "../src/engine";
import type { IndicatorId, Assessment } from "../src/engine";

const ids = Object.keys(INDICATORS) as IndicatorId[];

describe("baseline math", () => {
  it("median and mad", () => { expect(median([3, 1, 2])).toBe(2); expect(median([1, 2, 3, 4])).toBe(2.5); expect(mad([1, 1, 1, 1])).toBe(0); });
  it("conformal quantile is finite-sample corrected", () => {
    expect(conformalQuantile([1, 2, 3, 4, 5, 6, 7, 8], 0.1)).toBe(Infinity); // 8 points cannot give 90% coverage
    expect(conformalQuantile([1, 2, 3, 4, 5, 6, 7, 8, 9], 0.1)).toBe(9); // 9 points is the minimum
    expect(conformalQuantile(Array.from({ length: 19 }, (_, i) => i + 1), 0.1)).toBe(18);
  });
  it("returns null interval until enough history", () => { expect(personalInterval([1, 2, 3], 1)).toBeNull(); });
  it("achieves roughly nominal empirical coverage on stationary noise (property test)", () => {
    const r = mulberry32(7); const g = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
    const series = Array.from({ length: 600 }, () => 60 + 3 * g());
    let hit = 0, tot = 0;
    for (let t = 60; t < series.length; t++) {
      const iv = personalInterval(series.slice(0, t), 0.5, { alpha: 0.1 });
      if (!iv) continue; tot++; if (series[t] >= iv.lo && series[t] <= iv.hi) hit++;
    }
    expect(hit / tot).toBeGreaterThan(0.85);
    expect(hit / tot).toBeLessThan(0.97);
  });
});

describe("assessment", () => {
  const calm = generateMission({ seed: 1, days: 40, env: "station" });
  it("calm mission has mostly nominal days", () => {
    let bad = 0, tot = 0;
    for (const id of ids) for (let d = 20; d < 40; d++) {
      const a = assessIndicator(id, calm[id].slice(0, d).map((x) => x.value), calm[id][d].value); tot++; if (a.status !== "nominal") bad++;
    }
    expect(bad / tot).toBeLessThan(0.2);
  });
  it("hard limits override statistics", () => {
    const hist = Array(20).fill(36.8);
    const a = assessIndicator("temperature", hist, 39.0);
    expect(a.status).toBe("critical"); expect(a.hardLimit).toBe(true);
  });
  it("a value that is normal for Earth but surprising for YOU is flagged", () => {
    const hist = Array.from({ length: 25 }, (_, i) => 52 + (i % 3) * 0.5); // athlete with very low resting HR
    const a = assessIndicator("heartRate", hist, 78); // 78 is normal on Earth
    expect(a.status).not.toBe("nominal");
  });
  it("direction matters: high sleep is not harmful", () => {
    const hist = Array.from({ length: 25 }, (_, i) => 6.5 + (i % 3) * 0.2);
    expect(assessIndicator("sleep", hist, 8.9).status).toBe("nominal");
  });
  it("calibrating phase is explicit", () => {
    const a = assessIndicator("heartRate", [60, 61], 62); expect(a.interval).toBeNull(); expect(a.reasons[0]).toMatch(/Calibrating/);
  });
  it("persistence escalates severity", () => {
    const hist = [...Array.from({ length: 25 }, (_, i) => 60 + (i % 3)), 80, 81];
    const a = assessIndicator("heartRate", hist, 82);
    expect(["caution", "critical"]).toContain(a.status);
  });
});

function mk(events: Parameters<typeof generateMission>[0]["events"], env = "station" as const) {
  const m = generateMission({ seed: 3, days: 60, env, events });
  const out: Partial<Record<IndicatorId, Assessment>> = {};
  for (const id of ids) out[id] = assessIndicator(id, m[id].slice(0, 55).map((x) => x.value), m[id][55].value);
  return out;
}

describe("multi-signal fusion", () => {
  it("detects infection from injected event", () => {
    const p = detectPatterns(mk([{ kind: "infection", start: 50, length: 10, severity: 1.5 }]));
    expect(p.map((x) => x.id)).toContain("infection");
  });
  it("detects cabin air problem", () => {
    const p = detectPatterns(mk([{ kind: "cabin-co2", start: 50, length: 10, severity: 1.5 }]));
    expect(p.map((x) => x.id)).toContain("cabin-air");
  });
  it("is specific: a severe infection does not also claim cabin-air or burnout", () => {
    const ids2 = detectPatterns(mk([{ kind: "infection", start: 50, length: 10, severity: 3.4 }])).map((x) => x.id);
    expect(ids2).toContain("infection"); expect(ids2).not.toContain("cabin-air"); expect(ids2).not.toContain("cardio-strain");
  });
  it("no false patterns on a calm mission", () => {
    const p = detectPatterns(mk([]));
    expect(p.length).toBe(0);
  });
});

describe("delay-aware triage", () => {
  it("critical always means act now and transmit in parallel", () => {
    const t = triage("critical", 720); expect(t.route).toBe("emergency"); expect(t.transmitNow).toBe(true);
  });
  it("caution on Mars means onboard first", () => { expect(triage("caution", 720).route).toBe("onboard-then-queue"); });
  it("caution on the station allows a live consult", () => { expect(triage("caution", 0.5).route).toBe("queue-live"); });
  it("ground advice ETA grows with delay", () => {
    expect(triage("caution", 720).groundAdviceEtaSec!).toBeGreaterThan(triage("caution", 1.3).groundAdviceEtaSec!);
  });
  it("watch is only logged", () => { expect(triage("watch", 720).transmitNow).toBe(false); });
});

describe("SBAR packets", () => {
  const a = mk([{ kind: "infection", start: 50, length: 10, severity: 1.5 }]);
  const input = { crewId: "CDR", missionDay: 55, environment: "station", assessments: Object.values(a) as Assessment[], patterns: detectPatterns(a) };
  it("builds all four sections", () => { const s = buildSbar(input); expect(s.situation).toBeTruthy(); expect(s.recommendation).toBeTruthy(); });
  it("round-trips through the compact packet", () => {
    const p = decodePacket(encodePacket(input)); expect(p?.c).toBe("CDR"); expect(p?.d).toBe(55); expect(p?.p).toContain("infection");
  });
  it("detects corruption with the checksum", () => {
    const s = encodePacket(input); const bad = s.slice(0, 5) + (s[5] === "A" ? "B" : "A") + s.slice(6);
    expect(decodePacket(bad)).toBeNull();
  });
});

describe("black-box ledger", () => {
  it("verifies an untouched chain and catches tampering", async () => {
    const l = new Ledger();
    for (let i = 0; i < 6; i++) await l.append("reading", { i, v: 60 + i }, 1000 + i);
    expect(await l.verify()).toBe(-1);
    const copy = JSON.parse(JSON.stringify(l.entries)); copy[3].payload.v = 999;
    expect(await l.verify(copy)).toBe(3);
  });
});

describe("mission simulation", () => {
  it("is deterministic for a seed", () => {
    expect(generateMission({ seed: 5, days: 10, env: "mars" }).heartRate).toEqual(generateMission({ seed: 5, days: 10, env: "mars" }).heartRate);
  });
  it("extending a mission never rewrites earlier days", () => {
    const a = generateMission({ seed: 9, days: 20, env: "lunar" }); const b = nextDay(a, "lunar", 200, [], 9);
    for (const id of ids) expect(b[id].slice(0, 20)).toEqual(a[id]);
    expect(b.heartRate.length).toBe(21);
  });
  it("all values stay in plausible range", () => {
    const m = generateMission({ seed: 2, days: 300, env: "mars", events: [{ kind: "infection", start: 100, length: 20, severity: 3 }] });
    for (const id of ids) for (const r of m[id]) { expect(r.value).toBeGreaterThanOrEqual(INDICATORS[id].plausible[0]); expect(r.value).toBeLessThanOrEqual(INDICATORS[id].plausible[1]); }
  });
});

describe("radiation and forecasts", () => {
  it("dose accumulates and a solar storm adds to it", () => {
    const base = cumulativeDose("mars", 100); const storm = cumulativeDose("mars", 100, { start: 40, end: 42, extra: 20 });
    expect(storm - base).toBeCloseTo(60, 5);
  });
  it("Mars transit reaches the career limit eventually", () => { expect(daysUntilLimit("mars", 0)).toBeLessThan(400); expect(ENVIRONMENTS.mars.doseRate).toBeGreaterThan(ENVIRONMENTS.station.doseRate); });
  it("live NASA space weather level scales today's dose rate and shrinks the remaining budget", () => {
    expect(liveDoseRate("station", "quiet")).toBeCloseTo(ENVIRONMENTS.station.doseRate, 5);
    expect(liveDoseRate("station", "storm")).toBeCloseTo(ENVIRONMENTS.station.doseRate * SW_DOSE_MULTIPLIER.storm, 5);
    expect(liveDoseRate("station", "storm")).toBeGreaterThan(liveDoseRate("station", "elevated"));
    expect(liveDoseRate("station", "elevated")).toBeGreaterThan(liveDoseRate("station", "active"));
    expect(liveDoseRate("station", "active")).toBeGreaterThan(liveDoseRate("station", "quiet"));
    // a storm leaves less budget (fewer days) than quiet conditions, for the same accumulated dose
    expect(daysUntilLimit("station", 100, "storm")).toBeLessThan(daysUntilLimit("station", 100, "quiet"));
  });
  it("exercise adherence reduces projected bone and muscle loss", () => {
    expect(boneLossPct(180, 1)).toBeLessThan(boneLossPct(180, 0)); expect(muscleLossPct(30, 1)).toBeLessThan(muscleLossPct(30, 0));
    expect(boneLossPct(0, 0)).toBe(0);
  });
});
