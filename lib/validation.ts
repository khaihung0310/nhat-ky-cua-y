import { isMood, type Mood } from "./moods.ts";
import { isValidDateString } from "./time.ts";

export const TITLE_MAX = 200;
export const CONTENT_MAX = 100_000;

export type EntryInput = {
  title: string;
  content: string;
  mood: Mood | null;
  diaryDate: string;
};

export type EntryFieldError = "title_required" | "title_too_long" | "content_too_long" | "mood_invalid" | "date_invalid" | "date_future";

export type EntryValidation =
  | { ok: true; value: EntryInput }
  | { ok: false; errors: Partial<Record<keyof EntryInput, EntryFieldError>> };

/** Normalise line endings and strip NUL / other control chars except tab + newline. */
export function normalizeText(value: string): string {
  return (
    value
      .replace(/\r\n?/g, "\n")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .normalize("NFC")
  );
}

/**
 * Validate entry input on the server. `todayVn` is the current Vietnamese date;
 * entries may be back-dated but not dated in the future.
 */
export function validateEntryInput(raw: Record<string, unknown>, todayVn: string): EntryValidation {
  const errors: Partial<Record<keyof EntryInput, EntryFieldError>> = {};

  const title = normalizeText(typeof raw.title === "string" ? raw.title : "").trim();
  const content = normalizeText(typeof raw.content === "string" ? raw.content : "").replace(/\s+$/, "");
  const moodRaw = typeof raw.mood === "string" && raw.mood !== "" ? raw.mood : null;
  const diaryDate = typeof raw.diaryDate === "string" ? raw.diaryDate.trim() : "";

  if (!title) errors.title = "title_required";
  else if (title.length > TITLE_MAX) errors.title = "title_too_long";

  if (content.length > CONTENT_MAX) errors.content = "content_too_long";

  if (moodRaw !== null && !isMood(moodRaw)) errors.mood = "mood_invalid";

  if (!isValidDateString(diaryDate)) errors.diaryDate = "date_invalid";
  else if (diaryDate > todayVn) errors.diaryDate = "date_future";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, content, mood: (moodRaw as Mood | null) ?? null, diaryDate } };
}

export const DISPLAY_NAME_MAX = 60;

export function validateDisplayName(value: unknown): { ok: true; value: string } | { ok: false } {
  if (typeof value !== "string") return { ok: false };
  const v = normalizeText(value).trim();
  if (v.length < 1 || v.length > DISPLAY_NAME_MAX) return { ok: false };
  return { ok: true, value: v };
}

export const PASSWORD_MIN = 10;

export function validatePassword(pw: unknown, confirm: unknown): "ok" | "too_short" | "mismatch" | "too_long" {
  if (typeof pw !== "string" || pw.length < PASSWORD_MIN) return "too_short";
  if (pw.length > 72) return "too_long"; // bcrypt limit
  if (pw !== confirm) return "mismatch";
  return "ok";
}

/** Escape a user query for display / safe use; the SQL function escapes LIKE wildcards itself. */
export function normalizeSearchQuery(q: unknown): string {
  if (typeof q !== "string") return "";
  return normalizeText(q).trim().slice(0, 200);
}

/** Only allow same-site relative redirects (prevents open redirects after login). */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}
