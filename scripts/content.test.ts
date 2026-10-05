import { describe, expect, it } from "vitest";
import { generateCalc } from "@cm/calc";
import { gradeOral } from "@cm/learning";
import type { CalcItem, OralItem } from "@cm/content-schema";
import { loadContent, bundleFor } from "./content-lib";

const content = loadContent();

describe("content repository", () => {
  it("validates with no errors", () => {
    expect(content.errors).toEqual([]);
  });

  it("has at least 10 items per competence in core and 10 LOCAL items per wave-1 country", () => {
    for (const c of ["NAV", "STAB", "CARGO", "COLREG", "LAW", "MGMT"]) {
      expect(content.items.filter((i) => i.competence === c).length, c).toBeGreaterThanOrEqual(10);
    }
    for (const cc of ["ph", "ng", "uk"] as const) {
      expect(content.items.filter((i) => i.competence === "LOCAL" && i.countries.includes(cc)).length, cc).toBeGreaterThanOrEqual(10);
    }
  });

  it("ships 20 COLREG scenarios", () => expect(content.scenarios.length).toBeGreaterThanOrEqual(20));

  it("MCQ answers are spread across positions (no answer-position bias)", () => {
    const mcq = content.items.filter((i) => i.type === "mcq");
    const counts = [0, 1, 2, 3].map((k) => mcq.filter((i) => i.type === "mcq" && i.correct_index === k).length);
    // no single position should hold more than 55% of the answers
    for (const n of counts) expect(n / mcq.length).toBeLessThan(0.55);
  });

  it("dev bundles include all non-retired items; prod bundles include reviewed only", () => {
    const dev = bundleFor(content, "uk", "dev");
    const prod = bundleFor(content, "uk", "prod");
    expect(dev.items.length).toBeGreaterThan(100);
    expect(prod.items.every((i) => i.status === "reviewed")).toBe(true);
    expect(dev.items.some((i) => i.countries.includes("ng") && !i.countries.includes("*"))).toBe(false);
  });
});

describe("calculation templates generate valid questions", () => {
  const calcs = content.items.filter((i): i is CalcItem => i.type === "calc");
  for (const item of calcs) {
    it(item.id, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const g = generateCalc(item, seed * 7919);
        expect(Number.isFinite(g.answer), `${item.id} seed ${seed}`).toBe(true);
        expect(g.stem).not.toMatch(/\{\{/);
        for (const s of g.steps) expect(s, `${item.id} step`).not.toMatch(/\{\{/);
      }
    });
  }
});

describe("offline oral examiner is calibrated against the bank", () => {
  const orals = content.items.filter((i): i is OralItem => i.type === "oral");
  for (const item of orals) {
    it(`${item.id}: model answer passes, irrelevant answer fails`, () => {
      const good = gradeOral(item, item.model_answer);
      expect(good.score, `missed: ${good.missed.join(" | ")}`).toBeGreaterThanOrEqual(0.8);
      const bad = gradeOral(item, "I am not sure. I would ask somebody and then do what they say.");
      expect(bad.score).toBeLessThan(0.35);
    });
  }
});
