import { assertPositive } from "./util";

/**
 * Space required for cargo, m³: V = W · SF / (1 − BS), BS = broken stowage fraction (0–1).
 */
export function cargoSpace(tonnes: number, stowageFactor: number, brokenStowage = 0): number {
  assertPositive("stowage factor", stowageFactor);
  if (brokenStowage < 0 || brokenStowage >= 1) throw new RangeError("broken stowage must be 0 ≤ BS < 1");
  return (tonnes * stowageFactor) / (1 - brokenStowage);
}

/** Maximum cargo that fits in a space, t: W = V · (1 − BS) / SF. */
export function cargoCapacity(spaceM3: number, stowageFactor: number, brokenStowage = 0): number {
  assertPositive("stowage factor", stowageFactor);
  return (spaceM3 * (1 - brokenStowage)) / stowageFactor;
}

/**
 * Grain stability check (simplified, IMO International Grain Code allowable-heeling-moment method).
 * Actual heeling moment (t·m) = Σ volumetric heeling moments (m⁴) / SF (m³/t).
 * Approximate angle of heel = (actual HM / maximum permissible HM) × 12°.
 * Satisfactory when actual ≤ permissible (heel ≤ 12°).
 */
export function grainHeelCheck(
  totalVolumetricHM: number,
  stowageFactor: number,
  permissibleHM: number,
): { actualHM: number; heelDeg: number; satisfactory: boolean } {
  assertPositive("stowage factor", stowageFactor);
  assertPositive("permissible heeling moment", permissibleHM);
  const actualHM = totalVolumetricHM / stowageFactor;
  const heelDeg = (actualHM / permissibleHM) * 12;
  return { actualHM, heelDeg, satisfactory: actualHM <= permissibleHM };
}

/**
 * Grain heeling arms (IMO Grain Code): λ0 = actual HM / Δ; λ40 = 0.8 · λ0.
 */
export function grainHeelingArms(actualHM: number, displacement: number): { lambda0: number; lambda40: number } {
  assertPositive("displacement", displacement);
  const lambda0 = actualHM / displacement;
  return { lambda0, lambda40: 0.8 * lambda0 };
}

/**
 * Lashing rule of thumb (IMO CSS Code, Annex 13 §4): the sum of the MSL values of the
 * securing devices on EACH side of a unit (t) should be at least equal to the unit's weight (t).
 * Calculated strength CS = MSL / 1.5 is returned for use in the advanced method.
 */
export function lashingRuleOfThumb(cargoWeightT: number, mslPerSideT: number[]): { totalMsl: number; satisfactory: boolean; totalCs: number } {
  assertPositive("cargo weight", cargoWeightT);
  const totalMsl = mslPerSideT.reduce((s, x) => s + x, 0);
  return { totalMsl, satisfactory: totalMsl >= cargoWeightT, totalCs: totalMsl / 1.5 };
}

/** Load density check, t/m²: pressure = weight / area; satisfactory if ≤ permissible. */
export function deckLoadCheck(weightT: number, areaM2: number, permissibleTPerM2: number): { load: number; satisfactory: boolean } {
  assertPositive("area", areaM2);
  const load = weightT / areaM2;
  return { load, satisfactory: load <= permissibleTPerM2 };
}
