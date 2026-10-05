import * as st from "./stability";
import * as tr from "./trim";
import * as nav from "./navigation";
import * as cg from "./cargo";
import { shearAndBending } from "./strength";
import { round } from "./util";

export type Vars = Record<string, number>;
/** Every calc function returns the final answer plus named intermediate values for worked solutions. */
export interface CalcResult {
  answer: number;
  values: Record<string, number>;
}
export type CalcFn = (v: Vars) => CalcResult;

const req = (v: Vars, k: string): number => {
  const x = v[k];
  if (x === undefined || Number.isNaN(x)) throw new Error(`missing variable "${k}"`);
  return x;
};

/**
 * Registry of calc functions addressable by `calc_fn` in content items.
 * Each wraps a tested primitive; intermediate values are rounded for display only —
 * the answer is computed at full precision.
 */
export const CALC_REGISTRY: Record<string, CalcFn> = {
  /** Vars: disp, kg, w, wkg → final KG */
  "stability.finalKG": (v) => {
    const r = st.finalKG(req(v, "disp"), req(v, "kg"), [{ w: req(v, "w"), kg: req(v, "wkg") }]);
    return { answer: r.kg, values: { finalDisp: r.displacement, moment0: req(v, "disp") * req(v, "kg"), momentW: req(v, "w") * req(v, "wkg"), finalKG: r.kg } };
  },
  /** Vars: l, b, rho, disp, km, kg → fluid GM */
  "stability.freeSurfaceGM": (v) => {
    const fsm = st.rectTankFSM(req(v, "l"), req(v, "b"), req(v, "rho"));
    const fsc = st.freeSurfaceCorrection(fsm, req(v, "disp"));
    const gmSolid = req(v, "km") - req(v, "kg");
    const gm = st.fluidGM(req(v, "km"), req(v, "kg"), fsc);
    return { answer: gm, values: { fsm, fsc, gmSolid, gmFluid: gm } };
  },
  /** Vars: kn, kg, heel → GZ */
  "stability.gzFromKN": (v) => {
    const sin = Math.sin((req(v, "heel") * Math.PI) / 180);
    const gz = st.gzFromKN(req(v, "kn"), req(v, "kg"), req(v, "heel"));
    return { answer: gz, values: { sinHeel: sin, kgSin: req(v, "kg") * sin, gz } };
  },
  /** Vars: disp, gm, w, d → list angle */
  "stability.list": (v) => {
    const tm = req(v, "w") * req(v, "d");
    const gg1 = tm / req(v, "disp");
    const list = st.listAngle(req(v, "disp"), req(v, "gm"), tm);
    return { answer: list, values: { tm, gg1, tanList: gg1 / req(v, "gm"), list } };
  },
  /** Vars: gm (negative), bm → angle of loll */
  "stability.loll": (v) => {
    const a = st.angleOfLoll(req(v, "gm"), req(v, "bm"));
    return { answer: a, values: { ratio: (-2 * req(v, "gm")) / req(v, "bm"), tanLoll: Math.tan((a * Math.PI) / 180), loll: a } };
  },
  /** Vars: mctc, trim (cm), l, km, disp, gm → effective GM at critical instant */
  "stability.drydock": (v) => {
    const p = st.drydockUpthrust(req(v, "mctc"), req(v, "trim"), req(v, "l"));
    const loss = st.drydockGMLoss(p, req(v, "km"), req(v, "disp"));
    const eff = req(v, "gm") - loss;
    return { answer: eff, values: { p, loss, effGM: eff } };
  },
  /** Vars: fwd, aft, lbp, lcf, tpc, mctc, w, lcg → final aft draft */
  "trim.finalDraftAft": (v) => {
    const r = tr.finalDrafts({
      draftFwd: req(v, "fwd"), draftAft: req(v, "aft"), lbp: req(v, "lbp"), lcfFromAP: req(v, "lcf"),
      tpc: req(v, "tpc"), mctc: req(v, "mctc"), weights: [{ w: req(v, "w"), lcgFromAP: req(v, "lcg") }],
    });
    return { answer: r.draftAft, values: { ...r, lever: req(v, "lcf") - req(v, "lcg") } };
  },
  /** Same inputs → final forward draft */
  "trim.finalDraftFwd": (v) => {
    const r = tr.finalDrafts({
      draftFwd: req(v, "fwd"), draftAft: req(v, "aft"), lbp: req(v, "lbp"), lcfFromAP: req(v, "lcf"),
      tpc: req(v, "tpc"), mctc: req(v, "mctc"), weights: [{ w: req(v, "w"), lcgFromAP: req(v, "lcg") }],
    });
    return { answer: r.draftFwd, values: { ...r, lever: req(v, "lcf") - req(v, "lcg") } };
  },
  /** Vars: disp, tpc, rho → DWA (mm) */
  "trim.dwa": (v) => {
    const fwa = tr.freshWaterAllowance(req(v, "disp"), req(v, "tpc"));
    const dwa = tr.dockWaterAllowance(fwa, req(v, "rho"));
    return { answer: dwa, values: { fwa, dwa } };
  },
  /** Vars: cb, v, confined (0/1) → squat (m) */
  "trim.squat": (v) => {
    const s = tr.squat(req(v, "cb"), req(v, "v"), req(v, "confined") === 1);
    return { answer: s, values: { v2: req(v, "v") ** 2, squat: s } };
  },
  /** Vars: L1, w1, L2, w2, L3, w3, x → bending moment at x (three compartments) */
  "strength.bm3": (v) => {
    const comps = [
      { length: req(v, "L1"), weight: req(v, "w1") },
      { length: req(v, "L2"), weight: req(v, "w2") },
      { length: req(v, "L3"), weight: req(v, "w3") },
    ];
    const r = shearAndBending(comps, req(v, "x"));
    const L = req(v, "L1") + req(v, "L2") + req(v, "L3");
    const disp = req(v, "w1") + req(v, "w2") + req(v, "w3");
    return { answer: r.bendingMoment, values: { L, disp, b: disp / L, sf: r.shearForce, bm: r.bendingMoment } };
  },
  /** Vars: lat1, lon1, lat2, lon2 → GC distance nm */
  "nav.gcDistance": (v) => {
    const r = nav.greatCircle({ lat: req(v, "lat1"), lon: req(v, "lon1") }, { lat: req(v, "lat2"), lon: req(v, "lon2") });
    return { answer: r.distanceNm, values: { distance: r.distanceNm, ic: r.initialCourse, dlong: req(v, "lon2") - req(v, "lon1") } };
  },
  /** Same → initial course */
  "nav.gcInitialCourse": (v) => {
    const r = nav.greatCircle({ lat: req(v, "lat1"), lon: req(v, "lon1") }, { lat: req(v, "lat2"), lon: req(v, "lon2") });
    return { answer: r.initialCourse, values: { distance: r.distanceNm, ic: r.initialCourse, dlong: req(v, "lon2") - req(v, "lon1") } };
  },
  /** Same → mercator course */
  "nav.mercatorCourse": (v) => {
    const r = nav.mercatorSailing({ lat: req(v, "lat1"), lon: req(v, "lon1") }, { lat: req(v, "lat2"), lon: req(v, "lon2") });
    return {
      answer: r.course,
      values: { mp1: nav.meridionalParts(req(v, "lat1")), mp2: nav.meridionalParts(req(v, "lat2")), dmp: r.dmp, dlongMin: (req(v, "lon2") - req(v, "lon1")) * 60, dlatMin: (req(v, "lat2") - req(v, "lat1")) * 60, course: r.course, distance: r.distanceNm },
    };
  },
  /** Vars: dec (N+), lat, compass (compass bearing at sunrise), variation (E+) → deviation */
  "nav.amplitudeDeviation": (v) => {
    const amp = nav.trueAmplitude(req(v, "dec"), req(v, "lat"));
    const tb = nav.amplitudeToBearing(amp, req(v, "dec") >= 0, true);
    const r = nav.compassError(tb, req(v, "compass"), req(v, "variation"));
    return { answer: r.deviation, values: { amp, trueBearing: tb, error: r.error, deviation: r.deviation } };
  },
  /** Vars: lwh, hwh, lwt, hwt, t, + secondary diffs dhwt, dlwt, dhwh, dlwh → height at t */
  "nav.secondaryTide": (v) => {
    const r = nav.secondaryPortTide(
      { lwTime: req(v, "lwt"), lwHeight: req(v, "lwh"), hwTime: req(v, "hwt"), hwHeight: req(v, "hwh") },
      { hwTimeDiffH: req(v, "dhwt"), lwTimeDiffH: req(v, "dlwt"), hwHeightDiff: req(v, "dhwh"), lwHeightDiff: req(v, "dlwh") },
      req(v, "t"),
    );
    return { answer: r.height, values: { ...r, range: r.hwHeight - r.lwHeight, duration: r.hwTime - r.lwTime } };
  },
  /** Vars: w, sf, bs (%) → space m³ */
  "cargo.space": (v) => {
    const s = cg.cargoSpace(req(v, "w"), req(v, "sf"), req(v, "bs") / 100);
    return { answer: s, values: { net: req(v, "w") * req(v, "sf"), space: s } };
  },
  /** Vars: vhm, sf, allowable → heel angle */
  "cargo.grainHeel": (v) => {
    const r = cg.grainHeelCheck(req(v, "vhm"), req(v, "sf"), req(v, "allowable"));
    return { answer: r.heelDeg, values: { actualHM: r.actualHM, heel: r.heelDeg, ok: r.satisfactory ? 1 : 0 } };
  },
};

export function runCalc(fn: string, vars: Vars): CalcResult {
  const f = CALC_REGISTRY[fn];
  if (!f) throw new Error(`Unknown calc_fn "${fn}"`);
  return f(vars);
}

export { round };
