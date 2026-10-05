import type { Item } from "@cm/content-schema";
import { newCard, qualityFrom, review, type Attempt, type Confidence } from "@cm/learning";
import { db } from "./db";
import { enqueue } from "./sync";

/** Record an attempt locally, schedule SRS, and queue it for sync. */
export async function recordAttempt(
  item: Pick<Item, "id" | "competence" | "topic"> & { type: Attempt["item_type"] },
  score: number,
  opts: { timeMs: number; confidence?: Confidence; answer?: unknown; source?: Attempt["source"] } = { timeMs: 0 },
): Promise<void> {
  const now = new Date();
  const attempt: Omit<Attempt, "id"> = {
    item_id: item.id,
    item_type: item.type,
    competence: item.competence,
    topic: item.topic,
    score,
    time_ms: opts.timeMs,
    created_at: now.toISOString(),
    confidence: opts.confidence,
    answer: opts.answer,
    source: opts.source,
  };
  const localId = await db.attempts.add({ ...attempt, synced: 0 });
  await enqueue("attempt", { local_id: localId, item_id: attempt.item_id, answer: attempt.answer ?? null, score, time_ms: attempt.time_ms, created_at: attempt.created_at });
  // SRS: every missed item enters the deck; correct items already in the deck are rescheduled.
  const existing = await db.srs.get(item.id);
  const correct = score >= 0.6;
  if (existing || !correct) {
    const card = review(existing ?? newCard(item.id, now), qualityFrom(correct, opts.confidence), now);
    await db.srs.put(card);
  }
}

export async function trackEvent(name: string, props?: Record<string, unknown>): Promise<void> {
  const at = new Date().toISOString();
  await db.events.add({ name, at, props });
  await enqueue("event", { name, at, props: props ?? {} });
}
