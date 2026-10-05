import { assertPositive } from "./util";

export interface TrimWeight {
  /** tonnes; negative = discharged */
  w: number;
  /** longitudinal centre of the weight, metres forward of the after perpendicular */
  lcgFromAP: number;
}

export interface DraftInput {
  draftFwd: number;
  draftAft: number;
  lbp: number;
  /** LCF, metres forward of the after perpendicular */
  lcfFromAP: number;
  /** tonnes per cm immersion */
  tpc: number;
  /** moment to change trim 1 cm, t·m/cm */
  mctc: number;
  weights: TrimWeight[];
}

export interface DraftResult {
  sinkageCm: number;
  /** change of trim, cm, positive = by the stern */
  changeOfTrimCm: number;
  changeAftCm: number;
  changeFwdCm: number;
  draftFwd: number;
  draftAft: number;
  trimM: number;
}

/**
 * Change of trim (cm) = trimming moment about LCF / MCTC.
 * Trimming moment = Σ w · (LCF − lcg)  → positive = by the stern.
 */
export function changeOfTrim(weights: TrimWeight[], lcfFromAP: number, mctc: number): number {
  assertPositive("MCTC", mctc);
  const m = weights.reduce((s, { w, lcgFromAP }) => s + w * (lcfFromAP - lcgFromAP), 0);
  return m / mctc;
}

/**
 * Final drafts after loading/discharging using TPC, MCTC and LCF.
 * Sinkage (cm) = Σw / TPC
 * Change aft (cm) = COT · LCF_from_AP / LBP; change fwd = COT − change aft (applied with opposite sign).
 */
export function finalDrafts(input: DraftInput): DraftResult {
  const { draftFwd, draftAft, lbp, lcfFromAP, tpc, mctc, weights } = input;
  assertPositive("LBP", lbp);
  assertPositive("TPC", tpc);
  const total = weights.reduce((s, x) => s + x.w, 0);
  const sinkageCm = total / tpc;
  const cot = changeOfTrim(weights, lcfFromAP, mctc);
  const changeAftCm = (cot * lcfFromAP) / lbp;
  const changeFwdCm = cot - changeAftCm;
  const fwd = draftFwd + (sinkageCm - changeFwdCm) / 100;
  const aft = draftAft + (sinkageCm + changeAftCm) / 100;
  return {
    sinkageCm,
    changeOfTrimCm: cot,
    changeAftCm,
    changeFwdCm,
    draftFwd: fwd,
    draftAft: aft,
    trimM: aft - fwd,
  };
}

/**
 * Weight to load at a given position to bring the vessel to a required trim, t.
 * w = (requiredCOT_cm · MCTC) / (LCF − lcg).
 */
export function weightForTrimChange(requiredCotCm: number, mctc: number, lcfFromAP: number, lcgFromAP: number): number {
  const lever = lcfFromAP - lcgFromAP;
  if (lever === 0) throw new RangeError("Weight at LCF cannot change trim");
  return (requiredCotCm * mctc) / lever;
}

/** Tonnes per centimetre immersion: TPC = 1.025 · Aw / 100 (salt water), or ρ · Aw / 100. */
export function tpcFromWaterplane(areaM2: number, density = 1.025): number {
  assertPositive("waterplane area", areaM2);
  return (density * areaM2) / 100;
}

/** Fresh water allowance, mm: FWA = Δ / (4 · TPC). */
export function freshWaterAllowance(displacement: number, tpc: number): number {
  assertPositive("TPC", tpc);
  return displacement / (4 * tpc);
}

/** Dock water allowance, mm: DWA = FWA · (1025 − ρ_dock) / 25  (ρ in kg/m³). */
export function dockWaterAllowance(fwaMm: number, dockDensity: number): number {
  return (fwaMm * (1025 - dockDensity)) / 25;
}

/**
 * Maximum squat (Barrass), metres: open water = Cb·V²/100; confined = Cb·V²/50. V in knots.
 */
export function squat(cb: number, speedKn: number, confined = false): number {
  return (cb * speedKn ** 2) / (confined ? 50 : 100);
}
