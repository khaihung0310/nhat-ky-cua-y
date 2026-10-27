import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, getDictionary, isLocale, type Locale } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}

export const THEME_COOKIE = "nhatky_theme";

export async function getThemePreference(): Promise<"light" | "dark" | "system"> {
  const store = await cookies();
  const v = store.get(THEME_COOKIE)?.value;
  return v === "light" || v === "dark" ? v : "system";
}
