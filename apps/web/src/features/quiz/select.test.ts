import { describe, expect, it } from "vitest";
import type { Item } from "@cm/content-schema";
import { selectQuiz } from "./select";

const base = { topic: "t", countries: ["*" as const], difficulty: 1 as const, sources: [], status: "draft" as const, needs_review: true, last_reviewed: null, reviewer: null };
const mcq = (id: string, competence: Item["competence"], difficulty: 1 | 2 | 3 = 1): Item => ({ ...base, difficulty, id, competence, type: "mcq", stem: "Question?", options: ["a", "b", "c", "d"], correct_index: 0, explanation: "Because." });
const items = [...["a", "b", "c", "d"].map((x) => mcq(`nav-${x}`, "NAV")), ...["a", "b", "c", "d"].map((x) => mcq(`stab-${x}`, "STAB", 2))];
const att = (item_id: string, score: number) => ({ item_id, item_type: "mcq" as const, competence: "NAV" as const, topic: "t", score, time_ms: 0, created_at: "2026-01-01" });

describe("selectQuiz", () => {
  it("mixed mode interleaves competences", () => {
    const q = selectQuiz(items, [], { mode: "mixed", n: 4, types: ["mcq"] }, 1);
    expect(q.filter((i) => i.competence === "NAV")).toHaveLength(2);
    expect(q[0]!.competence).not.toBe(q[1]!.competence);
  });
  it("unseen first, then missed, then mastered", () => {
    const q = selectQuiz(items.slice(0, 4), [att("nav-a", 1), att("nav-b", 0)], { n: 4, types: ["mcq"] }, 2);
    expect(q.slice(-2).map((i) => i.id)).toEqual(["nav-b", "nav-a"]);
  });
  it("filters by competence, difficulty, ids and errors", () => {
    expect(selectQuiz(items, [], { competence: "STAB", n: 10, types: ["mcq"] }).every((i) => i.competence === "STAB")).toBe(true);
    expect(selectQuiz(items, [], { difficulty: 2, n: 10, types: ["mcq"] })).toHaveLength(4);
    expect(selectQuiz(items, [], { ids: ["nav-c"], n: 10, types: [] }).map((i) => i.id)).toEqual(["nav-c"]);
    expect(selectQuiz(items, [], { errorIds: ["stab-a"], n: 10, types: ["mcq"] }).map((i) => i.id)).toEqual(["stab-a"]);
  });
});
