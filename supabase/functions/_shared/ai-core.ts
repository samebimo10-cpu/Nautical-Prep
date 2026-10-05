/**
 * Pure logic shared by the Edge Functions (Deno) and unit tests (Vitest).
 * The model is passed in as `call`, so tests can mock responses.
 */
import { z } from "zod";

export const GradeResult = z.object({
  score: z.number().min(0).max(1),
  points_hit: z.array(z.string()),
  points_missed: z.array(z.string()),
  feedback: z.string(),
});
export type GradeResult = z.infer<typeof GradeResult>;

export const OralGrade = z.object({
  points_hit: z.array(z.string()),
  points_missed: z.array(z.string()),
  low_confidence: z.boolean(),
  examiner_reply: z.string(),
});
export type OralGrade = z.infer<typeof OralGrade>;

export type ModelCall = (system: string, user: string, schema: "grade" | "oral") => Promise<unknown>;

export interface WrittenItemLite {
  id: string;
  prompt: string;
  model_answer: string;
  marking_points: { point: string; weight: number }[];
}

export function gradeUserPrompt(item: WrittenItemLite, answer: string): string {
  return [
    `QUESTION:\n${item.prompt}`,
    `MODEL ANSWER:\n${item.model_answer}`,
    `MARKING POINTS (point — weight):\n${item.marking_points.map((p) => `- ${p.point} — ${p.weight}`).join("\n")}`,
    `CANDIDATE ANSWER:\n<<<\n${answer.slice(0, 6000)}\n>>>`,
  ].join("\n\n");
}

/** Recompute the score from the hit points so the number never comes from the model. */
export function scoreFromPoints(points: { point: string; weight: number }[], hit: string[]): number {
  const total = points.reduce((s, p) => s + p.weight, 0);
  const hitSet = new Set(hit.map((h) => h.trim().toLowerCase()));
  const got = points.filter((p) => hitSet.has(p.point.trim().toLowerCase())).reduce((s, p) => s + p.weight, 0);
  return total ? got / total : 0;
}

/** Call the model, validate with Zod, retry once on invalid output. */
export async function validated<T>(schema: z.ZodType<T>, attempt: () => Promise<unknown>): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const raw = await attempt();
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      return schema.parse(obj);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`model output invalid after retry: ${(lastErr as Error)?.message ?? lastErr}`);
}

export async function gradeWritten(call: ModelCall, system: string, item: WrittenItemLite, answer: string): Promise<GradeResult> {
  const r = await validated(GradeResult, () => call(system, gradeUserPrompt(item, answer), "grade"));
  const valid = new Set(item.marking_points.map((p) => p.point));
  const hit = r.points_hit.filter((p) => valid.has(p));
  return { ...r, points_hit: hit, points_missed: item.marking_points.map((p) => p.point).filter((p) => !hit.includes(p)), score: scoreFromPoints(item.marking_points, hit) };
}

// ------------------------------------------------------------------ quotas

export interface QuotaInput {
  usedToday: number;
  dailyLimit: number;
  monthSpendUsd: number;
  monthlyCapUsd: number;
}
export function quotaDecision(q: QuotaInput): { allowed: boolean; reason?: string } {
  if (q.monthSpendUsd >= q.monthlyCapUsd) return { allowed: false, reason: "monthly AI budget reached" };
  if (q.usedToday >= q.dailyLimit) return { allowed: false, reason: "daily AI quota reached for your plan" };
  return { allowed: true };
}
export const TIER_LIMITS: Record<string, { grade: number; oral_turn: number }> = {
  free: { grade: 3, oral_turn: 0 },
  pro: { grade: 20, oral_turn: 0 },
  pro_oral: { grade: 40, oral_turn: 3 * 30 }, // 3 sessions/day × up to ~30 turns
};
/** Price per 1M tokens (USD) for cost logging — keep in sync with the model in use. */
export const PRICE = { input: 4, output: 20 };
export const costUsd = (inTok: number, outTok: number) => (inTok * PRICE.input + outTok * PRICE.output) / 1_000_000;

// ------------------------------------------------------------------ oral examiner state machine

export interface OralItemLite {
  id: string;
  question: string;
  model_answer: string;
  key_points: (string | { point: string })[];
  follow_ups: string[];
  critical: boolean;
}
export interface OralState {
  persona: string;
  item_ids: string[];
  index: number;
  probed: boolean;
  pending_answer: string;
  results: { item_id: string; score: number; points_hit: string[]; points_missed: string[]; critical: boolean; low_confidence: boolean }[];
}
export const kpText = (k: string | { point: string }) => (typeof k === "string" ? k : k.point);

export function oralUserPrompt(item: OralItemLite, answer: string, followUp?: string): string {
  return [
    `QUESTION:\n${item.question}`,
    `MODEL ANSWER (confidential):\n${item.model_answer}`,
    `KEY POINTS:\n${item.key_points.map((k) => `- ${kpText(k)}`).join("\n")}`,
    followUp ? `FOLLOW-UP AVAILABLE (ask if answer weak): ${followUp}` : "NO FOLLOW-UP AVAILABLE",
    `CANDIDATE ANSWER:\n<<<\n${answer.slice(0, 4000)}\n>>>`,
  ].join("\n\n");
}

export function startOralState(persona: string, itemIds: string[]): OralState {
  return { persona, item_ids: itemIds, index: 0, probed: false, pending_answer: "", results: [] };
}

export interface OralStep {
  state: OralState;
  examiner_text: string;
  grade?: OralState["results"][number];
  done: boolean;
  verdict?: { passed: boolean; average: number; debrief: string };
}

/** One candidate turn. Questions always come from the bank (never generated). */
export async function oralStep(call: ModelCall, system: string, state: OralState, items: Map<string, OralItemLite>, answer: string): Promise<OralStep> {
  const item = items.get(state.item_ids[state.index]!);
  if (!item) throw new Error("oral item missing");
  const combined = state.probed ? `${state.pending_answer}\n${answer}` : answer;
  const fu = !state.probed ? item.follow_ups[0] : undefined;
  const g = await validated(OralGrade, () => call(system, oralUserPrompt(item, combined, fu), "oral"));
  const allPoints = item.key_points.map(kpText);
  const hit = g.points_hit.filter((p) => allPoints.includes(p));
  const score = allPoints.length ? hit.length / allPoints.length : 0;
  if (!state.probed && score < 0.6 && fu) {
    return { state: { ...state, probed: true, pending_answer: answer }, examiner_text: g.examiner_reply, done: false };
  }
  const result = { item_id: item.id, score, points_hit: hit, points_missed: allPoints.filter((p) => !hit.includes(p)), critical: item.critical, low_confidence: g.low_confidence };
  const next: OralState = { ...state, index: state.index + 1, probed: false, pending_answer: "", results: [...state.results, result] };
  if (next.index >= next.item_ids.length) {
    const average = next.results.reduce((s, r) => s + r.score, 0) / next.results.length;
    const critFail = next.results.filter((r) => r.critical && r.score < 0.5);
    const passed = average >= 0.7 && critFail.length === 0;
    const debrief = next.results
      .filter((r) => r.points_missed.length)
      .map((r) => `• ${items.get(r.item_id)?.question}: missed ${r.points_missed.join("; ")}`)
      .join("\n");
    return { state: next, grade: result, done: true, examiner_text: `${g.examiner_reply} That concludes the examination.`, verdict: { passed, average, debrief: debrief || "All key points covered." } };
  }
  const nextQ = items.get(next.item_ids[next.index]!)!.question;
  return { state: next, grade: result, done: false, examiner_text: `${g.examiner_reply} ${nextQ}` };
}

/** Pick N oral items for a country, interleaving competences. Deterministic for a seed. */
export function pickOralItems<T extends { id: string; competence: string }>(pool: T[], n: number, seed: number): string[] {
  let a = seed >>> 0;
  const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  const shuffled = [...pool].sort(() => rnd() - 0.5);
  const by = new Map<string, T[]>();
  for (const i of shuffled) by.set(i.competence, [...(by.get(i.competence) ?? []), i]);
  const out: string[] = [];
  while (out.length < n && [...by.values()].some((l) => l.length)) for (const l of by.values()) if (l.length && out.length < n) out.push(l.shift()!.id);
  return out;
}
