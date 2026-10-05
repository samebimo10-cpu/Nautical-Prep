import { describe, expect, it } from "vitest";
import { certificateStatus, eligibilityProgress, entryDays, seaTimeTotals } from "../src/tracker";
import { dailyPlan } from "../src/planner";

const e = (from: string, to: string, capacity = "Second Officer") => ({ vessel: "MV Test", vessel_type: "Bulk", from_date: from, to_date: to, capacity });

describe("sea time", () => {
  it("counts inclusive days", () => {
    expect(entryDays(e("2025-01-01", "2025-01-31"))).toBe(31);
    expect(entryDays(e("2024-02-01", "2024-02-29"))).toBe(29);
    expect(() => entryDays(e("2025-02-01", "2025-01-01"))).toThrow();
  });
  it("totals by capacity and never double counts overlaps", () => {
    const t = seaTimeTotals([e("2025-01-01", "2025-03-31"), e("2025-03-01", "2025-04-30"), e("2025-06-01", "2025-06-30", "Third Officer")]);
    expect(t.byCapacity["Second Officer"]!.days).toBe(120);
    expect(t.byCapacity["Third Officer"]!.days).toBe(30);
    expect(t.totalDays).toBe(150);
    expect(t.totalMonths).toBe(5);
  });
  it("adjacent periods merge", () => expect(seaTimeTotals([e("2025-01-01", "2025-01-10"), e("2025-01-11", "2025-01-20")]).totalDays).toBe(20));
  it("empty", () => expect(seaTimeTotals([]).totalDays).toBe(0));
  it("eligibility shows unconfirmed when requirement is null", () => {
    expect(eligibilityProgress(10, null)).toEqual({ confirmed: false, percent: null, remainingMonths: null });
    expect(eligibilityProgress(6, 12)).toEqual({ confirmed: true, percent: 50, remainingMonths: 6 });
    expect(eligibilityProgress(18, 12).percent).toBe(100);
  });
});

describe("certificates", () => {
  const now = new Date("2026-01-01T10:00:00Z");
  it("statuses", () => {
    expect(certificateStatus(null, now).status).toBe("no-expiry");
    expect(certificateStatus("2025-12-31", now)).toEqual({ status: "expired", daysLeft: -1 });
    expect(certificateStatus("2026-03-01", now)).toEqual({ status: "expiring", daysLeft: 59 });
    expect(certificateStatus("2027-01-01", now).status).toBe("valid");
  });
});

describe("planner", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("phases by days left", () => {
    expect(dailyPlan({ targetDate: null, unseenItems: 100, reviewsDue: 3, now }).phase).toBe("no-date");
    expect(dailyPlan({ targetDate: "2026-04-01", unseenItems: 900, reviewsDue: 0, now })).toMatchObject({ phase: "foundation", daysLeft: 90, newItemsPerDay: 11 });
    expect(dailyPlan({ targetDate: "2026-02-01", unseenItems: 240, reviewsDue: 0, now })).toMatchObject({ phase: "consolidation", newItemsPerDay: 10 });
    expect(dailyPlan({ targetDate: "2026-01-06", unseenItems: 10, reviewsDue: 0, now })).toMatchObject({ phase: "exam-simulation", mockEveryDays: 3 });
  });
});
