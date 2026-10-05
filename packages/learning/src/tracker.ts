import { DAY_MS } from "./srs";

export interface SeaServiceEntry {
  vessel: string;
  vessel_type: string;
  grt?: number;
  from_date: string; // YYYY-MM-DD
  to_date: string; // YYYY-MM-DD inclusive
  capacity: string; // e.g. "Second Officer"
}

/** Days per month used to convert sea service (draft — authorities differ, see DECISIONS.md). */
export const DAYS_PER_MONTH = 30;

const day = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

/** Inclusive day count of one entry. */
export function entryDays(e: Pick<SeaServiceEntry, "from_date" | "to_date">): number {
  const d = Math.round((day(e.to_date) - day(e.from_date)) / DAY_MS) + 1;
  if (d <= 0) throw new RangeError("to_date must be on/after from_date");
  return d;
}

/** Merge overlapping intervals so the same day is never counted twice. */
function mergedDays(entries: Pick<SeaServiceEntry, "from_date" | "to_date">[]): number {
  const iv = entries.map((e) => [day(e.from_date), day(e.to_date)] as const).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [s, e] of iv) {
    if (!cur) cur = [s, e];
    else if (s <= cur[1] + DAY_MS) cur[1] = Math.max(cur[1], e);
    else {
      total += (cur[1] - cur[0]) / DAY_MS + 1;
      cur = [s, e];
    }
  }
  if (cur) total += (cur[1] - cur[0]) / DAY_MS + 1;
  return Math.round(total);
}

export function seaTimeTotals(entries: SeaServiceEntry[]): { totalDays: number; totalMonths: number; byCapacity: Record<string, { days: number; months: number }> } {
  for (const e of entries) entryDays(e); // validates
  const byCapacity: Record<string, { days: number; months: number }> = {};
  const caps = [...new Set(entries.map((e) => e.capacity))];
  for (const c of caps) {
    const d = mergedDays(entries.filter((e) => e.capacity === c));
    byCapacity[c] = { days: d, months: d / DAYS_PER_MONTH };
  }
  const totalDays = mergedDays(entries);
  return { totalDays, totalMonths: totalDays / DAYS_PER_MONTH, byCapacity };
}

export function eligibilityProgress(qualifyingMonths: number, requiredMonths: number | null): { confirmed: boolean; percent: number | null; remainingMonths: number | null } {
  if (requiredMonths == null) return { confirmed: false, percent: null, remainingMonths: null };
  return { confirmed: true, percent: Math.min(100, (qualifyingMonths / requiredMonths) * 100), remainingMonths: Math.max(0, requiredMonths - qualifyingMonths) };
}

export type CertStatus = "valid" | "expiring" | "expired" | "no-expiry";

export function certificateStatus(expiresAt: string | null, now: Date, warnDays = 90): { status: CertStatus; daysLeft: number | null } {
  if (!expiresAt) return { status: "no-expiry", daysLeft: null };
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysLeft = Math.round((day(expiresAt) - today) / DAY_MS);
  if (daysLeft < 0) return { status: "expired", daysLeft };
  if (daysLeft <= warnDays) return { status: "expiring", daysLeft };
  return { status: "valid", daysLeft };
}
