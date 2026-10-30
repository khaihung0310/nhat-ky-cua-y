"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnerForAction } from "@/lib/auth";
import { isUuid } from "@/lib/files";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { validateLinkInput } from "@/lib/links";
import type { ActionResult, SavedLink } from "@/lib/types";

const COLUMNS = "id, owner_id, url, title, note, created_at, updated_at";

/** Create (no id) or update (with id) a saved link. Owner only; RLS enforces it again. */
export async function saveLink(input: { id?: string | null; url: string; title: string; note: string }): Promise<ActionResult<SavedLink>> {
  const t = getDictionary(await getLocale());
  const session = await getOwnerForAction();
  if (!session) return { ok: false, error: t.errors.forbidden };

  const v = validateLinkInput(input);
  if (!v.ok) {
    const fieldErrors: Record<string, string> = {};
    for (const [field, code] of Object.entries(v.errors)) fieldErrors[field] = t.links.errors[code as keyof typeof t.links.errors];
    return { ok: false, error: Object.values(fieldErrors)[0] ?? t.errors.generic, fieldErrors };
  }

  const supabase = await createClient();
  if (input.id) {
    if (!isUuid(input.id)) return { ok: false, error: t.errors.generic };
    const { data, error } = await supabase
      .from("saved_links")
      .update(v.value)
      .eq("id", input.id)
      .eq("owner_id", session.userId)
      .select(COLUMNS)
      .maybeSingle();
    if (error || !data) return { ok: false, error: t.settings.saveFailed };
    revalidatePath("/links");
    return { ok: true, data: data as SavedLink };
  }

  const { data, error } = await supabase
    .from("saved_links")
    .insert({ ...v.value, owner_id: session.userId })
    .select(COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: t.settings.saveFailed };
  revalidatePath("/links");
  return { ok: true, data: data as SavedLink };
}

export async function deleteLink(id: string): Promise<ActionResult> {
  const t = getDictionary(await getLocale());
  const session = await getOwnerForAction();
  if (!session) return { ok: false, error: t.errors.forbidden };
  if (!isUuid(id)) return { ok: false, error: t.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase.from("saved_links").delete().eq("id", id).eq("owner_id", session.userId);
  if (error) return { ok: false, error: t.errors.generic };
  revalidatePath("/links");
  return { ok: true, data: null };
}
