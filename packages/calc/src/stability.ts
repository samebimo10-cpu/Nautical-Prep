import { assertPositive, toDeg, toRad } from "./util";

export interface Weight {
  /** tonnes; negative = discharged */
  w: number;
  /** vertical centre of gravity above keel, m */
  kg: number;
}

/**
 * Final displacement and KG after loading/discharging.
 * KG_final = (Δ·KG + Σ w·kg) / (Δ + Σ w)   (moments about the keel)
 * @returns { displacement (t), kg (m) }
 */
export function finalKG(displacement: number, kg: number, weights: Weight[]): { displacement: number; kg: number } {
  assertPositive("displacement", displacement);
  let moment = displacement * kg;
  let disp = displacement;
  for (const { w, kg: z } of weights) {
    moment += w * z;
    disp += w;
  }
  assertPositive("final displacement", disp);
  return { displacement: disp, kg: moment / disp };
}

/**
 * Free surface moment of a rectangular tank (t·m).
 * FSM = (l·b³ / 12) · ρ_liquid   — l, b in metres, ρ in t/m³.
 */
export function rectTankFSM(length: number, breadth: number, density: number): number {
  assertPositive("length", length);
  assertPositive("breadth", breadth);
  assertPositive("density", density);
  return ((length * breadth ** 3) / 12) * density;
}

/** Free surface correction (virtual rise of G), m: FSC = ΣFSM / Δ. */
export function freeSurfaceCorrection(totalFSM: number, displacement: number): number {
  assertPositive("displacement", displacement);
  return totalFSM / displacement;
}

/** Fluid (effective) GM, m: GM_fluid = KM − KG − FSC. */
export function fluidGM(km: number, kg: number, fsc = 0): number {
  return km - kg - fsc;
}

/** Righting lever from KN tables, m: GZ = KN − KG·sin θ. */
export function gzFromKN(kn: number, kg: number, heelDeg: number): number {
  return kn - kg * Math.sin(toRad(heelDeg));
}

/** Righting moment, t·m: RM = Δ · GZ. */
export function rightingMoment(displacement: number, gz: number): number {
  return displacement * gz;
}

/**
 * Angle of list, degrees, from transverse moments (small-angle / wall-sided).
 * tan θ = GG₁ / GM, where GG₁ = Σ(w·d) / Δ  (d = transverse distance from CL, +stbd).
 * Positive = starboard.
 */
export function listAngle(displacement: number, gm: number, transverseMoment: number): number {
  assertPositive("displacement", displacement);
  assertPositive("GM", gm);
  return toDeg(Math.atan(transverseMoment / displacement / gm));
}

/**
 * Weight to shift transversely to correct a list, t: w = Δ · GM · tan θ / d.
 */
export function weightToCorrectList(displacement: number, gm: number, listDeg: number, shiftDistance: number): number {
  assertPositive("displacement", displacement);
  assertPositive("shift distance", shiftDistance);
  return (displacement * gm * Math.tan(toRad(Math.abs(listDeg)))) / shiftDistance;
}

/**
 * Angle of loll, degrees, for a wall-sided vessel with negative initial GM.
 * tan θ = √(−2·GM / BM)
 */
export function angleOfLoll(gm: number, bm: number): number {
  if (gm >= 0) return 0;
  assertPositive("BM", bm);
  return toDeg(Math.atan(Math.sqrt((-2 * gm) / bm)));
}

/**
 * Upthrust (P force) at the stern frame / keel blocks during drydocking, t.
 * P = MCTC · t / l
 * @param mctc moment to change trim 1 cm (t·m/cm)
 * @param trimCm trim by the stern, cm, still to be removed when she takes the blocks fully
 * @param distLcfToAftBlockM distance from LCF to the point of contact (after perpendicular / keel block), m
 */
export function drydockUpthrust(mctc: number, trimCm: number, distLcfToAftBlockM: number): number {
  assertPositive("MCTC", mctc);
  assertPositive("distance LCF to blocks", distLcfToAftBlockM);
  return (mctc * trimCm) / distLcfToAftBlockM;
}

/**
 * Virtual loss of GM due to upthrust P (reduction-in-KM method), m: loss = P · KM / Δ.
 * Effective GM = GM_fluid − loss.
 */
export function drydockGMLoss(upthrust: number, km: number, displacement: number): number {
  assertPositive("displacement", displacement);
  return (upthrust * km) / displacement;
}

/**
 * Maximum P force before effective GM reaches zero (critical instant), t: P_max = Δ · GM / KM.
 */
export function drydockCriticalUpthrust(displacement: number, gmFluid: number, km: number): number {
  assertPositive("KM", km);
  return (displacement * gmFluid) / km;
}

/**
 * Approximate GM from rolling period (rule of thumb), m: GM = (C · B / T)².
 * C ≈ 0.7–0.8 for merchant ships (0.8 default). Indicative only.
 */
export function gmFromRollPeriod(beam: number, periodS: number, c = 0.8): number {
  assertPositive("beam", beam);
  assertPositive("roll period", periodS);
  return ((c * beam) / periodS) ** 2;
}
