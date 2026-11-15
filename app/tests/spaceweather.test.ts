import { describe, it, expect } from "vitest";
import { parseFlares, parseSep, parseCme, dedupeSort, summarize, flareSeverity, sanitizeApiKey, donkiUrl } from "../src/engine";

// Payload shapes follow the public DONKI documentation (flrID/classType/peakTime, sepID/eventTime, activityID/startTime/cmeAnalyses).
const NOW = Date.parse("2026-11-13T12:00:00Z");
const flare = (id: string, cls: string, t: string) => ({ flrID: id, classType: cls, peakTime: t, beginTime: t, sourceLocation: "N10W20" });

describe("DONKI parsing", () => {
  it("maps flare class to severity", () => {
    expect(flareSeverity("X1.2")).toBe("strong"); expect(flareSeverity("M5.0")).toBe("moderate"); expect(flareSeverity("C3")).toBe("minor"); expect(flareSeverity("Z9")).toBeNull();
  });
  it("parses flares, skipping malformed rows", () => {
    const out = parseFlares([flare("a", "X2.0", "2026-11-13T05:00Z"), { flrID: "b" }, null, "x", flare("c", "weird", "2026-11-13T05:00Z"), { classType: "M1", peakTime: "2026-11-13T05:00Z" }]);
    expect(out.map((e) => e.id)).toEqual(["a"]); expect(out[0].title).toBe("X2.0 solar flare");
  });
  it("parses SEP and CME events, using the fastest CME analysis speed", () => {
    expect(parseSep([{ sepID: "s1", eventTime: "2026-11-12T10:00Z" }])[0].severity).toBe("strong");
    const cme = parseCme([{ activityID: "c1", startTime: "2026-11-12T10:00Z", cmeAnalyses: [{ speed: 600 }, { speed: 1700 }] }, { activityID: "c2", startTime: "2026-11-12T11:00Z" }]);
    expect(cme[0].severity).toBe("strong"); expect(cme[0].title).toMatch(/1700 km\/s/); expect(cme[1].severity).toBe("minor");
  });
  it("never throws on junk input", () => {
    for (const bad of [undefined, null, 5, "x", {}, [[]], [{}]]) { expect(parseFlares(bad)).toEqual([]); expect(parseSep(bad)).toEqual([]); expect(parseCme(bad)).toEqual([]); }
  });
  it("dedupes and sorts newest first", () => {
    const s = dedupeSort([...parseFlares([flare("a", "M1", "2026-11-10T00:00Z"), flare("b", "M2", "2026-11-12T00:00Z"), flare("a", "M1", "2026-11-10T00:00Z")])]);
    expect(s.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("space-weather summary", () => {
  const ev = (arr: ReturnType<typeof parseFlares>) => summarize(arr, NOW);
  it("quiet when nothing recent", () => { expect(ev(parseFlares([flare("a", "X5", "2026-11-01T00:00Z")])).level).toBe("quiet"); });
  it("active for a recent M flare", () => { expect(ev(parseFlares([flare("a", "M3", "2026-11-13T00:00Z")])).level).toBe("active"); });
  it("elevated for a recent X flare", () => { expect(ev(parseFlares([flare("a", "X1", "2026-11-12T20:00Z")])).level).toBe("elevated"); });
  it("storm when a particle event is recent, and it outranks flares", () => {
    const all = [...parseFlares([flare("a", "M3", "2026-11-13T00:00Z")]), ...parseSep([{ sepID: "s", eventTime: "2026-11-12T22:00Z" }])];
    expect(summarize(all, NOW).level).toBe("storm");
  });
  it("counts events by kind", () => { expect(ev(parseFlares([flare("a", "C1", "2026-11-01T00:00Z"), flare("b", "C2", "2026-11-02T00:00Z")])).counts.FLR).toBe(2); });
});

describe("API helpers", () => {
  it("accepts plausible keys only", () => { expect(sanitizeApiKey("DEMO_KEY")).toBeNull(); expect(sanitizeApiKey("abcDEF1234567890")).toBe("abcDEF1234567890"); expect(sanitizeApiKey("bad key!")).toBeNull(); });
  it("builds a 30-day DONKI URL with an encoded key", () => {
    const u = donkiUrl("FLR", NOW, 30, "k&x=1");
    expect(u).toContain("/DONKI/FLR?startDate=2026-10-14&endDate=2026-11-13"); expect(u).toContain("api_key=k%26x%3D1");
  });
});
