import { assertPositive } from "./util";

export interface Compartment {
  /** length of compartment, m (compartments laid end to end from the after end) */
  length: number;
  /** total weight in the compartment incl. lightship share, t */
  weight: number;
}

/**
 * Shear force and bending moment at a section of a box-shaped vessel in still water
 * (simplified). Buoyancy is uniformly distributed (even keel): b = Δ / L per metre.
 * Weight is uniformly distributed within each compartment.
 * SF(x) = Σ (weight − buoyancy) aft of x            (t)
 * BM(x) = Σ (weight − buoyancy) · lever about x      (t·m), positive = hogging
 * @param x distance of the section from the after end, m
 */
export function shearAndBending(compartments: Compartment[], x: number): { shearForce: number; bendingMoment: number } {
  const L = compartments.reduce((s, c) => s + c.length, 0);
  const disp = compartments.reduce((s, c) => s + c.weight, 0);
  assertPositive("ship length", L);
  if (x < 0 || x > L) throw new RangeError("section must lie within the ship");
  const b = disp / L;
  let start = 0;
  let sf = 0;
  let bm = 0;
  for (const c of compartments) {
    const end = start + c.length;
    const seg = Math.max(0, Math.min(end, x) - start);
    if (seg > 0) {
      const wPerM = c.weight / c.length;
      const net = (wPerM - b) * seg;
      sf += net;
      // centroid of this portion is (start + seg/2); lever about x
      bm += net * (x - (start + seg / 2));
    }
    start = end;
  }
  // Sign convention: net excess weight towards the ends (large lever) gives a positive
  // moment = hogging; net excess buoyancy at the ends gives a negative moment = sagging.
  return { shearForce: sf, bendingMoment: bm };
}
