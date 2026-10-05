/**
 * SM-2 spaced repetition (Wozniak, 1987) with confidence-aware quality mapping.
 * Quality q: 0–5. q < 3 = lapse (card relearned from interval 1).
 */
export interface SrsCard {
  item_id: string;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  due_at: string; // ISO
  last_reviewed_at?: string;
}

export type Confidence = "sure" | "unsure" | "guess";

export const DAY_MS = 86_400_000;

export function newCard(itemId: string, now: Date): SrsCard {
  return { item_id: itemId, ease: 2.5, interval_days: 0, reps: 0, lapses: 0, due_at: now.toISOString() };
}

/**
 * Map an answer outcome to SM-2 quality.
 * - wrong & sure (confident error)      → 0  (hypercorrection: re-review soonest)
 * - wrong otherwise                     → 1
 * - correct but guessed                 → 3
 * - correct but unsure                  → 4
 * - correct and sure                    → 5
 */
export function qualityFrom(correct: boolean, confidence: Confidence = "unsure"): number {
  if (!correct) return confidence === "sure" ? 0 : 1;
  if (confidence === "guess") return 3;
  if (confidence === "unsure") return 4;
  return 5;
}

export function review(card: SrsCard, quality: number, now: Date): SrsCard {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ease, interval_days, reps, lapses } = card;
  if (q < 3) {
    reps = 0;
    interval_days = 1;
    lapses += 1;
  } else {
    if (reps === 0) interval_days = 1;
    else if (reps === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease);
    reps += 1;
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  // Confident errors come back the same day (10 minutes) rather than tomorrow.
  const dueMs = q === 0 ? now.getTime() + 10 * 60_000 : now.getTime() + interval_days * DAY_MS;
  return {
    ...card,
    ease: Number(ease.toFixed(3)),
    interval_days,
    reps,
    lapses,
    due_at: new Date(dueMs).toISOString(),
    last_reviewed_at: now.toISOString(),
  };
}

export function isDue(card: SrsCard, now: Date): boolean {
  return new Date(card.due_at).getTime() <= now.getTime();
}

/** Daily queue: due cards, most overdue and most-lapsed first, capped at `limit`. */
export function dueQueue(cards: SrsCard[], now: Date, limit = 50): SrsCard[] {
  return cards
    .filter((c) => isDue(c, now))
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime() || b.lapses - a.lapses)
    .slice(0, limit);
}

/** A card is "mature" once its interval is ≥ 21 days — used as a retention signal. */
export function isMature(card: SrsCard): boolean {
  return card.interval_days >= 21;
}
