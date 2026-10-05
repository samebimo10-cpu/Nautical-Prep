import type { Item } from "@cm/content-schema";
import { mulberry32 } from "@cm/calc";
import type { Attempt } from "@cm/learning";

export interface QuizQuery {
  mode?: string;
  competence?: string;
  topic?: string;
  difficulty?: number;
  n: number;
  types: string[];
  ids?: string[];
  errorIds?: string[];
}

function shuffle<T>(a: T[], rng: () => number): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [x[i], x[j]] = [x[j]!, x[i]!];
  }
  return x;
}

/**
 * Pick quiz items. Unseen and previously-missed items first (desirable difficulty), then the rest.
 * Mixed mode round-robins across competences (interleaving).
 */
export function selectQuiz(items: Item[], attempts: Attempt[], q: QuizQuery, seed = Date.now()): Item[] {
  const rng = mulberry32(seed);
  if (q.ids?.length) return items.filter((i) => q.ids!.includes(i.id));
  let pool = items.filter((i) => q.types.includes(i.type) && i.status !== "retired");
  if (q.errorIds) pool = items.filter((i) => q.errorIds!.includes(i.id));
  if (q.competence) pool = pool.filter((i) => i.competence === q.competence);
  if (q.topic) pool = pool.filter((i) => i.topic === q.topic);
  if (q.difficulty) pool = pool.filter((i) => i.difficulty === q.difficulty);
  const latest = new Map<string, number>();
  for (const a of attempts) latest.set(a.item_id, a.score);
  const rank = (i: Item) => (!latest.has(i.id) ? 0 : latest.get(i.id)! < 0.6 ? 1 : 2);
  const ordered = shuffle(pool, rng).sort((a, b) => rank(a) - rank(b));
  if (q.mode !== "mixed") return ordered.slice(0, q.n);
  const byComp = new Map<string, Item[]>();
  for (const i of ordered) byComp.set(i.competence, [...(byComp.get(i.competence) ?? []), i]);
  const out: Item[] = [];
  const lists = shuffle([...byComp.values()], rng);
  while (out.length < q.n && lists.some((l) => l.length)) for (const l of lists) if (l.length && out.length < q.n) out.push(l.shift()!);
  return out;
}
