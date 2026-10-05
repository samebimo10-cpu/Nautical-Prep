import { describe, expect, it } from "vitest";
import { confidentErrors, scoreByCompetence, scoreByTopic, selfMarkScore, streakDays, studyNext, type Attempt } from "../src/analytics";

const now = new Date("2026-03-31T12:00:00Z");
const mk = (i: number, competence: Attempt["competence"], topic: string, score: number, daysAgo = 1, extra: Partial<Attempt> = {}): Attempt => ({
  item_id: `${competence}-${topic}-${i}`,
  item_type: "mcq",
  competence,
  topic,
  score,
  time_ms: 1000,
  created_at: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
  ...extra,
});

describe("analytics after 20 answers", () => {
  // 20 answers: STAB 8 (6 right), NAV 7 (7 right), LAW 5 (1 right) + 3 old (ignored)
  const attempts: Attempt[] = [
    ...Array.from({ length: 8 }, (_, i) => mk(i, "STAB", "free-surface", i < 6 ? 1 : 0)),
    ...Array.from({ length: 7 }, (_, i) => mk(i, "NAV", "tides", 1)),
    ...Array.from({ length: 5 }, (_, i) => mk(i, "LAW", "marpol", i < 1 ? 1 : 0)),
    ...Array.from({ length: 3 }, (_, i) => mk(i + 10, "LAW", "marpol", 1, 45)),
  ];
  it("competence scores use last 30 days only", () => {
    const s = scoreByCompetence(attempts, now);
    expect(s.STAB).toEqual({ attempts: 8, avg: 0.75 });
    expect(s.NAV).toEqual({ attempts: 7, avg: 1 });
    expect(s.LAW).toEqual({ attempts: 5, avg: 0.2 });
    expect(s.CARGO).toEqual({ attempts: 0, avg: 0 });
  });
  it("topic scores", () => {
    const t = scoreByTopic(attempts, now);
    expect(t["LAW/marpol"]!.avg).toBeCloseTo(0.2);
    expect(Object.keys(t)).toHaveLength(3);
  });
  it("study next: unstarted first, then weakest × weight", () => {
    const rec = studyNext(
      attempts,
      [
        { competence: "STAB", topic: "free-surface" },
        { competence: "NAV", topic: "tides" },
        { competence: "LAW", topic: "marpol" },
        { competence: "CARGO", topic: "grain" },
        { competence: "CARGO", topic: "grain" },
      ],
      now,
      4,
    );
    expect(rec.map((r) => r.competence)).toEqual(["CARGO", "LAW", "STAB", "NAV"]);
    expect(rec[0]!.reason).toBe("Not started yet");
    expect(rec[1]!.priority).toBeCloseTo(0.8 * 1.1);
  });
  it("few attempts count as unknown", () => {
    const rec = studyNext([mk(1, "NAV", "radar", 1)], [{ competence: "NAV", topic: "radar" }], now);
    expect(rec[0]!.avg).toBe(0);
    expect(rec[0]!.reason).toMatch(/Too few/);
  });
});

describe("streak, confident errors, self-marking", () => {
  it("counts consecutive days, surviving until midnight", () => {
    const a = [mk(1, "NAV", "t", 1, 0), mk(2, "NAV", "t", 1, 1), mk(3, "NAV", "t", 1, 2), mk(4, "NAV", "t", 1, 4)];
    expect(streakDays(a, now)).toBe(3);
    expect(streakDays(a.slice(1), now)).toBe(2);
    expect(streakDays([], now)).toBe(0);
  });
  it("confident errors use the latest attempt", () => {
    const a = [
      mk(1, "NAV", "t", 0, 3, { item_id: "q1", confidence: "sure" }),
      mk(1, "NAV", "t", 1, 1, { item_id: "q1", confidence: "sure" }),
      mk(2, "NAV", "t", 0, 1, { item_id: "q2", confidence: "sure" }),
      mk(3, "NAV", "t", 0, 1, { item_id: "q3", confidence: "guess" }),
    ];
    expect(confidentErrors(a)).toEqual(["q2"]);
  });
  it("self-mark weighted", () => {
    expect(selfMarkScore([{ weight: 2 }, { weight: 1 }, { weight: 1 }], [true, false, true])).toBeCloseTo(0.75);
    expect(selfMarkScore([], [])).toBe(0);
  });
});
