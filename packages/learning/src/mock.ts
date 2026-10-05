import { COMPETENCES, SYLLABUS_WEIGHTS, type CountryConfig, type Competence, type Item } from "@cm/content-schema";
import { generateCalc, mulberry32 } from "@cm/calc";

export const PRACTICE_FORMAT = { question_count: 50, duration_minutes: 120, pass_mark_percent: 70 } as const;

export interface MockFormat {
  question_count: number;
  duration_minutes: number;
  pass_mark_percent: number;
  official: boolean;
}

/** Resolve mock format from the country's written component; fall back to the labelled practice default. */
export function mockFormat(config: CountryConfig | undefined): MockFormat {
  const w = config?.exam_components.find((c) => c.id === "written");
  const official =
    !!w && config?.status === "reviewed" && w.duration_minutes != null && w.pass_mark_percent != null && w.question_count != null;
  if (official && w) {
    return { question_count: w.question_count!, duration_minutes: w.duration_minutes!, pass_mark_percent: w.pass_mark_percent!, official: true };
  }
  return { ...PRACTICE_FORMAT, official: false };
}

export interface MockQuestion {
  item_id: string;
  competence: Competence;
  topic: string;
  kind: "mcq" | "calc";
  /** for calc questions, the generator seed */
  seed?: number;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Build a mock paper: allocate questions to competences in proportion to syllabus weight
 * (only competences with items), then draw MCQ/calc items at random. Deterministic per seed.
 */
export function buildMock(items: Item[], count: number, seed: number): MockQuestion[] {
  const rng = mulberry32(seed);
  const pool = items.filter((i) => i.type === "mcq" || i.type === "calc");
  const byComp = new Map<Competence, Item[]>();
  for (const c of COMPETENCES) {
    const list = pool.filter((i) => i.competence === c);
    if (list.length) byComp.set(c, shuffle(list, rng));
  }
  const comps = [...byComp.keys()];
  const totalW = comps.reduce((s, c) => s + SYLLABUS_WEIGHTS[c], 0);
  const target = Math.min(count, pool.length);
  // largest-remainder allocation
  const raw = comps.map((c) => ({ c, exact: (SYLLABUS_WEIGHTS[c] / totalW) * target }));
  const alloc = new Map(raw.map((r) => [r.c, Math.min(Math.floor(r.exact), byComp.get(r.c)!.length)]));
  let left = target - [...alloc.values()].reduce((s, x) => s + x, 0);
  const order = [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1));
  while (left > 0) {
    let progressed = false;
    for (const { c } of order) {
      if (left === 0) break;
      if (alloc.get(c)! < byComp.get(c)!.length) {
        alloc.set(c, alloc.get(c)! + 1);
        left--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  const out: MockQuestion[] = [];
  for (const c of comps) {
    for (const it of byComp.get(c)!.slice(0, alloc.get(c))) {
      out.push({
        item_id: it.id,
        competence: it.competence,
        topic: it.topic,
        kind: it.type === "calc" ? "calc" : "mcq",
        seed: it.type === "calc" ? Math.floor(rng() * 1e9) : undefined,
      });
    }
  }
  return shuffle(out, rng);
}

export interface MockAnswer {
  item_id: string;
  /** mcq: option index; calc: number */
  value: number | null;
}

export interface MockResult {
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  byCompetence: Partial<Record<Competence, { correct: number; total: number }>>;
  perQuestion: { item_id: string; correct: boolean }[];
}

export function gradeMock(questions: MockQuestion[], answers: MockAnswer[], items: Map<string, Item>, passMark: number): MockResult {
  const ans = new Map(answers.map((a) => [a.item_id, a.value]));
  const byCompetence: MockResult["byCompetence"] = {};
  const perQuestion: MockResult["perQuestion"] = [];
  let correct = 0;
  for (const q of questions) {
    const it = items.get(q.item_id);
    const v = ans.get(q.item_id);
    let ok = false;
    if (it && v != null) {
      if (it.type === "mcq") ok = v === it.correct_index;
      else if (it.type === "calc") {
        const g = generateCalc(it, q.seed ?? 0);
        ok = Math.abs(g.answer - v) <= it.tolerance + 1e-9;
      }
    }
    if (ok) correct++;
    const b = (byCompetence[q.competence] ??= { correct: 0, total: 0 });
    b.total++;
    if (ok) b.correct++;
    perQuestion.push({ item_id: q.item_id, correct: ok });
  }
  const total = questions.length;
  const percent = total ? (correct / total) * 100 : 0;
  return { correct, total, percent, passed: percent >= passMark, byCompetence, perQuestion };
}
