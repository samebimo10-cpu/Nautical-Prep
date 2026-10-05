import { DAY_MS } from "./srs";

export interface DailyPlan {
  daysLeft: number | null;
  newItemsPerDay: number;
  reviewsDue: number;
  mockEveryDays: number;
  oralEveryDays: number;
  phase: "foundation" | "consolidation" | "exam-simulation" | "no-date";
  message: string;
}

/**
 * Study planner from target exam date. Phases:
 *  - foundation (> 42 days): learn new material, 1 mock / 14 days, 1 oral / 7 days
 *  - consolidation (15–42 days): finish coverage, 1 mock / 7 days, 2 orals / week
 *  - exam simulation (≤ 14 days): mocks every 3 days, oral every 2 days, reviews first
 */
export function dailyPlan(input: { targetDate: string | null; unseenItems: number; reviewsDue: number; now: Date }): DailyPlan {
  const { targetDate, unseenItems, reviewsDue, now } = input;
  if (!targetDate) {
    return { daysLeft: null, newItemsPerDay: 20, reviewsDue, mockEveryDays: 14, oralEveryDays: 7, phase: "no-date", message: "Set your exam date to get a personalised plan." };
  }
  const daysLeft = Math.max(0, Math.ceil((Date.parse(targetDate) - now.getTime()) / DAY_MS));
  // leave the final 7 days for revision only
  const learningDays = Math.max(1, daysLeft - 7);
  const newItemsPerDay = Math.max(daysLeft <= 7 ? 0 : 10, Math.ceil(unseenItems / learningDays));
  if (daysLeft <= 14)
    return { daysLeft, newItemsPerDay, reviewsDue, mockEveryDays: 3, oralEveryDays: 2, phase: "exam-simulation", message: `${daysLeft} days to go — exam simulation phase. Reviews first, then a mock or oral.` };
  if (daysLeft <= 42)
    return { daysLeft, newItemsPerDay, reviewsDue, mockEveryDays: 7, oralEveryDays: 3, phase: "consolidation", message: `${daysLeft} days to go — close the gaps and practise orals twice a week.` };
  return { daysLeft, newItemsPerDay, reviewsDue, mockEveryDays: 14, oralEveryDays: 7, phase: "foundation", message: `${daysLeft} days to go — build the foundation: ${newItemsPerDay} new items a day.` };
}
