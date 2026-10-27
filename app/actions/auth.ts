"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env";
import { LOCALE_COOKIE, getDictionary, isLocale } from "@/lib/i18n";
import { getLocale, THEME_COOKIE } from "@/lib/i18n/server";
import { safeRedirectPath } from "@/lib/validation";

const ONE_YEAR = 60 * 60 * 24 * 365;

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const t = getDictionary(await getLocale());
  if (!getSupabaseConfig()) return { error: t.auth.configMissing };

  const email = String(formData.get("email") ?? "").trim().slice(0, 320);
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(formData.get("next"), "/");
  if (!email || !password) return { error: t.auth.missingFields, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const tooMany = error?.status === 429 || /rate limit|too many/i.test(error?.message ?? "");
    // Never reveal whether the e-mail exists.
    return { error: tooMany ? t.auth.tooManyAttempts : t.auth.invalidCredentials, email };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, language, theme, onboarded_at")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    // Authenticated but no role assigned by the admin → no access at all.
    await supabase.auth.signOut();
    return { error: t.auth.noAccess, email };
  }

  const store = await cookies();
  const cookieOpts = { path: "/", maxAge: ONE_YEAR, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", httpOnly: true };
  if (isLocale(profile.language)) store.set(LOCALE_COOKIE, profile.language, cookieOpts);
  if (["light", "dark", "system"].includes(profile.theme)) store.set(THEME_COOKIE, profile.theme, cookieOpts);

  if (profile.role === "owner" && !profile.onboarded_at) redirect("/welcome");
  redirect(next);
}

export async function logout() {
  if (getSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login?signed_out=1");
}

/** Switch language. Persisted in a cookie and, when signed in, in the profile. */
export async function setLanguage(locale: string) {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: true });
  if (!getSupabaseConfig()) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ language: locale }).eq("id", user.id);
}

export async function setTheme(theme: string) {
  if (theme !== "light" && theme !== "dark" && theme !== "system") return;
  const store = await cookies();
  store.set(THEME_COOKIE, theme, { path: "/", maxAge: ONE_YEAR, sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: true });
  if (!getSupabaseConfig()) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ theme }).eq("id", user.id);
}
