import { describe, expect, it } from "vitest";
import * as c from "../src/cargo";

describe("stowage", () => {
  it("1000 t SF 1.5 BS 10% → 1666.67 m³", () => expect(c.cargoSpace(1000, 1.5, 0.1)).toBeCloseTo(1666.67, 2));
  it("no broken stowage → W·SF", () => expect(c.cargoSpace(1000, 1.5)).toBeCloseTo(1500, 9));
  it("capacity 1500 m³ SF 1.5 → 1000 t; with 10% BS → 900 t", () => {
    expect(c.cargoCapacity(1500, 1.5)).toBeCloseTo(1000, 9);
    expect(c.cargoCapacity(1500, 1.5, 0.1)).toBeCloseTo(900, 9);
  });
  it("rejects BS ≥ 100%", () => expect(() => c.cargoSpace(10, 1, 1)).toThrow());
});

describe("grain", () => {
  it("VHM 6000 m⁴ / SF 1.5 = 4000 t·m vs 5000 permissible → 9.6° OK", () => {
    const r = c.grainHeelCheck(6000, 1.5, 5000);
    expect(r.actualHM).toBeCloseTo(4000, 9);
    expect(r.heelDeg).toBeCloseTo(9.6, 9);
    expect(r.satisfactory).toBe(true);
  });
  it("VHM 9000 / 1.5 = 6000 > 5000 → 14.4° not OK", () => {
    const r = c.grainHeelCheck(9000, 1.5, 5000);
    expect(r.heelDeg).toBeCloseTo(14.4, 9);
    expect(r.satisfactory).toBe(false);
  });
  it("exactly at permissible → 12° and satisfactory", () => expect(c.grainHeelCheck(7500, 1.5, 5000).satisfactory).toBe(true));
  it("heeling arms λ0 = 4000/20000 = 0.2, λ40 = 0.16", () => {
    const r = c.grainHeelingArms(4000, 20000);
    expect(r.lambda0).toBeCloseTo(0.2, 9);
    expect(r.lambda40).toBeCloseTo(0.16, 9);
  });
});

describe("lashing & deck load", () => {
  it("20 t unit, 4 × 5 t MSL per side → OK, CS 13.33", () => {
    const r = c.lashingRuleOfThumb(20, [5, 5, 5, 5]);
    expect(r.satisfactory).toBe(true);
    expect(r.totalCs).toBeCloseTo(13.33, 2);
  });
  it("20 t unit, 3 × 5 t → insufficient", () => expect(c.lashingRuleOfThumb(20, [5, 5, 5]).satisfactory).toBe(false));
  it("deck load 30 t on 10 m² = 3 t/m² > 2.5 → fail; 20 t → OK", () => {
    expect(c.deckLoadCheck(30, 10, 2.5)).toEqual({ load: 3, satisfactory: false });
    expect(c.deckLoadCheck(20, 10, 2.5).satisfactory).toBe(true);
  });
});
