import { describe, expect, it } from "vitest";
import { dueQueue, isDue, isMature, newCard, qualityFrom, review, DAY_MS } from "../src/srs";

const now = new Date("2026-01-01T00:00:00Z");

describe("SM-2", () => {
  it("first three good reviews give intervals 1, 6, 15 (6 × 2.5)", () => {
    let c = newCard("x", now);
    c = review(c, 4, now);
    expect(c.interval_days).toBe(1);
    c = review(c, 4, now);
    expect(c.interval_days).toBe(6);
    c = review(c, 4, now);
    expect(c.interval_days).toBe(15);
    expect(c.ease).toBeCloseTo(2.5, 3); // q=4 leaves ease unchanged
  });
  it("q=5 increases ease by 0.1; q=3 decreases by 0.14", () => {
    expect(review(newCard("x", now), 5, now).ease).toBeCloseTo(2.6, 3);
    expect(review(newCard("x", now), 3, now).ease).toBeCloseTo(2.36, 3);
  });
  it("a lapse resets reps and interval, counts lapse, floors ease at 1.3", () => {
    let c = { ...newCard("x", now), ease: 1.35, reps: 5, interval_days: 40 };
    c = review(c, 1, now);
    expect(c.reps).toBe(0);
    expect(c.interval_days).toBe(1);
    expect(c.lapses).toBe(1);
    expect(c.ease).toBe(1.3);
  });
  it("confident error (q=0) is due again within the hour", () => {
    const c = review(newCard("x", now), 0, now);
    expect(new Date(c.due_at).getTime() - now.getTime()).toBe(10 * 60_000);
  });
  it("quality mapping rewards calibrated confidence", () => {
    expect(qualityFrom(false, "sure")).toBe(0);
    expect(qualityFrom(false, "guess")).toBe(1);
    expect(qualityFrom(true, "guess")).toBe(3);
    expect(qualityFrom(true, "unsure")).toBe(4);
    expect(qualityFrom(true, "sure")).toBe(5);
    expect(qualityFrom(true)).toBe(4);
  });
  it("due queue sorts most overdue first and respects limit", () => {
    const a = { ...newCard("a", now), due_at: new Date(now.getTime() - 2 * DAY_MS).toISOString() };
    const b = { ...newCard("b", now), due_at: new Date(now.getTime() - 5 * DAY_MS).toISOString() };
    const c = { ...newCard("c", now), due_at: new Date(now.getTime() + DAY_MS).toISOString() };
    expect(dueQueue([a, b, c], now).map((x) => x.item_id)).toEqual(["b", "a"]);
    expect(dueQueue([a, b, c], now, 1)).toHaveLength(1);
    expect(isDue(c, now)).toBe(false);
  });
  it("maturity at 21 days", () => {
    expect(isMature({ ...newCard("a", now), interval_days: 21 })).toBe(true);
    expect(isMature({ ...newCard("a", now), interval_days: 20 })).toBe(false);
  });
});
