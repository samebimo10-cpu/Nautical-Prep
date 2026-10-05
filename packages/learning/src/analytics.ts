import { COMPETENCES, SYLLABUS_WEIGHTS, type Competence } from "@cm/content-schema";
import { DAY_MS, type Confidence } from "./srs";

export interface Attempt {
  id?: string;
  item_id: string;
  item_type: "mcq" | "written" | "calc" | "oral" | "scenario" | "flashcard";
  competence: Competence;
  topic: string;
  /** 0..1 */
  score: number;
  time_ms: number;
  created_at: string;
  confidence?: Confidence;
  answer?: unknown;
  source?: "quiz" | "mock" | "review" | "calc" | "oral" | "colregs";
}

export interface Stat {
  attempts: number;
  avg: number; // 0..1
}

function windowed(attempts: Attempt[], now: Date, days: number): Attempt[] {
  const from = now.getTime() - days * DAY_MS;
  return attempts.filter((a) => new Date(a.created_at).getTime() >= from);
}

function agg(list: Attempt[]): Stat {
  if (list.length === 0) return { attempts: 0, avg: 0 };
  return { attempts: list.length, avg: list.reduce((s, a) => s + a.score, 0) / list.length };
}

/** Score per competence over the last `days` days. */
export function scoreByCompetence(attempts: Attempt[], now: Date, days = 30): Record<Competence, Stat> {
  const recent = windowed(attempts, now, days);
  const out = {} as Record<Competence, Stat>;
  for (const c of COMPETENCES) out[c] = agg(recent.filter((a) => a.competence === c));
  return out;
}

/** Score per topic over the last `days` days, keyed "COMP/topic". */
export function scoreByTopic(attempts: Attempt[], now: Date, days = 30): Record<string, Stat & { competence: Competence; topic: string }> {
  const recent = windowed(attempts, now, days);
  const groups = new Map<string, Attempt[]>();
  for (const a of recent) {
    const k = `${a.competence}/${a.topic}`;
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const out: Record<string, Stat & { competence: Competence; topic: string }> = {};
  for (const [k, list] of groups) out[k] = { ...agg(list), competence: list[0]!.competence, topic: list[0]!.topic };
  return out;
}

export interface Recommendation {
  competence: Competence;
  topic?: string;
  priority: number;
  avg: number;
  attempts: number;
  reason: string;
}

/**
 * "Study next": priority = (1 − score) × syllabus weight. Unattempted areas score 0 and are
 * therefore top priority. Topics with < 3 attempts are treated as unknown.
 */
export function studyNext(
  attempts: Attempt[],
  available: { competence: Competence; topic: string }[],
  now: Date,
  limit = 3,
): Recommendation[] {
  const byTopic = scoreByTopic(attempts, now, 30);
  const seen = new Set<string>();
  const recs: Recommendation[] = [];
  for (const { competence, topic } of available) {
    const key = `${competence}/${topic}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const s = byTopic[key];
    const avg = s && s.attempts >= 3 ? s.avg : 0;
    const priority = (1 - avg) * SYLLABUS_WEIGHTS[competence];
    const reason = !s ? "Not started yet" : s.attempts < 3 ? "Too few attempts to judge" : `Scoring ${Math.round(s.avg * 100)}%`;
    recs.push({ competence, topic, priority, avg, attempts: s?.attempts ?? 0, reason });
  }
  return recs.sort((a, b) => b.priority - a.priority || a.attempts - b.attempts).slice(0, limit);
}

/** Consecutive study days ending today (or yesterday, so the streak survives until midnight). */
export function streakDays(attempts: Attempt[], now: Date): number {
  const days = new Set(attempts.map((a) => a.created_at.slice(0, 10)));
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (days.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

/** Items the user answered wrong while "sure" — the highest-value items to revisit. */
export function confidentErrors(attempts: Attempt[]): string[] {
  const latest = new Map<string, Attempt>();
  for (const a of [...attempts].sort((x, y) => x.created_at.localeCompare(y.created_at))) latest.set(a.item_id, a);
  return [...latest.values()].filter((a) => a.score < 0.5 && a.confidence === "sure").map((a) => a.item_id);
}

/** Self-marking for written answers: score = Σ weights ticked / Σ all weights. */
export function selfMarkScore(points: { weight: number }[], ticked: boolean[]): number {
  const total = points.reduce((s, p) => s + p.weight, 0);
  if (total === 0) return 0;
  return points.reduce((s, p, i) => s + (ticked[i] ? p.weight : 0), 0) / total;
}
