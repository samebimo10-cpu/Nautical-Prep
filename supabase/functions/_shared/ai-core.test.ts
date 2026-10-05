import { describe, expect, it, vi } from "vitest";
import { gradeWritten, oralStep, pickOralItems, quotaDecision, scoreFromPoints, startOralState, validated, costUsd, GradeResult, type ModelCall } from "./ai-core";
import { subscriptionFromEvent, verifyPaystackSignature } from "./paystack";
import { createHmac } from "node:crypto";

const item = { id: "w1", prompt: "Q?", model_answer: "A", marking_points: [{ point: "Alpha", weight: 2 }, { point: "Beta", weight: 1 }, { point: "Gamma", weight: 1 }] };

describe("grade-answer core", () => {
  it("score is recomputed from points, never trusted from the model", async () => {
    const call: ModelCall = vi.fn(async () => ({ score: 0.99, points_hit: ["Alpha", "Invented point"], points_missed: [], feedback: "Good." }));
    const r = await gradeWritten(call, "sys", item, "some answer");
    expect(r.score).toBe(0.5);
    expect(r.points_hit).toEqual(["Alpha"]);
    expect(r.points_missed).toEqual(["Beta", "Gamma"]);
  });
  it("retries once on invalid JSON, then succeeds", async () => {
    const call = vi.fn().mockResolvedValueOnce("{not json").mockResolvedValueOnce({ score: 1, points_hit: ["Alpha", "Beta", "Gamma"], points_missed: [], feedback: "ok" });
    const r = await gradeWritten(call, "sys", item, "x");
    expect(call).toHaveBeenCalledTimes(2);
    expect(r.score).toBe(1);
  });
  it("fails after two invalid outputs", async () => {
    const call = vi.fn().mockResolvedValue({ wrong: true });
    await expect(validated(GradeResult, () => call())).rejects.toThrow(/invalid after retry/);
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("scoreFromPoints is case-insensitive", () => expect(scoreFromPoints(item.marking_points, ["alpha", "gamma"])).toBe(0.75));
});

describe("quota and cost", () => {
  it("blocks on budget cap before daily quota", () => {
    expect(quotaDecision({ usedToday: 0, dailyLimit: 5, monthSpendUsd: 100, monthlyCapUsd: 100 })).toEqual({ allowed: false, reason: "monthly AI budget reached" });
    expect(quotaDecision({ usedToday: 5, dailyLimit: 5, monthSpendUsd: 1, monthlyCapUsd: 100 }).allowed).toBe(false);
    expect(quotaDecision({ usedToday: 4, dailyLimit: 5, monthSpendUsd: 1, monthlyCapUsd: 100 }).allowed).toBe(true);
    expect(quotaDecision({ usedToday: 0, dailyLimit: 0, monthSpendUsd: 0, monthlyCapUsd: 100 }).allowed).toBe(false);
  });
  it("cost per call", () => expect(costUsd(1_000_000, 100_000)).toBeCloseTo(6));
});

describe("oral-examiner core", () => {
  const items = new Map([
    ["o1", { id: "o1", question: "Q1?", model_answer: "A1", key_points: ["P1", { point: "P2" }], follow_ups: ["F1?"], critical: false }],
    ["o2", { id: "o2", question: "Q2?", model_answer: "A2", key_points: ["K1", "K2"], follow_ups: [], critical: true }],
  ]);
  it("probes weak answer, grades combined, ends with deterministic verdict and debrief", async () => {
    const replies = [
      { points_hit: [], points_missed: ["P1", "P2"], low_confidence: false, examiner_reply: "And what else? F1?" },
      { points_hit: ["P1", "P2"], points_missed: [], low_confidence: false, examiner_reply: "Thank you." },
      { points_hit: ["K1"], points_missed: ["K2"], low_confidence: true, examiner_reply: "Right." },
    ];
    const call: ModelCall = vi.fn(async () => replies.shift());
    const s = startOralState("uk", ["o1", "o2"]);
    let step = await oralStep(call, "sys", s, items, "weak");
    expect(step.state.probed).toBe(true);
    expect(step.examiner_text).toContain("F1");
    step = await oralStep(call, "sys", step.state, items, "better");
    expect(step.grade!.score).toBe(1);
    expect(step.examiner_text).toContain("Q2?");
    step = await oralStep(call, "sys", step.state, items, "half");
    expect(step.done).toBe(true);
    expect(step.grade!.low_confidence).toBe(true);
    // critical question at 50% is not < 0.5, average 0.75 → pass
    expect(step.verdict).toMatchObject({ passed: true, average: 0.75 });
    expect(step.verdict!.debrief).toContain("K2");
  });
  it("critical question below 50% fails the oral", async () => {
    const call: ModelCall = vi.fn(async () => ({ points_hit: [], points_missed: ["K1", "K2"], low_confidence: false, examiner_reply: "Hm." }));
    const s = { ...startOralState("uk", ["o2"]) };
    const step = await oralStep(call, "sys", s, items, "no idea");
    expect(step.verdict!.passed).toBe(false);
  });
  it("ignores key points the model invents", async () => {
    const call: ModelCall = vi.fn(async () => ({ points_hit: ["K1", "K2", "Hallucinated"], points_missed: [], low_confidence: false, examiner_reply: "ok" }));
    const step = await oralStep(call, "sys", startOralState("uk", ["o2"]), items, "x");
    expect(step.grade!.points_hit).toEqual(["K1", "K2"]);
  });
  it("pickOralItems interleaves and is deterministic", () => {
    const pool = [...Array(6)].map((_, i) => ({ id: `n${i}`, competence: "NAV" })).concat([...Array(6)].map((_, i) => ({ id: `s${i}`, competence: "STAB" })));
    const a = pickOralItems(pool, 4, 42);
    expect(a).toEqual(pickOralItems(pool, 4, 42));
    expect(a.filter((x) => x.startsWith("n"))).toHaveLength(2);
  });
});

describe("paystack webhook", () => {
  it("verifies HMAC-SHA512 signatures", async () => {
    const body = JSON.stringify({ event: "charge.success" });
    const sig = createHmac("sha512", "sk_test_x").update(body).digest("hex");
    expect(await verifyPaystackSignature(body, sig, "sk_test_x")).toBe(true);
    expect(await verifyPaystackSignature(body, sig, "other")).toBe(false);
    expect(await verifyPaystackSignature(body, null, "sk_test_x")).toBe(false);
  });
  it("maps charge.success to an active 30-day subscription", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const row = subscriptionFromEvent({ event: "charge.success", data: { reference: "r1", status: "success", metadata: { user_id: "u", tier: "pro", country: "ng" } } }, now);
    expect(row).toMatchObject({ user_id: "u", tier: "pro", status: "active", provider_ref: "r1", current_period_end: "2026-01-31T00:00:00.000Z" });
    expect(subscriptionFromEvent({ event: "charge.failed", data: { reference: "r", status: "failed" } })).toBeNull();
    expect(subscriptionFromEvent({ event: "charge.success", data: { reference: "r", status: "success", metadata: { user_id: "u", tier: "gold", country: "ng" } } })).toBeNull();
  });
});
