/**
 * Vietnamese timezone helpers.
 *
 * Rules:
 *  - Timestamps are stored in UTC (Postgres timestamptz).
 *  - `diary_date` is a plain calendar date (YYYY-MM-DD) meaning the
 *    *Vietnamese* date (Asia/Ho_Chi_Minh, UTC+7, no DST).
 *  - Nothing here depends on the browser's or server's local timezone.
 */

export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

const vnDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Vietnamese calendar date (YYYY-MM-DD) for an instant. */
export function vnDateString(instant: Date | string | number = new Date()): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) throw new RangeError("Invalid date");
  const parts = vnDateFormatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The Vietnamese month (YYYY-MM) for an instant. */
export function vnMonthString(instant: Date | string | number = new Date()): string {
  return vnDateString(instant).slice(0, 7);
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

export function isValidMonthString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = MONTH_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return y >= 1900 && y <= 2200 && mo >= 1 && mo <= 12;
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function parseDateString(value: string): { year: number; month: number; day: number } {
  if (!isValidDateString(value)) throw new RangeError(`Invalid date string: ${value}`);
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return { year: y, month: m, day: d };
}

/** A UTC-midnight Date that represents a calendar date (safe for formatting with timeZone: "UTC"). */
export function dateStringToUtcDate(value: string): Date {
  const { year, month, day } = parseDateString(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateString(year: number, month1to12: number, day: number): string {
  return `${year}-${pad(month1to12)}-${pad(day)}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = dateStringToUtcDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addMonths(monthStr: string, delta: number): string {
  if (!isValidMonthString(monthStr)) throw new RangeError(`Invalid month: ${monthStr}`);
  const [y, m] = monthStr.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function monthRange(monthStr: string): { from: string; to: string } {
  if (!isValidMonthString(monthStr)) throw new RangeError(`Invalid month: ${monthStr}`);
  const [y, m] = monthStr.split("-").map(Number) as [number, number];
  return { from: toDateString(y, m, 1), to: toDateString(y, m, daysInMonth(y, m)) };
}

export type AppLocale = "vi" | "en";

function intlLocale(locale: AppLocale): string {
  return locale === "vi" ? "vi-VN" : "en-GB";
}

/** "Thứ Ba, 27 tháng 10, 2026" / "Tuesday 27 October 2026" for a diary_date. */
export function formatDiaryDate(dateStr: string, locale: AppLocale, style: "long" | "medium" | "short" = "long"): string {
  const d = dateStringToUtcDate(dateStr);
  const opts: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : style === "medium"
        ? { day: "numeric", month: "long", year: "numeric" }
        : { day: "2-digit", month: "2-digit", year: "numeric" };
  return new Intl.DateTimeFormat(intlLocale(locale), { ...opts, timeZone: "UTC" }).format(d);
}

/** Month heading, e.g. "tháng 10 năm 2026" / "October 2026". */
export function formatMonth(monthStr: string, locale: AppLocale): string {
  const d = dateStringToUtcDate(`${monthStr}-01`);
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Time of an instant in Vietnam, e.g. "21:05". */
export function formatVnTime(instant: string | Date, locale: AppLocale): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: VN_TIME_ZONE,
  }).format(d);
}

/** Full date + time of an instant in Vietnam. */
export function formatVnDateTime(instant: string | Date, locale: AppLocale): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: VN_TIME_ZONE,
  }).format(d);
}

/** Hour (0-23) in Vietnam — used for a time-of-day greeting. */
export function vnHour(instant: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: VN_TIME_ZONE }).format(instant);
  return Number(h) % 24;
}

/** Day of year (1-366) of a date string — used to rotate gentle daily messages. */
export function dayOfYear(dateStr: string): number {
  const { year } = parseDateString(dateStr);
  const start = Date.UTC(year, 0, 1);
  return Math.floor((dateStringToUtcDate(dateStr).getTime() - start) / 86_400_000) + 1;
}

/**
 * Parse a user-typed date such as "27/10/2026", "27-10-2026" or "2026-10-27".
 * Returns YYYY-MM-DD or null. Vietnamese order (day/month/year) is assumed for
 * slash/dash formats.
 */
export function parseUserDate(input: string): string | null {
  const s = input.trim();
  if (isValidDateString(s)) return s;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (!m) return null;
  const candidate = toDateString(Number(m[3]), Number(m[2]), Number(m[1]));
  return isValidDateString(candidate) ? candidate : null;
}
