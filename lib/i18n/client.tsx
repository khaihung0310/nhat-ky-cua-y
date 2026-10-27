"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";

const I18nContext = createContext<{ locale: Locale; t: Dictionary } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: getDictionary(locale) }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
