export const DEG = Math.PI / 180;
export const toRad = (d: number) => d * DEG;
export const toDeg = (r: number) => r / DEG;

/** Round to n decimal places (half away from zero). */
export function round(x: number, n = 2): number {
  const f = 10 ** n;
  return Math.sign(x) * Math.round(Math.abs(x) * f + Number.EPSILON) / f;
}

/** Normalise an angle to [0, 360). */
export function norm360(d: number): number {
  const r = d % 360;
  return r < 0 ? r + 360 : r;
}

export function assertPositive(name: string, v: number): void {
  if (!(v > 0) || !Number.isFinite(v)) throw new RangeError(`${name} must be a positive number (got ${v})`);
}
