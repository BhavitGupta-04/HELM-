import { describe, expect, it } from "vitest";
import { analyzeSymptoms } from "../src/engine/symptoms";

describe("symptom checker (deterministic keyword match)", () => {
  it("matches a fever + racing heart to infection and cardio-strain", () => {
    const r = analyzeSymptoms("I have a fever and my heart is racing");
    const kinds = r.matches.map((m) => m.kind);
    expect(kinds).toContain("infection");
    expect(kinds).toContain("cardio-strain");
    expect(r.unrecognized).toBe(false);
  });

  it("picks up a severe intensity word", () => {
    const r = analyzeSymptoms("severe headache and foggy thinking");
    expect(r.matches.find((m) => m.kind === "cabin-co2")?.severity).toBe("severe");
  });

  it("picks up a mild intensity word, defaults to moderate otherwise", () => {
    expect(analyzeSymptoms("mild headache").matches[0].severity).toBe("mild");
    expect(analyzeSymptoms("can't sleep at all").matches[0].severity).toBe("moderate");
  });

  it("flags bone/muscle complaints as system flags, not mission events", () => {
    const r = analyzeSymptoms("my bones ache and my muscles feel weak");
    expect(r.matches.length).toBe(0);
    const systems = r.systemFlags.map((f) => f.system);
    expect(systems).toContain("bones");
    expect(systems).toContain("muscle");
  });

  it("reports unrecognized text honestly instead of guessing", () => {
    const r = analyzeSymptoms("my favorite color is blue");
    expect(r.matches.length).toBe(0);
    expect(r.systemFlags.length).toBe(0);
    expect(r.unrecognized).toBe(true);
  });

  it("empty input is not reported as unrecognized", () => {
    expect(analyzeSymptoms("   ").unrecognized).toBe(false);
  });
});
