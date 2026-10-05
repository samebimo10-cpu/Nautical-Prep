import { COMPETENCES, type Competence, type Item } from "@cm/content-schema";
import type { Attempt } from "./analytics";
import { DAY_MS } from "./srs";

/**
 * Exam-readiness gate. The bars are deliberately HIGHER than typical pass marks so that a
 * candidate who clears them in the app has margin on the day (see DECISIONS.md D-008).
 */
export const READINESS_BARS = {
  coverage: 0.9, // share of practice items attempted at least once
  competenceAccuracy: 0.85, // each competence, last 30 days, latest attempt per item
  minAttemptsPerCompetence: 15,
  mockPercent: 85, // last 3 mocks each ≥ 85%
  mocksRequired: 3,
  oralAverage: 0.8, // last 3 orals average ≥ 80%, no critical failure
  oralsRequired: 3,
  calcAccuracy: 0.85, // last 20 calculation attempts
  calcAttempts: 20,
} as const;

export interface MockSummary {
  percent: number;
  finished_at: string;
}
export interface OralSummary {
  average: number;
  criticalFailures: number;
  created_at: string;
}

export interface ReadinessCheck {
  id: string;
  label: string;
  value: number; // 0..1 progress toward the bar
  met: boolean;
  detail: string;
}

export interface Readiness {
  ready: boolean;
  score: number; // 0..100
  checks: ReadinessCheck[];
  weakest: Competence[];
}

export function readiness(input: { items: Item[]; attempts: Attempt[]; mocks: MockSummary[]; orals: OralSummary[]; now: Date }): Readiness {
  const { items, attempts, mocks, orals, now } = input;
  const practice = items.filter((i) => i.type !== "lesson");
  const ids = new Set(practice.map((i) => i.id));
  const seen = new Set(attempts.filter((a) => ids.has(a.item_id)).map((a) => a.item_id));
  const coverage = practice.length ? seen.size / practice.length : 0;

  const from = now.getTime() - 30 * DAY_MS;
  const recent = attempts.filter((a) => new Date(a.created_at).getTime() >= from);
  // latest attempt per item, so repeated drilling of one easy item can't inflate accuracy
  const latest = new Map<string, Attempt>();
  for (const a of [...recent].sort((x, y) => x.created_at.localeCompare(y.created_at))) latest.set(a.item_id, a);
  const compChecks: { c: Competence; acc: number; n: number; need: number }[] = [];
  for (const c of COMPETENCES) {
    const available = practice.filter((i) => i.competence === c).length;
    if (!available) continue;
    const list = [...latest.values()].filter((a) => a.competence === c);
    const need = Math.min(READINESS_BARS.minAttemptsPerCompetence, available);
    const acc = list.length ? list.reduce((s, a) => s + a.score, 0) / list.length : 0;
    compChecks.push({ c, acc, n: list.length, need });
  }
  const compMet = compChecks.every((x) => x.n >= x.need && x.acc >= READINESS_BARS.competenceAccuracy);
  const compProgress = compChecks.length
    ? compChecks.reduce((s, x) => s + Math.min(1, x.acc / READINESS_BARS.competenceAccuracy) * Math.min(1, x.n / x.need), 0) / compChecks.length
    : 0;

  const lastMocks = [...mocks].sort((a, b) => b.finished_at.localeCompare(a.finished_at)).slice(0, READINESS_BARS.mocksRequired);
  const mocksGood = lastMocks.filter((m) => m.percent >= READINESS_BARS.mockPercent).length;
  const mockMet = lastMocks.length === READINESS_BARS.mocksRequired && mocksGood === READINESS_BARS.mocksRequired;

  const lastOrals = [...orals].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, READINESS_BARS.oralsRequired);
  const oralAvg = lastOrals.length ? lastOrals.reduce((s, o) => s + o.average, 0) / lastOrals.length : 0;
  const oralCrit = lastOrals.some((o) => o.criticalFailures > 0);
  const oralMet = lastOrals.length === READINESS_BARS.oralsRequired && oralAvg >= READINESS_BARS.oralAverage && !oralCrit;

  const calcs = [...attempts].filter((a) => a.item_type === "calc").sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, READINESS_BARS.calcAttempts);
  const calcAcc = calcs.length ? calcs.reduce((s, a) => s + a.score, 0) / calcs.length : 0;
  const calcMet = calcs.length >= READINESS_BARS.calcAttempts && calcAcc >= READINESS_BARS.calcAccuracy;

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const checks: ReadinessCheck[] = [
    { id: "coverage", label: "Syllabus coverage", value: Math.min(1, coverage / READINESS_BARS.coverage), met: coverage >= READINESS_BARS.coverage, detail: `${seen.size}/${practice.length} items attempted (need ${pct(READINESS_BARS.coverage)})` },
    { id: "competence", label: "Every competence ≥ 85%", value: compProgress, met: compMet, detail: compChecks.map((x) => `${x.c} ${pct(x.acc)} (${x.n}/${x.need})`).join(" · ") },
    { id: "calc", label: "Calculations ≥ 85%", value: Math.min(1, (calcAcc / READINESS_BARS.calcAccuracy) * (calcs.length / READINESS_BARS.calcAttempts)), met: calcMet, detail: `${pct(calcAcc)} over last ${calcs.length}/${READINESS_BARS.calcAttempts} calculations` },
    { id: "mocks", label: "3 mocks in a row ≥ 85%", value: mocksGood / READINESS_BARS.mocksRequired, met: mockMet, detail: `${mocksGood}/3 recent mocks at ≥ 85%` },
    { id: "orals", label: "3 orals avg ≥ 80%, no critical fail", value: Math.min(1, (oralAvg / READINESS_BARS.oralAverage) * (lastOrals.length / READINESS_BARS.oralsRequired)) * (oralCrit ? 0.5 : 1), met: oralMet, detail: `${lastOrals.length}/3 orals, avg ${pct(oralAvg)}${oralCrit ? ", critical failure present" : ""}` },
  ];
  const score = Math.round((checks.reduce((s, c) => s + c.value, 0) / checks.length) * 100);
  const weakest = [...compChecks].sort((a, b) => a.acc - b.acc).slice(0, 2).map((x) => x.c);
  return { ready: checks.every((c) => c.met), score, checks, weakest };
}
