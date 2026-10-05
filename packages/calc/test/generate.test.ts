import { describe, expect, it } from "vitest";
import { CALC_REGISTRY, generateCalc, gradeCalc, render, runCalc } from "../src";
import { mulberry32, pickInRange } from "../src/rng";
import { round, norm360 } from "../src/util";

const fsTemplate = {
  template: "Tank {{l}} m × {{b}} m, density {{rho}}. Δ {{disp}} t, KM {{km}}, KG {{kg}}. Find fluid GM.",
  variables: {
    l: { min: 10, max: 20, step: 1 },
    b: { min: 6, max: 12, step: 1 },
    rho: { min: 1.0, max: 1.025, step: 0.025 },
    disp: { min: 8000, max: 15000, step: 500 },
    km: { min: 8, max: 9, step: 0.1 },
    kg: { min: 6.5, max: 7.5, step: 0.1 },
  },
  calc_fn: "stability.freeSurfaceGM",
  units: "m",
  tolerance: 0.02,
  worked_solution_template: "1. FSM = {{fsm:1}} t·m\n2. FSC = {{fsc:3}} m\n3. GM = {{gmFluid:3}} m",
};

describe("generator", () => {
  it("same seed → identical question", () => {
    expect(generateCalc(fsTemplate, 42)).toEqual(generateCalc(fsTemplate, 42));
  });
  it("different seeds vary", () => {
    const stems = new Set([1, 2, 3, 4, 5, 6].map((s) => generateCalc(fsTemplate, s).stem));
    expect(stems.size).toBeGreaterThan(1);
  });
  it("renders steps and answer consistent with primitives", () => {
    const g = generateCalc(fsTemplate, 7);
    const v = g.vars as Record<string, number>;
    const fsm = (v.l! * v.b! ** 3) / 12 * v.rho!;
    expect(g.answer).toBeCloseTo(v.km! - v.kg! - fsm / v.disp!, 9);
    expect(g.steps).toHaveLength(3);
    expect(g.stem).not.toContain("{{");
  });
  it("grades within tolerance", () => {
    expect(gradeCalc(0.5, 0.51, 0.02)).toBe(true);
    expect(gradeCalc(0.5, 0.53, 0.02)).toBe(false);
    expect(gradeCalc(0.5, Number.NaN, 0.02)).toBe(false);
  });
  it("render leaves unknown placeholders and formats decimals", () => {
    expect(render("{{a:2}} {{zz}}", { a: 1.006 })).toBe("1.01 {{zz}}");
  });
  it("unknown calc_fn and missing variable throw", () => {
    expect(() => runCalc("nope", {})).toThrow();
    expect(() => runCalc("stability.finalKG", {})).toThrow(/missing/);
  });
  it("pickInRange stays within bounds on the step grid", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const v = pickInRange(r, 1, 2, 0.25);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(2);
      expect((v * 4) % 1).toBeCloseTo(0, 9);
    }
  });
  it("util helpers", () => {
    expect(round(-1.006, 2)).toBe(-1.01);
    expect(norm360(-30)).toBe(330);
  });
});

describe("registry — every function runs on representative inputs", () => {
  const cases: Record<string, Record<string, number>> = {
    "stability.finalKG": { disp: 10000, kg: 7.5, w: 500, wkg: 10 },
    "stability.freeSurfaceGM": { l: 20, b: 10, rho: 1.025, disp: 10000, km: 8.2, kg: 7.5 },
    "stability.gzFromKN": { kn: 2, kg: 7, heel: 15 },
    "stability.list": { disp: 10000, gm: 0.5, w: 10, d: 10 },
    "stability.loll": { gm: -0.08, bm: 4 },
    "stability.drydock": { mctc: 150, trim: 100, l: 75, km: 9, disp: 10000, gm: 0.6 },
    "trim.finalDraftAft": { fwd: 6, aft: 7, lbp: 100, lcf: 48, tpc: 20, mctc: 150, w: 300, lcg: 20 },
    "trim.finalDraftFwd": { fwd: 6, aft: 7, lbp: 100, lcf: 48, tpc: 20, mctc: 150, w: 300, lcg: 20 },
    "trim.dwa": { disp: 20500, tpc: 20.5, rho: 1010 },
    "trim.squat": { cb: 0.8, v: 10, confined: 0 },
    "strength.bm3": { L1: 30, w1: 2000, L2: 40, w2: 1000, L3: 30, w3: 2000, x: 50 },
    "nav.gcDistance": { lat1: 0, lon1: 0, lat2: 0, lon2: 90 },
    "nav.gcInitialCourse": { lat1: 0, lon1: 0, lat2: 60, lon2: 0 },
    "nav.mercatorCourse": { lat1: 0, lon1: 0, lat2: 0, lon2: 10 },
    "nav.amplitudeDeviation": { dec: 20, lat: 40, compass: 65, variation: -3 },
    "nav.secondaryTide": { lwt: 0, lwh: 1, hwt: 6, hwh: 5, dhwt: 0.5, dlwt: 0.5, dhwh: -0.4, dlwh: -0.2, t: 3.5 },
    "cargo.space": { w: 1000, sf: 1.5, bs: 10 },
    "cargo.grainHeel": { vhm: 6000, sf: 1.5, allowable: 5000 },
  };
  const expected: Record<string, number> = {
    "stability.finalKG": 7.619,
    "stability.freeSurfaceGM": 0.529,
    "stability.gzFromKN": 0.188,
    "stability.list": 1.146,
    "stability.loll": 11.31,
    "stability.drydock": 0.42,
    "trim.finalDraftAft": 7.419,
    "trim.finalDraftFwd": 5.859,
    "trim.dwa": 150,
    "trim.squat": 0.8,
    "strength.bm3": 12500,
    "nav.gcDistance": 5400,
    "nav.gcInitialCourse": 0,
    "nav.mercatorCourse": 90,
    "nav.amplitudeDeviation": 1.48,
    "nav.secondaryTide": 2.7,
    "cargo.space": 1666.67,
    "cargo.grainHeel": 9.6,
  };
  it("covers every registry entry", () => expect(Object.keys(cases).sort()).toEqual(Object.keys(CALC_REGISTRY).sort()));
  for (const [fn, vars] of Object.entries(cases)) {
    it(fn, () => expect(runCalc(fn, vars).answer).toBeCloseTo(expected[fn]!, 2));
  }
});
