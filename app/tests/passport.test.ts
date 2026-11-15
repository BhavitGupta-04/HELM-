import { describe, it, expect } from "vitest";
import { sanitizePassport, priorsFor, notesForReport, passportFieldCount, assessIndicator, buildSbar, encodePacket } from "../src/engine";

describe("Earth Baseline Passport", () => {
  it("drops unknown fields, out-of-range numbers and wrong types", () => {
    const p = sanitizePassport({ restingHr: 48, age: 7, systolic: "120", hacker: "x", fitness: "god", allergies: "  penicillin  ", glucose: 9999 });
    expect(p).toEqual({ restingHr: 48, allergies: "penicillin" });
  });
  it("handles junk input safely", () => { expect(sanitizePassport(null)).toEqual({}); expect(sanitizePassport("x")).toEqual({}); expect(sanitizePassport([1, 2])).toEqual({}); });
  it("caps note length", () => { expect(sanitizePassport({ conditions: "a".repeat(1000) }).conditions!.length).toBe(300); });
  it("an athlete's Earth baseline stops a normal-for-them heart rate being flagged on day one", () => {
    const generic = assessIndicator("heartRate", [], 49);
    const withPrior = assessIndicator("heartRate", [], 49, priorsFor({ restingHr: 50 }).heartRate);
    expect(generic.status).not.toBe("nominal");
    expect(withPrior.status).toBe("nominal"); expect(withPrior.usedPrior).toBe(true);
  });
  it("a value far from the person's own baseline is still flagged on day one", () => {
    expect(assessIndicator("heartRate", [], 92, priorsFor({ restingHr: 50 }).heartRate).status).not.toBe("nominal");
  });
  it("hard safety limits never move, even with a baseline", () => {
    const a = assessIndicator("heartRate", [], 140, { center: 130, half: 20 });
    expect(a.status).toBe("critical"); expect(a.hardLimit).toBe(true);
  });
  it("space history takes over once there is enough of it", () => {
    const hist = Array.from({ length: 30 }, (_, i) => 70 + (i % 3));
    const a = assessIndicator("heartRate", hist, 71, { center: 50, half: 6 });
    expect(a.usedPrior).toBeFalsy(); expect(a.status).toBe("nominal");
  });
  it("fitness alone gives a heart-rate prior; average gives none", () => {
    expect(priorsFor({ fitness: "athlete" }).heartRate?.center).toBe(52);
    expect(priorsFor({ fitness: "average" }).heartRate).toBeUndefined();
  });
  it("notes reach the report only when the person opts in", () => {
    const p = { allergies: "penicillin", medications: "lisinopril" };
    expect(notesForReport(p)).toBeUndefined();
    const text = notesForReport({ ...p, includeNotesInReport: true })!;
    expect(text).toMatch(/penicillin/); expect(text).toMatch(/not a verified record/);
    const input = { crewId: "C", missionDay: 1, environment: "x", assessments: [], patterns: [], notes: text };
    expect(buildSbar(input).background).toMatch(/penicillin/);
    expect(encodePacket(input)).not.toMatch(/penicillin/); // the compact packet never carries notes
  });
  it("counts filled fields", () => { expect(passportFieldCount({ age: 30, restingHr: 55, allergies: "x", includeNotesInReport: true })).toBe(3); });
});
