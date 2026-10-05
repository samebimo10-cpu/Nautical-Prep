import { describe, expect, it } from "vitest";
import { lightColour, scoreScenario } from "./scoring";

describe("scenario scoring", () => {
  it("full marks for right action and exact rules", () => expect(scoreScenario(true, ["15", "16"], ["15", "16"])).toBe(1));
  it("partial rules", () => expect(scoreScenario(true, ["15"], ["15", "16"])).toBe(0.8));
  it("wrong action, right rules", () => expect(scoreScenario(false, ["15", "16"], ["15", "16"])).toBe(0.4));
  it("nothing right", () => expect(scoreScenario(false, ["9"], ["15"])).toBe(0));
  it("light colours", () => {
    expect(lightColour("Red sidelight")).toBe("#ef4444");
    expect(lightColour("green sidelight")).toBe("#22c55e");
    expect(lightColour("white masthead")).toBe("#f8fafc");
    expect(lightColour("yellow flashing")).toBe("#facc15");
    expect(lightColour("blue")).toBe("#3b82f6");
  });
});
