import { roundToCents } from "./daily-closing";

export type DayTotal = { date: string; total: number };

export type TurnoverProjection = {
  // Sum of fully finished days (before today).
  soFar: number;
  // Expected total for today (at least what's already rung up) plus all
  // days after it. 0 once the month is over.
  expectedRemaining: number;
  projected: number;
  remainingDays: number;
  // Average turnover of an open day per weekday (0 = Sunday ... 6 = Saturday),
  // null when there is no estimate for it.
  weekdayAverages: (number | null)[];
};

function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00.000Z`).getUTCDay();
}

export function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

// Projects the month's turnover from the finished days. Daily totals depend
// heavily on the weekday, so every remaining day is estimated from the
// average of the same weekday earlier in the month. A weekday that was
// zero every time so far is treated as closed. A weekday with no finished
// day yet falls back to the average of all open days.
export function projectMonth(
  month: string,
  days: DayTotal[],
  today: string
): TurnoverProjection {
  const totals = new Map(days.map((d) => [d.date, d.total]));
  const all = daysInMonth(month);
  const finished = all.filter((d) => d < today);

  const byWeekday: number[][] = Array.from({ length: 7 }, () => []);
  const closed = new Set<number>();
  const seen = new Set<number>();
  for (const date of finished) {
    const wd = weekdayOf(date);
    const total = totals.get(date) ?? 0;
    seen.add(wd);
    if (total > 0) byWeekday[wd].push(total);
  }
  for (const wd of seen) if (byWeekday[wd].length === 0) closed.add(wd);

  const openTotals = byWeekday.flat();
  const overall = openTotals.length
    ? openTotals.reduce((s, v) => s + v, 0) / openTotals.length
    : null;

  const weekdayAverages = byWeekday.map((list, wd) => {
    if (closed.has(wd)) return 0;
    if (list.length) return list.reduce((s, v) => s + v, 0) / list.length;
    return overall;
  });

  const soFar = finished.reduce((s, d) => s + (totals.get(d) ?? 0), 0);

  let expectedRemaining = 0;
  let remainingDays = 0;
  for (const date of all.filter((d) => d >= today)) {
    remainingDays++;
    const avg = weekdayAverages[weekdayOf(date)] ?? 0;
    // Today is still running: never expect less than already rung up.
    expectedRemaining +=
      date === today ? Math.max(avg, totals.get(date) ?? 0) : avg;
  }

  return {
    soFar: roundToCents(soFar),
    expectedRemaining: roundToCents(expectedRemaining),
    projected: roundToCents(soFar + expectedRemaining),
    remainingDays,
    weekdayAverages: weekdayAverages.map((v) => (v === null ? null : roundToCents(v))),
  };
}
