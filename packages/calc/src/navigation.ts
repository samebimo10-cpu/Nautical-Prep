import { norm360, toDeg, toRad } from "./util";

/** Latitude/longitude in decimal degrees; N and E positive. */
export interface Position {
  lat: number;
  lon: number;
}

function dLongDeg(from: number, to: number): number {
  let d = to - from;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Great circle distance (nm) and initial course (°T), spherical earth.
 * cos D = sin L1 sin L2 + cos L1 cos L2 cos dLong; distance = D(′) i.e. 60 × D(°).
 * Initial course: tan C = sin dLong / (cos L1 tan L2 − sin L1 cos dLong).
 */
export function greatCircle(a: Position, b: Position): { distanceNm: number; initialCourse: number; finalCourse: number } {
  const l1 = toRad(a.lat);
  const l2 = toRad(b.lat);
  const dl = toRad(dLongDeg(a.lon, b.lon));
  const cosD = Math.sin(l1) * Math.sin(l2) + Math.cos(l1) * Math.cos(l2) * Math.cos(dl);
  const D = Math.acos(Math.min(1, Math.max(-1, cosD)));
  const ic = Math.atan2(Math.sin(dl) * Math.cos(l2), Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dl));
  const fcBack = Math.atan2(
    Math.sin(-dl) * Math.cos(l1),
    Math.cos(l2) * Math.sin(l1) - Math.sin(l2) * Math.cos(l1) * Math.cos(dl),
  );
  return {
    distanceNm: toDeg(D) * 60,
    initialCourse: norm360(toDeg(ic)),
    finalCourse: norm360(toDeg(fcBack) + 180),
  };
}

/**
 * Meridional parts for latitude L (minutes), WGS84-type spheroid series (as in nautical tables):
 * MP = 7915.7045 · log10 tan(45° + L/2) − 23.0134 · sin L − 0.0517 · sin³ L
 */
export function meridionalParts(latDeg: number): number {
  const L = toRad(latDeg);
  return 7915.7045 * Math.log10(Math.tan(Math.PI / 4 + L / 2)) - 23.0134 * Math.sin(L) - 0.0517 * Math.sin(L) ** 3;
}

/**
 * Mercator sailing: course (°T) and rhumb-line distance (nm).
 * tan C = dLong′ / DMP; distance = dLat′ / cos C (if course ≈ 090/270: distance = departure = dLong′·cos(lat)).
 */
export function mercatorSailing(a: Position, b: Position): { course: number; distanceNm: number; dmp: number } {
  const dLatMin = (b.lat - a.lat) * 60;
  const dLongMin = dLongDeg(a.lon, b.lon) * 60;
  const dmp = meridionalParts(b.lat) - meridionalParts(a.lat);
  const c = Math.atan2(dLongMin, dmp);
  const course = norm360(toDeg(c));
  let distanceNm: number;
  if (Math.abs(Math.cos(c)) < 1e-9) {
    distanceNm = Math.abs(dLongMin) * Math.cos(toRad(a.lat));
  } else {
    distanceNm = Math.abs(dLatMin / Math.cos(c));
  }
  return { course, distanceNm, dmp };
}

/**
 * True amplitude, degrees from E (rising) / W (setting), observed when the body's
 * centre is on the celestial horizon: sin A = sin Dec / cos Lat.
 */
export function trueAmplitude(decDeg: number, latDeg: number): number {
  const s = Math.sin(toRad(decDeg)) / Math.cos(toRad(latDeg));
  if (Math.abs(s) > 1) throw new RangeError("Body does not rise/set at this latitude");
  return toDeg(Math.asin(s));
}

/**
 * Convert an amplitude to a true bearing.
 * Rising: E ± A (N dec → north of E, i.e. 090 − A). Setting: W ± A (N dec → 270 + A).
 */
export function amplitudeToBearing(amplitudeDeg: number, decNorth: boolean, rising: boolean): number {
  const a = Math.abs(amplitudeDeg);
  if (rising) return norm360(decNorth ? 90 - a : 90 + a);
  return norm360(decNorth ? 270 + a : 270 - a);
}

/**
 * True azimuth (°T) of a body from LHA, declination, latitude (all degrees; S negative).
 * tan Z = sin LHA / (cos LHA · sin Lat − tan Dec · cos Lat), resolved to 0–360.
 */
export function trueAzimuth(lhaDeg: number, decDeg: number, latDeg: number): number {
  const lha = toRad(lhaDeg);
  const dec = toRad(decDeg);
  const lat = toRad(latDeg);
  const z = Math.atan2(-Math.sin(lha), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(lha));
  return norm360(toDeg(z));
}

/**
 * Compass error and deviation.
 * Error = True bearing − Compass bearing (+ = East, − = West).
 * Deviation = Error − Variation (variation: + East, − West).
 */
export function compassError(trueBearing: number, compassBearing: number, variation = 0): { error: number; deviation: number } {
  let err = trueBearing - compassBearing;
  if (err > 180) err -= 360;
  if (err < -180) err += 360;
  return { error: err, deviation: err - variation };
}

/**
 * Tide height by the simple cosine method between LW and HW (rule used in nautical tables
 * when no tidal curve is available): h(t) = h_LW + Range · (1 − cos(π · t / D)) / 2,
 * where t = time since LW and D = duration (LW→HW). Times in hours.
 */
export function tideHeightCosine(lwHeight: number, hwHeight: number, lwTime: number, hwTime: number, atTime: number): number {
  const D = hwTime - lwTime;
  if (D === 0) throw new RangeError("HW and LW times must differ");
  const t = (atTime - lwTime) / D;
  if (t < 0 || t > 1) throw new RangeError("time must lie between LW and HW");
  return lwHeight + ((hwHeight - lwHeight) * (1 - Math.cos(Math.PI * t))) / 2;
}

export interface SecondaryPortDiffs {
  hwTimeDiffH: number;
  lwTimeDiffH: number;
  hwHeightDiff: number;
  lwHeightDiff: number;
}

/**
 * Secondary port height of tide: apply time/height differences to the standard port
 * HW/LW, then use the cosine method at the secondary port.
 */
export function secondaryPortTide(
  standard: { lwTime: number; lwHeight: number; hwTime: number; hwHeight: number },
  diffs: SecondaryPortDiffs,
  atTime: number,
): { lwTime: number; hwTime: number; lwHeight: number; hwHeight: number; height: number } {
  const lwTime = standard.lwTime + diffs.lwTimeDiffH;
  const hwTime = standard.hwTime + diffs.hwTimeDiffH;
  const lwHeight = standard.lwHeight + diffs.lwHeightDiff;
  const hwHeight = standard.hwHeight + diffs.hwHeightDiff;
  return { lwTime, hwTime, lwHeight, hwHeight, height: tideHeightCosine(lwHeight, hwHeight, lwTime, hwTime, atTime) };
}

/** Under-keel clearance, m = charted depth + height of tide − draft − squat. */
export function underKeelClearance(chartedDepth: number, heightOfTide: number, draft: number, squatM = 0): number {
  return chartedDepth + heightOfTide - draft - squatM;
}
