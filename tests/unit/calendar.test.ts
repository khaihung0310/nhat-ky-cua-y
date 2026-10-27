import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMonthGrid, groupByDiaryDate, weekdayLabels } from "../../lib/calendar.ts";

test("month grid starts on Monday and covers the whole month", () => {
  const grid = buildMonthGrid("2026-10");
  // 1 Oct 2026 is a Thursday → Monday 28 Sep starts the first row
  assert.equal(grid[0]![0]!.date, "2026-09-28");
  assert.equal(grid[0]![3]!.date, "2026-10-01");
  assert.ok(grid.every((w) => w.length === 7));
  const days = grid.flat().filter((d) => d.inMonth);
  assert.equal(days.length, 31);
  assert.equal(days[0]!.date, "2026-10-01");
  assert.equal(days.at(-1)!.date, "2026-10-31");
  assert.equal(grid.at(-1)!.at(-1)!.date, "2026-11-01");
});

test("February in a leap year", () => {
  const days = buildMonthGrid("2028-02").flat().filter((d) => d.inMonth);
  assert.equal(days.length, 29);
});

test("month that starts on Monday has no leading days", () => {
  // 1 June 2026 is a Monday
  const grid = buildMonthGrid("2026-06");
  assert.equal(grid[0]![0]!.date, "2026-06-01");
  assert.equal(grid[0]![0]!.inMonth, true);
});

test("Sunday-start grids are supported", () => {
  const grid = buildMonthGrid("2026-10", 0);
  assert.equal(grid[0]![0]!.date, "2026-09-27");
  assert.deepEqual(weekdayLabels("en", 0).slice(0, 2), ["Sun", "Mon"]);
  assert.deepEqual(weekdayLabels("vi").slice(0, 2), ["T2", "T3"]);
});

test("[12] multiple entries on the same date are all kept, ordered by time written", () => {
  const entries = [
    { id: "b", diary_date: "2026-10-27", created_at: "2026-10-27T14:00:00Z" },
    { id: "c", diary_date: "2026-10-26", created_at: "2026-10-26T01:00:00Z" },
    { id: "a", diary_date: "2026-10-27", created_at: "2026-10-27T01:00:00Z" },
    { id: "d", diary_date: "2026-10-27", created_at: "2026-10-27T16:30:00Z" },
  ];
  const grouped = groupByDiaryDate(entries);
  assert.deepEqual(grouped.get("2026-10-27")!.map((e) => e.id), ["a", "b", "d"]);
  assert.deepEqual(grouped.get("2026-10-26")!.map((e) => e.id), ["c"]);
});

test("[11] grouping uses diary_date, never created_at in the browser timezone", () => {
  // Written 00:30 Vietnam time on 28 Oct (17:30Z on 27 Oct). diary_date is authoritative.
  const original = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    const grouped = groupByDiaryDate([{ id: "x", diary_date: "2026-10-28", created_at: "2026-10-27T17:30:00Z" }]);
    assert.ok(grouped.has("2026-10-28"));
    assert.ok(!grouped.has("2026-10-27"));
  } finally {
    process.env.TZ = original;
  }
});
