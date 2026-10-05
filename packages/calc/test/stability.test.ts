import { describe, expect, it } from "vitest";
import * as s from "../src/stability";

// All cases hand-worked from the stated formula (moments about keel, wall-sided theory).
describe("finalKG", () => {
  it("loading raises KG — Δ10000 KG7.5 + 500t@10 → 80000/10500 = 7.619", () => {
    const r = s.finalKG(10000, 7.5, [{ w: 500, kg: 10 }]);
    expect(r.displacement).toBe(10500);
    expect(r.kg).toBeCloseTo(7.619, 3);
  });
  it("discharging low weight raises KG — 75000−3000 / 9000 = 8.000", () => {
    expect(s.finalKG(10000, 7.5, [{ w: -1000, kg: 3 }]).kg).toBeCloseTo(8.0, 6);
  });
  it("mixed operations — (75000+2400−600)/9900 = 7.7576", () => {
    expect(s.finalKG(10000, 7.5, [{ w: 200, kg: 12 }, { w: -300, kg: 2 }]).kg).toBeCloseTo(7.7576, 4);
  });
  it("rejects impossible displacement", () => {
    expect(() => s.finalKG(1000, 5, [{ w: -1000, kg: 1 }])).toThrow(RangeError);
    expect(() => s.finalKG(0, 5, [])).toThrow(RangeError);
  });
});

describe("free surface", () => {
  it("rect tank 20×10 SW: 20·1000/12·1.025 = 1708.33 t·m", () => {
    expect(s.rectTankFSM(20, 10, 1.025)).toBeCloseTo(1708.33, 2);
  });
  it("tank 12×8 FW: 12·512/12·1.0 = 512 t·m", () => {
    expect(s.rectTankFSM(12, 8, 1.0)).toBeCloseTo(512, 6);
  });
  it("tank 15×6 HFO 0.95: 15·216/12·0.95 = 256.5 t·m", () => {
    expect(s.rectTankFSM(15, 6, 0.95)).toBeCloseTo(256.5, 6);
  });
  it("FSC = FSM/Δ", () => {
    expect(s.freeSurfaceCorrection(1708.33, 10000)).toBeCloseTo(0.1708, 4);
    expect(s.freeSurfaceCorrection(500, 5000)).toBeCloseTo(0.1, 6);
    expect(s.freeSurfaceCorrection(0, 5000)).toBe(0);
  });
  it("fluid GM = KM − KG − FSC", () => {
    expect(s.fluidGM(8.2, 7.5, 0.17)).toBeCloseTo(0.53, 6);
    expect(s.fluidGM(8.2, 7.5)).toBeCloseTo(0.7, 6);
    expect(s.fluidGM(7.0, 7.2, 0.1)).toBeCloseTo(-0.3, 6);
  });
});

describe("GZ from KN", () => {
  it("KN 3.5 KG 7.0 30° → 3.5 − 3.5 = 0", () => expect(s.gzFromKN(3.5, 7, 30)).toBeCloseTo(0, 6));
  it("KN 4.2 KG 7.0 45° → 4.2 − 4.9497 = −0.7497", () => expect(s.gzFromKN(4.2, 7, 45)).toBeCloseTo(-0.7497, 4));
  it("KN 2.0 KG 7.0 15° → 2.0 − 1.8117 = 0.1883", () => expect(s.gzFromKN(2.0, 7, 15)).toBeCloseTo(0.1883, 4));
  it("righting moment = Δ·GZ", () => expect(s.rightingMoment(10000, 0.25)).toBe(2500));
});

describe("list", () => {
  it("Δ10000 GM0.5 moment 100 → tan θ = 0.02 → 1.1458°", () => expect(s.listAngle(10000, 0.5, 100)).toBeCloseTo(1.1458, 4));
  it("port moment gives negative angle", () => expect(s.listAngle(10000, 0.5, -100)).toBeCloseTo(-1.1458, 4));
  it("Δ8000 GM1.0 moment 8000·tan10° → 10°", () =>
    expect(s.listAngle(8000, 1.0, 8000 * Math.tan((10 * Math.PI) / 180))).toBeCloseTo(10, 6));
  it("weight to correct 5° list: 10000·0.5·tan5°/10 = 43.74 t", () =>
    expect(s.weightToCorrectList(10000, 0.5, 5, 10)).toBeCloseTo(43.74, 2));
  it("rejects zero/negative GM (list theory invalid)", () => expect(() => s.listAngle(10000, 0, 100)).toThrow());
});

describe("angle of loll", () => {
  it("GM −0.08 BM 4 → tan θ = 0.2 → 11.31°", () => expect(s.angleOfLoll(-0.08, 4)).toBeCloseTo(11.31, 2));
  it("GM −0.18 BM 4 → tan θ = 0.3 → 16.70°", () => expect(s.angleOfLoll(-0.18, 4)).toBeCloseTo(16.7, 2));
  it("positive GM → no loll", () => expect(s.angleOfLoll(0.3, 4)).toBe(0));
});

describe("drydock", () => {
  it("P = MCTC·t/l = 150·100/75 = 200 t", () => expect(s.drydockUpthrust(150, 100, 75)).toBeCloseTo(200, 6));
  it("P = 220·60/88 = 150 t", () => expect(s.drydockUpthrust(220, 60, 88)).toBeCloseTo(150, 6));
  it("loss of GM = P·KM/Δ = 200·9/10000 = 0.18 m", () => expect(s.drydockGMLoss(200, 9, 10000)).toBeCloseTo(0.18, 6));
  it("critical P = Δ·GM/KM = 10000·0.6/9 = 666.67 t", () => expect(s.drydockCriticalUpthrust(10000, 0.6, 9)).toBeCloseTo(666.67, 2));
});

describe("roll period rule of thumb", () => {
  it("B20 T20 C0.8 → 0.64 m", () => expect(s.gmFromRollPeriod(20, 20)).toBeCloseTo(0.64, 6));
  it("B32 T16 C0.7 → (1.4)² = 1.96 m", () => expect(s.gmFromRollPeriod(32, 16, 0.7)).toBeCloseTo(1.96, 6));
});
