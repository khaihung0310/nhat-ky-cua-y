import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMonths,
  dayOfYear,
  formatDiaryDate,
  formatVnTime,
  isValidDateString,
  monthRange,
  parseUserDate,
  vnDateString,
  vnHour,
  vnMonthString,
} from "../../lib/time.ts";

test("[11] an entry written at 00:30 in Vietnam belongs to the Vietnamese date, not the UTC date", () => {
  // 2026-10-27T17:30Z is 2026-10-28 00:30 in Asia/Ho_Chi_Minh
  assert.equal(vnDateString(new Date("2026-10-27T17:30:00Z")), "2026-10-28");
  assert.equal(vnDateString(new Date("2026-10-27T16:59:59Z")), "2026-10-27");
  assert.equal(vnDateString(new Date("2026-10-27T17:00:00Z")), "2026-10-28");
});

test("Vietnamese date is independent of the process timezone", () => {
  const original = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/Los_Angeles", "Australia/Sydney", "Asia/Ho_Chi_Minh"]) {
      process.env.TZ = tz;
      assert.equal(vnDateString(new Date("2026-12-31T18:00:00Z")), "2027-01-01", tz);
      assert.equal(vnMonthString(new Date("2026-12-31T18:00:00Z")), "2027-01", tz);
    }
  } finally {
    process.env.TZ = original;
  }
});

test("year boundary and leap day", () => {
  assert.equal(vnDateString("2028-02-28T17:00:00Z"), "2028-02-29");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2027-02-28", 1), "2027-03-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("formatVnTime shows Vietnamese wall-clock time", () => {
  assert.equal(formatVnTime("2026-10-27T17:30:00Z", "en"), "00:30");
  assert.equal(formatVnTime("2026-10-27T02:05:00Z", "vi"), "09:05");
  assert.equal(vnHour(new Date("2026-10-27T17:30:00Z")), 0);
});

test("formatDiaryDate never shifts the calendar date", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    assert.match(formatDiaryDate("2026-10-27", "en", "medium"), /27 October 2026/);
    assert.match(formatDiaryDate("2026-10-27", "vi", "medium"), /27/);
    assert.match(formatDiaryDate("2026-10-27", "vi", "medium"), /2026/);
  } finally {
    process.env.TZ = original;
  }
});

test("date validation", () => {
  assert.ok(isValidDateString("2026-02-28"));
  assert.ok(!isValidDateString("2026-02-29"));
  assert.ok(isValidDateString("2028-02-29"));
  assert.ok(!isValidDateString("2026-13-01"));
  assert.ok(!isValidDateString("26-10-2026"));
  assert.ok(!isValidDateString("2026-10-27T00:00"));
  assert.ok(!isValidDateString(20261027));
});

test("month arithmetic", () => {
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-10", -22), "2024-12");
  assert.deepEqual(monthRange("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(monthRange("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
});

test("parseUserDate accepts Vietnamese day/month/year", () => {
  assert.equal(parseUserDate("27/10/2026"), "2026-10-27");
  assert.equal(parseUserDate("7-3-2026"), "2026-03-07");
  assert.equal(parseUserDate("2026-10-27"), "2026-10-27");
  assert.equal(parseUserDate("31/02/2026"), null);
  assert.equal(parseUserDate("hồ gươm"), null);
});

test("dayOfYear", () => {
  assert.equal(dayOfYear("2026-01-01"), 1);
  assert.equal(dayOfYear("2026-12-31"), 365);
  assert.equal(dayOfYear("2028-12-31"), 366);
});

test("compact Vietnamese date-time", async () => {
  const { formatVnDateTime } = await import("../../lib/time.ts");
  assert.equal(formatVnDateTime("2026-10-27T05:27:00Z", "vi"), "27/10/2026, 12:27");
  assert.equal(formatVnDateTime("2026-10-27T17:30:00Z", "en"), "28/10/2026, 00:30");
});
