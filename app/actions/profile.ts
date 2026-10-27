"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberForAction, getOwnerForAction, getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { validateDisplayName, validatePassword } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

/** Owner finishes the one-time welcome screen. Stored in the database, not the browser. */
export async function completeOnboarding() {
  const session = await getOwnerForAction();
  if (!session) redirect("/");
  const supabase = await createClient();
  await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", session.userId).is("onboarded_at", null);
  redirect("/");
}

export async function updateDisplayName(name: string): Promise<ActionResult> {
  const t = getDictionary(await getLocale());
  const session = await getMemberForAction();
  if (!session) return { ok: false, error: t.errors.forbidden };
  const v = validateDisplayName(name);
  if (!v.ok) return { ok: false, error: t.settings.displayNameInvalid };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: v.value }).eq("id", session.userId);
  if (error) return { ok: false, error: t.settings.saveFailed };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function changePassword(password: string, confirm: string): Promise<ActionResult> {
  const t = getDictionary(await getLocale());
  const session = await getMemberForAction();
  if (!session) return { ok: false, error: t.errors.forbidden };
  const check = validatePassword(password, confirm);
  if (check !== "ok") return { ok: false, error: t.settings.passwordErrors[check] };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const code = (error as { code?: string }).code ?? "";
    if (code === "reauthentication_needed" || /reauthenticat/i.test(error.message)) {
      return { ok: false, error: t.settings.passwordErrors.reauth };
    }
    if (code === "same_password") return { ok: false, error: t.settings.passwordErrors.same };
    if (code === "weak_password") return { ok: false, error: t.settings.passwordErrors.weak };
    return { ok: false, error: t.settings.passwordErrors.failed };
  }
  return { ok: true, data: null };
}

export type SetPasswordState = { error?: string };

/**
 * First password after accepting an invitation (or after a reset link).
 * Works for any signed-in account; where they go next depends on their role.
 */
export async function setInitialPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const t = getDictionary(await getLocale());
  const session = await getSession();
  if (!session) return { error: t.auth.linkInvalid };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const check = validatePassword(password, confirm);
  if (check !== "ok") return { error: t.settings.passwordErrors[check] };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const code = (error as { code?: string }).code ?? "";
    if (code === "same_password") return { error: t.settings.passwordErrors.same };
    if (code === "weak_password") return { error: t.settings.passwordErrors.weak };
    return { error: t.settings.passwordErrors.failed };
  }

  if (!session.profile) redirect("/login?error=no_access"); // no role assigned yet
  if (session.profile.role === "owner" && !session.profile.onboarded_at) redirect("/welcome");
  redirect("/");
}
