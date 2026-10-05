/** Small deterministic PRNG (mulberry32) so a seed always reproduces the same question. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickInRange(rng: () => number, min: number, max: number, step: number): number {
  const n = Math.floor((max - min) / step + 1e-9);
  const k = Math.floor(rng() * (n + 1));
  const v = min + k * step;
  const decimals = (step.toString().split(".")[1] ?? "").length;
  return Number(v.toFixed(decimals));
}
