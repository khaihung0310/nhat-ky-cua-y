import { addDays, dateStringToUtcDate, monthRange } from "./time.ts";

export type CalendarDay = {
  date: string; // YYYY-MM-DD (Vietnamese calendar date)
  inMonth: boolean;
  day: number;
};

/**
 * Build a month grid of full weeks. Weeks start on Monday (Vietnamese convention)
 * unless weekStartsOn = 0 (Sunday). Pure date arithmetic — timezone independent.
 */
export function buildMonthGrid(month: string, weekStartsOn: 0 | 1 = 1): CalendarDay[][] {
  const { from, to } = monthRange(month);
  const firstDow = dateStringToUtcDate(from).getUTCDay(); // 0 = Sunday
  const lead = (firstDow - weekStartsOn + 7) % 7;
  let cursor = addDays(from, -lead);

  const weeks: CalendarDay[][] = [];
  // Always render whole weeks until the month is covered.
  while (weeks.length === 0 || cursor <= to) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, inMonth: cursor.slice(0, 7) === month, day: Number(cursor.slice(8, 10)) });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * Group entries by their Vietnamese diary_date. Within a day, entries are
 * ordered by created_at ascending (the order they were written).
 * Never derives the date from created_at — diary_date is authoritative, so the
 * browser timezone can never move an entry to another day.
 */
export function groupByDiaryDate<T extends { diary_date: string; created_at?: string }>(
  entries: readonly T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const e of entries) {
    const list = map.get(e.diary_date);
    if (list) list.push(e);
    else map.set(e.diary_date, [e]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  }
  return map;
}

/** Weekday labels starting on Monday. */
export function weekdayLabels(locale: "vi" | "en", weekStartsOn: 0 | 1 = 1): string[] {
  const vi = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const base = locale === "vi" ? vi : en;
  return [...base.slice(weekStartsOn), ...base.slice(0, weekStartsOn)];
}
