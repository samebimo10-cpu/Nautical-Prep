import { describe, expect, it } from "vitest";
import type { CountryConfig, Item } from "@cm/content-schema";
import { buildMock, gradeMock, mockFormat, PRACTICE_FORMAT } from "../src/mock";

const base = { topic: "t", countries: ["*"], difficulty: 1 as const, sources: [], status: "draft" as const, needs_review: true, last_reviewed: null, reviewer: null };
const mcq = (id: string, competence: Item["competence"], correct = 0): Item => ({ ...base, id, competence, type: "mcq", stem: "Question?", options: ["a", "b", "c", "d"], correct_index: correct, explanation: "Because." });
const calc: Item = {
  ...base, id: "calc-1", competence: "STAB", type: "calc", template: "KG {{kg}}", variables: { disp: { min: 10000, max: 10000, step: 1 }, kg: { min: 7, max: 7, step: 1 }, w: { min: 500, max: 500, step: 1 }, wkg: { min: 10, max: 10, step: 1 } },
  calc_fn: "stability.finalKG", units: "m", tolerance: 0.01, worked_solution_template: "1. {{finalKG:3}}",
};
const items: Item[] = [
  ...Array.from({ length: 20 }, (_, i) => mcq(`stab-${i}`, "STAB")),
  ...Array.from({ length: 20 }, (_, i) => mcq(`nav-${i}`, "NAV")),
  ...Array.from({ length: 3 }, (_, i) => mcq(`law-${i}`, "LAW")),
  calc,
];

describe("mock format", () => {
  it("falls back to labelled practice format when config is draft/null", () => {
    expect(mockFormat(undefined)).toEqual({ ...PRACTICE_FORMAT, official: false });
    const cfg = { status: "draft", exam_components: [{ id: "written", format: "draft", duration_minutes: null, pass_mark_percent: null, question_count: null }] } as unknown as CountryConfig;
    expect(mockFormat(cfg).official).toBe(false);
  });
  it("uses official values only from reviewed configs", () => {
    const cfg = { status: "reviewed", exam_components: [{ id: "written", format: "mcq", duration_minutes: 90, pass_mark_percent: 75, question_count: 40 }] } as unknown as CountryConfig;
    expect(mockFormat(cfg)).toEqual({ question_count: 40, duration_minutes: 90, pass_mark_percent: 75, official: true });
  });
});

describe("buildMock", () => {
  it("is deterministic per seed and draws unique items", () => {
    const a = buildMock(items, 20, 1);
    expect(a).toEqual(buildMock(items, 20, 1));
    expect(new Set(a.map((q) => q.item_id)).size).toBe(20);
  });
  it("allocates by weight, capping at availability", () => {
    const m = buildMock(items, 30, 3);
    expect(m).toHaveLength(30);
    expect(m.filter((q) => q.competence === "LAW").length).toBeLessThanOrEqual(3);
  });
  it("never exceeds the pool", () => expect(buildMock(items, 500, 2)).toHaveLength(items.length));
  it("calc questions carry a seed", () => {
    const m = buildMock(items, 44, 5);
    expect(m.find((q) => q.kind === "calc")?.seed).toBeTypeOf("number");
  });
});

describe("gradeMock", () => {
  it("scores mcq + calc, by competence, against pass mark", () => {
    const qs = buildMock(items, 44, 9);
    const map = new Map(items.map((i) => [i.id, i]));
    const answers = qs.map((q) => ({ item_id: q.item_id, value: q.kind === "calc" ? 75000 / 10500 : q.competence === "NAV" ? 1 : 0 }));
    const r = gradeMock(qs, answers, map, 70);
    expect(r.total).toBe(44);
    expect(r.byCompetence.NAV).toEqual({ correct: 0, total: 20 });
    expect(r.correct).toBe(24);
    expect(r.passed).toBe(false);
    const all = gradeMock(qs, qs.map((q) => ({ item_id: q.item_id, value: q.kind === "calc" ? 7.14 : 0 })), map, 70);
    expect(all.percent).toBe(100);
    expect(all.passed).toBe(true);
  });
  it("unanswered questions are wrong", () => {
    const qs = buildMock(items, 5, 1);
    expect(gradeMock(qs, [], new Map(items.map((i) => [i.id, i])), 70).correct).toBe(0);
  });
});
