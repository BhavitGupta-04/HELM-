import { describe, it, expect } from "vitest";
import { runValidationSuite } from "../src/engine";

// This test and the Trust & Validation page both call runValidationSuite — the number shown on the page is
// provably the number this test checks, not a claim copied from a log.
describe("validation on simulated missions (30 seeds each)", () => {
  const result = runValidationSuite(30);
  it("false-alarm rate: patterns on calm days stay under 10%", () => {
    console.log(`calm pattern false-alarm days: ${(100 * result.falseAlarmPct).toFixed(1)}%`);
    expect(result.falseAlarmPct).toBeLessThan(0.1);
  });
  for (const c of result.sensitivity) {
    it(`sensitivity: ${c.kind} (moderate-to-severe) is detected as ${c.pattern} in >= ${c.minPct * 100}% of runs`, () => {
      console.log(`${c.kind} detection: ${(100 * c.pct).toFixed(0)}%`);
      expect(c.pct).toBeGreaterThanOrEqual(c.minPct);
    });
  }
  it("a severe infection reaches the critical safety limit on temperature", async () => {
    const { generateMission, assessIndicator } = await import("../src/engine");
    const m = generateMission({ seed: 4, days: 81, env: "mars", events: [{ kind: "infection", start: 77, length: 12, severity: 3.4 }] });
    expect(assessIndicator("temperature", m.temperature.slice(0, 80).map((x) => x.value), m.temperature[80].value).status).toBe("critical");
  });
});
