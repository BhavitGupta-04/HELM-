import { describe, it, expect } from "vitest";
import { projectDrift, describeDrift } from "../src/engine/drift";
import type { Interval } from "../src/engine/types";

const band = (lo: number, hi: number): Interval => ({ lo, hi, center: (lo + hi) / 2, n: 10, alpha: 0.05 });

describe("projectDrift", () => {
  it("projects a sane time-to-edge for a clearly trending series", () => {
    // HRV sliding down steadily, band is 40-70, direction "down" is harmful.
    const history = [60, 58, 56, 54, 52, 50, 48, 46];
    const p = projectDrift(history, band(40, 70), "down");
    expect(p).not.toBeNull();
    expect(p!.edge).toBe("lo");
    expect(p!.daysToEdge).toBeGreaterThan(0);
    expect(p!.daysToEdge).toBeLessThanOrEqual(14);
    expect(describeDrift(p!)).toMatch(/exits your band/);
  });

  it("returns null for a flat, noisy series", () => {
    const history = [60, 61, 59, 60.5, 59.5, 60, 60.2, 59.8];
    expect(projectDrift(history, band(40, 70), "down")).toBeNull();
  });

  it("returns null when the trend moves away from the harmful edge", () => {
    // direction "down" means low is harmful; this series is climbing, away from the low edge.
    const history = [50, 52, 54, 56, 58, 60, 62, 64];
    expect(projectDrift(history, band(40, 70), "down")).toBeNull();
  });

  it("returns null with fewer than 5 points of history", () => {
    const history = [60, 58, 56, 54];
    expect(projectDrift(history, band(40, 70), "down")).toBeNull();
  });

  it("returns null without a personal interval yet", () => {
    const history = [60, 58, 56, 54, 52, 50];
    expect(projectDrift(history, null, "down")).toBeNull();
  });

  it("picks the edge the trend is heading toward for an 'either' direction indicator", () => {
    const rising = [70, 72, 74, 76, 78, 80];
    const p = projectDrift(rising, band(60, 100), "either");
    expect(p).not.toBeNull();
    expect(p!.edge).toBe("hi");
  });

  it("does not project more than 14 days out", () => {
    // Very slow drift relative to a wide band: projection would be far beyond the 14-day cap.
    const history = [100, 100.2, 100.4, 100.6, 100.8, 101, 101.2, 101.4];
    expect(projectDrift(history, band(50, 200), "up")).toBeNull();
  });
});

describe("describeDrift", () => {
  it("formats sub-day projections in hours", () => {
    expect(describeDrift({ daysToEdge: 0.5, slopePerDay: -1, edge: "lo" })).toMatch(/\d+h/);
  });
  it("formats multi-day projections in whole days", () => {
    expect(describeDrift({ daysToEdge: 3.4, slopePerDay: -1, edge: "lo" })).toMatch(/3 days/);
  });
  it("uses singular 'day' for exactly one day", () => {
    expect(describeDrift({ daysToEdge: 1, slopePerDay: -1, edge: "lo" })).toMatch(/1 day\b/);
  });
});
