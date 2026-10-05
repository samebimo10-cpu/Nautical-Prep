import { describe, expect, it } from "vitest";
import { optionOrder } from "./shuffle";

describe("optionOrder", () => {
  it("is a deterministic permutation", () => {
    expect(optionOrder("a")).toEqual(optionOrder("a"));
    expect([...optionOrder("x")].sort()).toEqual([0, 1, 2, 3]);
  });
  it("spreads the first option across positions", () => {
    const pos = [0, 0, 0, 0];
    for (let i = 0; i < 400; i++) pos[optionOrder(`k${i}`).indexOf(0)]!++;
    for (const p of pos) expect(p).toBeGreaterThan(60);
  });
});
