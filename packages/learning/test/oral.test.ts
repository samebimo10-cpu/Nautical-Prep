import { describe, expect, it } from "vitest";
import type { OralItem } from "@cm/content-schema";
import { answerOral, gradeOral, keyPointHit, oralVerdict, selectOralItems, startOral } from "../src/oral";
import { stem, tokens } from "../src/text";

const base = { topic: "t", countries: ["*"], difficulty: 2 as const, sources: [], status: "draft" as const, needs_review: true, last_reviewed: null, reviewer: null, examiner_style: "uk", type: "oral" as const };
const fs: OralItem = {
  ...base,
  id: "oral-fs",
  competence: "STAB",
  question: "What is free surface effect and how do you minimise it?",
  model_answer: "Virtual rise of G caused by liquid moving in slack tanks; reduce by pressing up or emptying tanks, longitudinal subdivision, and minimising the number of slack tanks.",
  key_points: [
    { point: "Virtual rise of G / loss of GM", match: ["virtual|apparent|loss of gm|reduce gm|reduction in gm|rise of g|rise in g"] },
    { point: "Caused by slack tanks", match: ["slack|partially filled|partly filled"] },
    { point: "Press up or empty tanks", match: ["press up|pressed up|full|empty"] },
    { point: "Longitudinal subdivision reduces FSM (breadth cubed)", match: ["subdivision|divided|bulkhead|centreline|centerline|wash plate|breadth cubed|b cubed"] },
  ],
  follow_ups: ["How does tank breadth affect it?"],
  critical: false,
};
const crit: OralItem = {
  ...base,
  id: "oral-enclosed",
  competence: "MGMT",
  question: "A crew member collapses in a ballast tank. What do you do?",
  model_answer: "Raise the alarm, do not enter without BA, muster rescue team with BA and rescue equipment, communicate, ventilate, test atmosphere, recover casualty, first aid.",
  key_points: ["Raise the alarm", "Do not enter without breathing apparatus", "Rescue team with BA and rescue equipment", "Ventilate and test the atmosphere"],
  follow_ups: ["Would you go in to help immediately?"],
  critical: true,
};
const items = new Map([fs, crit].map((i) => [i.id, i]));

describe("text normalisation", () => {
  it("stems inflections", () => {
    expect(stem("loading")).toBe("load");
    expect(stem("tanks")).toBe("tank");
    expect(stem("ballasted")).toBe("ballast");
    expect(stem("cities")).toBe("city");
    expect(stem("gas")).toBe("gas");
  });
  it("keeps decimals", () => expect(tokens("GM of 0.15 m.")).toEqual(["gm", "of", "0.15", "m"]));
});

describe("gradeOral", () => {
  it("full answer hits all key points", () => {
    const g = gradeOral(fs, "It's the virtual rise of G from slack tanks. Press up or empty tanks and use longitudinal subdivision since FSM depends on breadth cubed.");
    expect(g.score).toBe(1);
    expect(g.missed).toEqual([]);
  });
  it("partial answer reports missed points", () => {
    const g = gradeOral(fs, "Liquid in partially filled tanks reduces GM.");
    expect(g.hit).toHaveLength(2);
    expect(g.missed).toContain("Press up or empty tanks");
  });
  it("string key points need half their significant words", () => {
    expect(keyPointHit("First I would raise the alarm immediately", "Raise the alarm")).toBe(true);
    expect(keyPointHit("I would jump in", "Raise the alarm")).toBe(false);
    expect(keyPointHit("whatever", "the of")).toBe(false);
  });
  it("min_groups is honoured", () => {
    expect(keyPointHit("ballast tank", { point: "x", match: ["ballast", "tank", "pump"], min_groups: 2 })).toBe(true);
    expect(keyPointHit("ballast", { point: "x", match: ["ballast", "tank", "pump"] })).toBe(false);
  });
});

describe("examiner session", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("probes once on a weak answer, then moves on and finishes with verdict", () => {
    let s = startOral({ country: "uk", persona: "uk", itemIds: ["oral-fs", "oral-enclosed"], seed: 1, now, firstQuestion: fs.question });
    expect(s.turns[0]!.text).toMatch(/examiner/i);
    s = answerOral(s, "It's bad for stability.", items);
    expect(s.phase).toBe("probe");
    expect(s.turns.at(-1)!.text).toMatch(/breadth/);
    s = answerOral(s, "Slack tanks cause a virtual rise of G; keep tanks pressed up.", items);
    expect(s.phase).toBe("question");
    expect(s.results[0]!.followUpAsked).toBe(true);
    expect(s.results[0]!.score).toBe(0.75);
    s = answerOral(s, "Raise the alarm, never enter without breathing apparatus, rescue team with BA and rescue equipment, ventilate and test the atmosphere.", items);
    expect(s.phase).toBe("done");
    const v = oralVerdict(s.results);
    expect(v.passed).toBe(true);
    expect(v.average).toBeCloseTo(0.875);
    expect(answerOral(s, "more", items)).toBe(s);
  });
  it("a weak answer to a critical question fails the oral even with a high average", () => {
    const v = oralVerdict([
      { item_id: "a", score: 1, hit: [], missed: [], critical: false, followUpAsked: false, answer: "" },
      { item_id: "b", score: 1, hit: [], missed: [], critical: false, followUpAsked: false, answer: "" },
      { item_id: "c", score: 0.25, hit: [], missed: ["x"], critical: true, followUpAsked: true, answer: "" },
    ]);
    expect(v.average).toBeGreaterThan(0.7);
    expect(v.passed).toBe(false);
    expect(v.criticalFailures).toEqual(["c"]);
    expect(v.summary).toMatch(/safety-critical/);
  });
  it("coach mode shows feedback and model answer after each question", () => {
    let s = startOral({ country: "ng", persona: "ng", mode: "coach", itemIds: ["oral-fs"], seed: 2, now, firstQuestion: fs.question });
    s = answerOral(s, "virtual rise of G due to slack tanks, press up tanks, longitudinal subdivision", items);
    expect(s.turns.some((t) => t.role === "coach" && t.text.includes("Model answer"))).toBe(true);
  });
  it("empty results never pass; low average explains bar", () => {
    expect(oralVerdict([]).passed).toBe(false);
    expect(oralVerdict([{ item_id: "a", score: 0.5, hit: [], missed: [], critical: false, followUpAsked: false, answer: "" }]).summary).toMatch(/70%/);
  });
  it("unknown persona falls back to generic; missing item throws", () => {
    const s = startOral({ country: "xx", persona: "zz", itemIds: ["nope"], seed: 1, now, firstQuestion: "Q" });
    expect(s.persona).toBe("generic");
    expect(() => answerOral(s, "a", items)).toThrow();
  });
  it("selects interleaved items, preferred first", () => {
    const pool: OralItem[] = [
      ...Array.from({ length: 6 }, (_, i) => ({ ...fs, id: `s${i}` })),
      ...Array.from({ length: 6 }, (_, i) => ({ ...crit, id: `m${i}` })),
    ];
    const ids = selectOralItems(pool, 4, 3, ["m5"]);
    expect(ids).toHaveLength(4);
    expect(ids).toContain("m5");
    expect(ids.filter((x) => x.startsWith("s")).length).toBe(2);
  });
});
