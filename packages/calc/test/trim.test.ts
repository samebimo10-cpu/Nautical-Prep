import { describe, expect, it } from "vitest";
import * as t from "../src/trim";

// Hand-worked: LBP 100, LCF 48 m fwd of AP, TPC 20, MCTC 150, drafts F 6.00 A 7.00.
const base = { draftFwd: 6.0, draftAft: 7.0, lbp: 100, lcfFromAP: 48, tpc: 20, mctc: 150 };

describe("finalDrafts", () => {
  it("load 300 t at 20 m from AP: sinkage 15, COT 56 by stern, F 5.8588 A 7.4188", () => {
    const r = t.finalDrafts({ ...base, weights: [{ w: 300, lcgFromAP: 20 }] });
    expect(r.sinkageCm).toBeCloseTo(15, 6);
    expect(r.changeOfTrimCm).toBeCloseTo(56, 6);
    expect(r.changeAftCm).toBeCloseTo(26.88, 6);
    expect(r.changeFwdCm).toBeCloseTo(29.12, 6);
    expect(r.draftFwd).toBeCloseTo(5.8588, 4);
    expect(r.draftAft).toBeCloseTo(7.4188, 4);
  });
  it("discharge 200 t at 80 m from AP: COT 42.667 by stern, F 5.6781 A 7.1048", () => {
    const r = t.finalDrafts({ ...base, weights: [{ w: -200, lcgFromAP: 80 }] });
    expect(r.changeOfTrimCm).toBeCloseTo(42.667, 3);
    expect(r.draftFwd).toBeCloseTo(5.6781, 4);
    expect(r.draftAft).toBeCloseTo(7.1048, 4);
    expect(r.trimM).toBeCloseTo(7.1048 - 5.6781, 4);
  });
  it("weight at LCF causes bodily sinkage only", () => {
    const r = t.finalDrafts({ ...base, weights: [{ w: 400, lcgFromAP: 48 }] });
    expect(r.changeOfTrimCm).toBeCloseTo(0, 9);
    expect(r.draftFwd).toBeCloseTo(6.2, 6);
    expect(r.draftAft).toBeCloseTo(7.2, 6);
  });
});

describe("trim helpers", () => {
  it("weight for 50 cm COT at 20 m: 50·150/28 = 267.86 t", () =>
    expect(t.weightForTrimChange(50, 150, 48, 20)).toBeCloseTo(267.86, 2));
  it("weight at LCF cannot change trim", () => expect(() => t.weightForTrimChange(10, 150, 48, 48)).toThrow());
  it("TPC = 1.025·2000/100 = 20.5", () => expect(t.tpcFromWaterplane(2000)).toBeCloseTo(20.5, 6));
  it("TPC FW = 1.0·1500/100 = 15", () => expect(t.tpcFromWaterplane(1500, 1.0)).toBeCloseTo(15, 6));
  it("FWA = 20500/(4·20.5) = 250 mm", () => expect(t.freshWaterAllowance(20500, 20.5)).toBeCloseTo(250, 6));
  it("DWA = 250·(1025−1010)/25 = 150 mm", () => expect(t.dockWaterAllowance(250, 1010)).toBeCloseTo(150, 6));
  it("DWA in FW equals FWA", () => expect(t.dockWaterAllowance(180, 1000)).toBeCloseTo(180, 6));
  it("squat Cb0.8 10 kn open = 0.8 m, confined = 1.6 m", () => {
    expect(t.squat(0.8, 10)).toBeCloseTo(0.8, 6);
    expect(t.squat(0.8, 10, true)).toBeCloseTo(1.6, 6);
    expect(t.squat(0.65, 12)).toBeCloseTo(0.936, 6);
  });
});
