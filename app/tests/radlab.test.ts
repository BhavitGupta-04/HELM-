import { describe, it, expect } from "vitest";
import { parseRadLab, summarizeRadLab } from "../src/engine";
// Shape copied from a real RadLab response: quoted TSV with header timestamp, instrument_id, absorbed_dose_rate, instrument_family, module.
const TSV = ['timestamp\tinstrument_id\tabsorbed_dose_rate\tinstrument_family\tmodule',
  '"2019-12-05T00:00:00"\t"REM-JPM1FD4-pre"\t17.2966666666666\t"Timepix"\t"JPM"',
  '"2019-12-05T00:00:00"\t"REM-CUPSSC17-pre"\t13.5795833333333\t"Timepix"\t"Cupola"',
  '"2019-12-06T00:00:00"\t"REM-JPM1FD4-pre"\t17.4441666666666\t"Timepix"\t"JPM"'].join("\n");
describe("RadLab", () => {
  it("parses quoted TSV", () => { const s = parseRadLab(TSV); expect(s).toHaveLength(3); expect(s[1].module).toBe("Cupola"); expect(s[0].absorbedUGyPerH).toBeCloseTo(17.2967, 3); });
  it("parses a JSON array too", () => { expect(parseRadLab('[{"timestamp":"2019-12-05T00:00:00","absorbed_dose_rate":12,"module":"JPM"}]')).toHaveLength(1); });
  it("skips bad rows and never throws", () => { for (const b of ["", "x", "[", "a\tb\n1\t2", 'timestamp\tabsorbed_dose_rate\nnope\t5\n"2019-01-01"\t-3\n"2019-01-01"\t\n']) expect(parseRadLab(b)).toEqual([]); });
  it("summarizes and converts uGy/h to mGy/day", () => { const r = summarizeRadLab(parseRadLab(TSV))!; expect(r.days).toBe(2); expect(r.from).toBe("2019-12-05"); expect(r.mGyPerDay).toBeCloseTo(r.meanUGyPerH * 0.024, 6); expect(r.byModule.JPM).toBeGreaterThan(r.byModule.Cupola); });
  it("returns null for no data", () => { expect(summarizeRadLab([])).toBeNull(); });
});
