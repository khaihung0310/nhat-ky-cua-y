import type { vi } from "./vi.ts";

type Widen<T> = T extends string
  ? string
  : T extends readonly string[]
    ? readonly string[]
    : { [K in keyof T]: Widen<T[K]> };

/** The shape every language dictionary must have (Vietnamese is the source of truth). */
export type Dictionary = Widen<typeof vi>;

export type Locale = "vi" | "en";

export const LOCALES: readonly Locale[] = ["vi", "en"];
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE = "nhatky_lang";

export function isLocale(value: unknown): value is Locale {
  return value === "vi" || value === "en";
}
