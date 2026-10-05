import { describe, expect, it } from "vitest";
import type { Item } from "@cm/content-schema";
import { readiness } from "../src/readiness";
import type { Attempt } from "../src/analytics";

const now = new Date("2026-05-01T00:00:00Z");
const base = { topic: "t", countries: ["*"], difficulty: 1 as const, sources: [], status: "draft" as const, needs_review: true, last_reviewed: null, reviewer: null };
const items: Item[] = [
  ...Array.from({ length: 20 }, (_, i): Item => ({ ...base, id: `nav-${i}`, competence: "NAV", type: "mcq", stem: "Question?", options: ["a", "b", "c", "d"], correct_index: 0, explanation: "Because." })),
  ...Array.from({ length: 10 }, (_, i): Item => ({ ...base, id: `stab-${i}`, competence: "STAB", type: "mcq", stem: "Question?", options: ["a", "b", "c", "d"], correct_index: 0, explanation: "Because." })),
  { ...base, id: "lesson-1", competence: "NAV", type: "lesson", title: "L", body_md: "lesson body text" },
];
const att = (id: string, competence: Attempt["competence"], score: number, type: Attempt["item_type"] = "mcq", i = 0): Attempt => ({
  item_id: id, item_type: type, competence, topic: "t", score, time_ms: 1, created_at: new Date(now.getTime() - 86400000 + i * 1000).toISOString(),
});

describe("readiness gate", () => {
  it("brand-new user is not ready and scores 0", () => {
    const r = readiness({ items, attempts: [], mocks: [], orals: [], now });
    expect(r.ready).toBe(false);
    expect(r.score).toBe(0);
    expect(r.checks).toHaveLength(5);
  });
  it("strong user across all bars is ready", () => {
    const attempts = [
      ...items.filter((i) => i.type !== "lesson").map((i) => att(i.id, i.competence, 1)),
      ...Array.from({ length: 20 }, (_, i) => att(`calc-${i}`, "STAB", 1, "calc", i)),
    ];
    const mocks = [90, 88, 92].map((p, i) => ({ percent: p, finished_at: `2026-04-2${i}T00:00:00Z` }));
    const orals = [0.85, 0.9, 0.8].map((a, i) => ({ average: a, criticalFailures: 0, created_at: `2026-04-2${i}T00:00:00Z` }));
    const r = readiness({ items, attempts, mocks, orals, now });
    expect(r.checks.filter((c) => !c.met).map((c) => c.id)).toEqual([]);
    expect(r.ready).toBe(true);
    expect(r.score).toBe(100);
  });
  it("one critical oral failure blocks readiness", () => {
    const attempts = [...items.filter((i) => i.type !== "lesson").map((i) => att(i.id, i.competence, 1)), ...Array.from({ length: 20 }, (_, i) => att(`c${i}`, "STAB", 1, "calc", i))];
    const mocks = [90, 90, 90].map((p, i) => ({ percent: p, finished_at: `2026-04-2${i}` }));
    const orals = [0.95, 0.95, 0.95].map((a, i) => ({ average: a, criticalFailures: i === 0 ? 1 : 0, created_at: `2026-04-2${i}` }));
    const r = readiness({ items, attempts, mocks, orals, now });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.id === "orals")!.met).toBe(false);
  });
  it("a mock below 85% blocks readiness even if passing 70%", () => {
    const mocks = [90, 75, 90].map((p, i) => ({ percent: p, finished_at: `2026-04-2${i}` }));
    expect(readiness({ items, attempts: [], mocks, orals: [], now }).checks.find((c) => c.id === "mocks")!.met).toBe(false);
  });
  it("latest attempt per item counts — re-drilling one item can't inflate accuracy", () => {
    const attempts = [att("nav-0", "NAV", 0, "mcq", 0), att("nav-0", "NAV", 1, "mcq", 5), att("nav-1", "NAV", 0, "mcq", 1)];
    const r = readiness({ items, attempts, mocks: [], orals: [], now });
    expect(r.checks.find((c) => c.id === "competence")!.detail).toContain("NAV 50% (2/15)");
    expect(r.weakest[0]).toBe("STAB");
  });
});
