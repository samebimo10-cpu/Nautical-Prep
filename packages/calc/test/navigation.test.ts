import { describe, expect, it } from "vitest";
import * as n from "../src/navigation";

describe("great circle", () => {
  it("along equator 0°→90°E = 5400 nm, course 090", () => {
    const r = n.greatCircle({ lat: 0, lon: 0 }, { lat: 0, lon: 90 });
    expect(r.distanceNm).toBeCloseTo(5400, 6);
    expect(r.initialCourse).toBeCloseTo(90, 6);
  });
  it("along meridian 0→60°N = 3600 nm, course 000", () => {
    const r = n.greatCircle({ lat: 0, lon: 0 }, { lat: 60, lon: 0 });
    expect(r.distanceNm).toBeCloseTo(3600, 6);
    expect(r.initialCourse).toBeCloseTo(0, 6);
  });
  it("40°N 010°W → 40°N 070°W: cos D = sin²40 + cos²40·cos60 = 0.70659 → 2702.5 nm; tan C = sin60/(cos40·tan40 − sin40·cos60) → N69.6°W = 290.4°", () => {
    const r = n.greatCircle({ lat: 40, lon: -10 }, { lat: 40, lon: -70 });
    // haversine cross-check
    const R = (x: number) => (x * Math.PI) / 180;
    const h = Math.sin(R(0)) ** 2 + Math.cos(R(40)) ** 2 * Math.sin(R(30)) ** 2;
    const d = 2 * Math.asin(Math.sqrt(h)) * (180 / Math.PI) * 60;
    expect(r.distanceNm).toBeCloseTo(d, 6);
    expect(r.distanceNm).toBeCloseTo(2702.5, 1);
    expect(r.initialCourse).toBeCloseTo(290.4, 1);
    // symmetric track: final course is 249.6 (mirror image)
    expect(r.finalCourse).toBeCloseTo(249.6, 1);
  });
  it("handles date-line crossing (170°E → 170°W = dlong 20°E)", () => {
    const r = n.greatCircle({ lat: 0, lon: 170 }, { lat: 0, lon: -170 });
    expect(r.distanceNm).toBeCloseTo(1200, 6);
    expect(r.initialCourse).toBeCloseTo(90, 6);
  });
});

describe("meridional parts & mercator", () => {
  it("MP matches nautical tables: 0°=0, 30°=1876.9, 60°=4507.4", () => {
    expect(n.meridionalParts(0)).toBeCloseTo(0, 6);
    expect(n.meridionalParts(30)).toBeCloseTo(1876.9, 1);
    expect(n.meridionalParts(60)).toBeCloseTo(4507.4, 1);
    expect(n.meridionalParts(-30)).toBeCloseTo(-1876.9, 1);
  });
  it("due east along equator: 090, 600 nm", () => {
    const r = n.mercatorSailing({ lat: 0, lon: 0 }, { lat: 0, lon: 10 });
    expect(r.course).toBeCloseTo(90, 6);
    expect(r.distanceNm).toBeCloseTo(600, 6);
  });
  it("0°,0° → 30°N 30°E: tan C = 1800/1876.87 → 043.8°, dist = 1800/cos C ≈ 2494", () => {
    const r = n.mercatorSailing({ lat: 0, lon: 0 }, { lat: 30, lon: 30 });
    expect(r.course).toBeCloseTo(43.8, 1);
    expect(r.distanceNm).toBeCloseTo(2494.4, 0);
  });
  it("southwesterly course resolves into 3rd quadrant", () => {
    const r = n.mercatorSailing({ lat: 10, lon: 10 }, { lat: 0, lon: 0 });
    expect(r.course).toBeGreaterThan(180);
    expect(r.course).toBeLessThan(270);
  });
});

describe("amplitude, azimuth and compass error", () => {
  it("Dec 20°N Lat 40°N: sin A = 0.34202/0.76604 → 26.52°", () => expect(n.trueAmplitude(20, 40)).toBeCloseTo(26.52, 2));
  it("Dec 0 → amplitude 0 at any latitude", () => expect(n.trueAmplitude(0, 55)).toBeCloseTo(0, 9));
  it("body that never sets throws", () => expect(() => n.trueAmplitude(23, 80)).toThrow());
  it("amplitude to bearing quadrants", () => {
    expect(n.amplitudeToBearing(26.52, true, true)).toBeCloseTo(63.48, 2);
    expect(n.amplitudeToBearing(10, false, true)).toBeCloseTo(100, 6);
    expect(n.amplitudeToBearing(10, true, false)).toBeCloseTo(280, 6);
    expect(n.amplitudeToBearing(10, false, false)).toBeCloseTo(260, 6);
  });
  it("azimuth: on meridian (LHA 0) north lat, dec less → due south 180°", () => expect(n.trueAzimuth(0, 10, 40)).toBeCloseTo(180, 6));
  it("azimuth: LHA 90 lat 0 dec 0 → 270°; LHA 270 → 090°", () => {
    expect(n.trueAzimuth(90, 0, 0)).toBeCloseTo(270, 6);
    expect(n.trueAzimuth(270, 0, 0)).toBeCloseTo(90, 6);
  });
  it("compass error/deviation: T090 C092 var 5E → error 2W, dev 7W", () => {
    const r = n.compassError(90, 92, 5);
    expect(r.error).toBeCloseTo(-2, 9);
    expect(r.deviation).toBeCloseTo(-7, 9);
  });
  it("compass error wraps through north: T002 C358 → 4E", () => expect(n.compassError(2, 358).error).toBeCloseTo(4, 9));
  it("compass error wraps other way: T358 C002 → 4W", () => expect(n.compassError(358, 2).error).toBeCloseTo(-4, 9));
});

describe("tides and UKC", () => {
  it("cosine method LW 1.0@0 HW 5.0@6: 2h→2.0, 3h→3.0, 6h→5.0", () => {
    expect(n.tideHeightCosine(1, 5, 0, 6, 2)).toBeCloseTo(2.0, 9);
    expect(n.tideHeightCosine(1, 5, 0, 6, 3)).toBeCloseTo(3.0, 9);
    expect(n.tideHeightCosine(1, 5, 0, 6, 6)).toBeCloseTo(5.0, 9);
  });
  it("falling tide works (HW before LW)", () => expect(n.tideHeightCosine(1, 5, 6, 0, 3)).toBeCloseTo(3.0, 9));
  it("rejects time outside LW–HW", () => expect(() => n.tideHeightCosine(1, 5, 0, 6, 7)).toThrow());
  it("secondary port: diffs +0.5h, −0.4/−0.2 m → LW 0.8@0.5 HW 4.6@6.5, mid 2.7", () => {
    const r = n.secondaryPortTide(
      { lwTime: 0, lwHeight: 1, hwTime: 6, hwHeight: 5 },
      { hwTimeDiffH: 0.5, lwTimeDiffH: 0.5, hwHeightDiff: -0.4, lwHeightDiff: -0.2 },
      3.5,
    );
    expect(r.lwHeight).toBeCloseTo(0.8, 9);
    expect(r.hwHeight).toBeCloseTo(4.6, 9);
    expect(r.height).toBeCloseTo(2.7, 9);
  });
  it("UKC = 10 + 2 − 11 − 0.5 = 0.5", () => expect(n.underKeelClearance(10, 2, 11, 0.5)).toBeCloseTo(0.5, 9));
});
