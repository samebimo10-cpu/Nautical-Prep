import { describe, expect, it } from "vitest";
import { shearAndBending } from "../src/strength";

// Box vessel 100 m, compartments 30/40/30 m; buoyancy uniform at Δ/L per metre. Hand-worked.
describe("shear force & bending moment", () => {
  it("uniform weight = buoyancy everywhere → zero SF and BM", () => {
    const r = shearAndBending([{ length: 30, weight: 1500 }, { length: 40, weight: 2000 }, { length: 30, weight: 1500 }], 50);
    expect(r.shearForce).toBeCloseTo(0, 9);
    expect(r.bendingMoment).toBeCloseTo(0, 9);
  });
  it("heavy ends hog: at x=30 SF 500 t, BM +7500 t·m; at x=50 SF 0, BM +12500", () => {
    const c = [{ length: 30, weight: 2000 }, { length: 40, weight: 1000 }, { length: 30, weight: 2000 }];
    const a = shearAndBending(c, 30);
    expect(a.shearForce).toBeCloseTo(500, 6);
    expect(a.bendingMoment).toBeCloseTo(7500, 6);
    const m = shearAndBending(c, 50);
    expect(m.shearForce).toBeCloseTo(0, 6);
    expect(m.bendingMoment).toBeCloseTo(12500, 6);
  });
  it("heavy middle sags: BM at midships −12500 t·m", () => {
    const c = [{ length: 30, weight: 1000 }, { length: 40, weight: 3000 }, { length: 30, weight: 1000 }];
    expect(shearAndBending(c, 50).bendingMoment).toBeCloseTo(-12500, 6);
    expect(shearAndBending(c, 100).bendingMoment).toBeCloseTo(0, 6);
  });
  it("rejects sections outside the hull", () => {
    expect(() => shearAndBending([{ length: 10, weight: 10 }], 11)).toThrow();
  });
});
