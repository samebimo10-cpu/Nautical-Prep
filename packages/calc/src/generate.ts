import { pickInRange, mulberry32 } from "./rng";
import { runCalc, type Vars } from "./registry";
import { round } from "./util";

export interface CalcTemplate {
  template: string;
  variables: Record<string, { min: number; max: number; step: number }>;
  calc_fn: string;
  units: string;
  tolerance: number;
  worked_solution_template: string;
}

export interface GeneratedCalc {
  seed: number;
  vars: Vars;
  stem: string;
  answer: number;
  units: string;
  tolerance: number;
  steps: string[];
  values: Record<string, number>;
}

/**
 * Replace {{name}} with vars and {{name:2}} with value rounded to 2 dp.
 * Unknown placeholders are left visible so content errors are obvious.
 */
export function render(tpl: string, values: Record<string, number>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)(?::(\d))?\s*\}\}/g, (m, k: string, dp?: string) => {
    const v = values[k];
    if (v === undefined) return m;
    if (dp !== undefined) return round(v, Number(dp)).toFixed(Number(dp));
    return String(round(v, 4));
  });
}

/** Generate a randomised calculation question from a template. Same seed → same question. */
export function generateCalc(item: CalcTemplate, seed: number): GeneratedCalc {
  const rng = mulberry32(seed);
  const vars: Vars = {};
  for (const [k, r] of Object.entries(item.variables)) vars[k] = pickInRange(rng, r.min, r.max, r.step);
  const { answer, values } = runCalc(item.calc_fn, vars);
  const all = { ...vars, ...values, answer };
  const steps = render(item.worked_solution_template, all)
    .split(/\n\s*\n|\n(?=\d+\.)/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { seed, vars, stem: render(item.template, vars), answer, units: item.units, tolerance: item.tolerance, steps, values };
}

/** True when the user's numeric answer is within tolerance of the computed answer. */
export function gradeCalc(answer: number, userAnswer: number, tolerance: number): boolean {
  if (!Number.isFinite(userAnswer)) return false;
  return Math.abs(answer - userAnswer) <= tolerance + 1e-9;
}
