/**
 * Saved links: URL normalisation and validation (shared by browser + server).
 * Only http(s) links are accepted, so a saved link can never run script.
 */
import { normalizeText } from "./validation.ts";

export const LINK_URL_MAX = 2048;
export const LINK_TITLE_MAX = 200;
export const LINK_NOTE_MAX = 2000;

export type LinkFieldError = "url_invalid" | "url_too_long" | "title_too_long" | "note_too_long";

/**
 * Turn what someone pasted into a clean absolute URL, or null.
 *  "youtube.com/watch?v=x"  → "https://youtube.com/watch?v=x"
 *  "javascript:alert(1)"    → null
 */
export function normalizeUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s || /\s/.test(s)) return null;
  // No scheme but looks like a domain → assume https.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    if (!/^[^/?#]+\.[^/?#]+/.test(s)) return null;
    s = `https://${s.replace(/^\/+/, "")}`;
  }
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname || !url.hostname.includes(".") && url.hostname !== "localhost") return null;
  if (url.username || url.password) return null; // never store credentials in a link
  return url.href;
}

/** "www.youtube.com" → "youtube.com" (for display). */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export type LinkInput = { url: string; title: string; note: string };

export function validateLinkInput(raw: { url?: unknown; title?: unknown; note?: unknown }):
  | { ok: true; value: LinkInput }
  | { ok: false; errors: Partial<Record<keyof LinkInput, LinkFieldError>> } {
  const errors: Partial<Record<keyof LinkInput, LinkFieldError>> = {};
  const rawUrl = typeof raw.url === "string" ? raw.url.trim() : "";
  const url = normalizeUrl(rawUrl);
  if (rawUrl.length > LINK_URL_MAX || (url && url.length > LINK_URL_MAX)) errors.url = "url_too_long";
  else if (!url) errors.url = "url_invalid";

  const title = normalizeText(typeof raw.title === "string" ? raw.title : "").replace(/\s+/g, " ").trim();
  if (title.length > LINK_TITLE_MAX) errors.title = "title_too_long";

  const note = normalizeText(typeof raw.note === "string" ? raw.note : "").trim();
  if (note.length > LINK_NOTE_MAX) errors.note = "note_too_long";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { url: url!, title, note } };
}

/** Accent-insensitive text for the client-side filter ("nhac" matches "nhạc"). */
export function foldForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function linkMatches(link: { url: string; title: string; note: string }, query: string): boolean {
  const q = foldForSearch(query.trim());
  if (!q) return true;
  return foldForSearch(`${link.title} ${link.note} ${link.url}`).includes(q);
}
