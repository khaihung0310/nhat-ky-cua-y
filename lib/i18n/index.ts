import { en } from "./en.ts";
import { vi } from "./vi.ts";
import { DEFAULT_LOCALE, isLocale, type Dictionary, type Locale } from "./types.ts";

export * from "./types.ts";

const DICTIONARIES: Record<Locale, Dictionary> = { vi, en };

export function getDictionary(locale: unknown): Dictionary {
  return DICTIONARIES[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

/** Replace {placeholders} in a translated string. Values are inserted as plain text. */
export function format(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
