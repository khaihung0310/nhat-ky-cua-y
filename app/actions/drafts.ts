"use server";

import { createClient } from "@/lib/supabase/server";
import { getOwnerForAction } from "@/lib/auth";
import { isUuid } from "@/lib/files";
import { isMood } from "@/lib/moods";
import { isValidDateString } from "@/lib/time";
import { normalizeText } from "@/lib/validation";
import type { DraftData } from "@/lib/drafts";

function validKey(key: string) {
  return key === "new" || isUuid(key);
}

/** Upsert the owner's draft. Drafts live in their own table and never touch published entries. */
export async function saveDraftAction(draftKey: string, draft: Omit<DraftData, "updatedAt">): Promise<{ ok: boolean; updatedAt?: string }> {
  const session = await getOwnerForAction();
  if (!session || !validKey(draftKey)) return { ok: false };
  const supabase = await createClient();
  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from("diary_drafts").upsert(
    {
      owner_id: session.userId,
      draft_key: draftKey,
      entry_id: draftKey === "new" ? null : draftKey,
      title: normalizeText(String(draft.title ?? "")).slice(0, 500),
      content: normalizeText(String(draft.content ?? "")).slice(0, 100_000),
      mood: isMood(draft.mood) ? draft.mood : null,
      diary_date: isValidDateString(draft.diaryDate) ? draft.diaryDate : null,
      updated_at: updatedAt,
    },
    { onConflict: "owner_id,draft_key" },
  );
  return error ? { ok: false } : { ok: true, updatedAt };
}

export async function getDraftAction(draftKey: string): Promise<DraftData | null> {
  const session = await getOwnerForAction();
  if (!session || !validKey(draftKey)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("diary_drafts")
    .select("title, content, mood, diary_date, updated_at")
    .eq("owner_id", session.userId)
    .eq("draft_key", draftKey)
    .maybeSingle();
  if (!data) return null;
  return { title: data.title, content: data.content, mood: data.mood, diaryDate: data.diary_date, updatedAt: data.updated_at };
}

export async function deleteDraftAction(draftKey: string): Promise<void> {
  const session = await getOwnerForAction();
  if (!session || !validKey(draftKey)) return;
  const supabase = await createClient();
  await supabase.from("diary_drafts").delete().eq("owner_id", session.userId).eq("draft_key", draftKey);
}
