"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnerForAction } from "@/lib/auth";
import { STORAGE_BUCKET, uploadLimits } from "@/lib/env";
import { formatBytes, isStoragePathFor, isUuid, sanitizeFileName, validateFile } from "@/lib/files";
import { format, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { vnDateString } from "@/lib/time";
import { validateEntryInput } from "@/lib/validation";
import type { ActionResult, DiaryAttachment } from "@/lib/types";

// Every action re-checks the role from the database. RLS enforces the same
// rules again inside Postgres, so a forged request cannot bypass them.

async function i18n() {
  return getDictionary(await getLocale());
}

export async function saveEntry(input: {
  id?: string | null;
  title: string;
  content: string;
  mood: string | null;
  diaryDate: string;
}): Promise<ActionResult<{ id: string }>> {
  const t = await i18n();
  const session = await getOwnerForAction();
  if (!session) return { ok: false, error: t.errors.forbidden };

  const v = validateEntryInput(input, vnDateString());
  if (!v.ok) {
    const fieldErrors: Record<string, string> = {};
    for (const [field, code] of Object.entries(v.errors)) fieldErrors[field] = t.editor.errors[code as keyof typeof t.editor.errors];
    return { ok: false, error: Object.values(fieldErrors)[0] ?? t.errors.generic, fieldErrors };
  }

  const supabase = await createClient();
  const row = { title: v.value.title, content: v.value.content, mood: v.value.mood, diary_date: v.value.diaryDate };
  let id: string;

  if (input.id) {
    if (!isUuid(input.id)) return { ok: false, error: t.entry.notFound };
    const { data, error } = await supabase
      .from("diary_entries")
      .update(row)
      .eq("id", input.id)
      .eq("owner_id", session.userId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: t.editor.saveFailed };
    if (!data) return { ok: false, error: t.entry.notFound };
    id = data.id;
  } else {
    const { data, error } = await supabase
      .from("diary_entries")
      .insert({ ...row, owner_id: session.userId })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: t.editor.saveFailed };
    id = data.id;
  }

  // The published entry is now the source of truth: drop the matching draft.
  await supabase
    .from("diary_drafts")
    .delete()
    .eq("owner_id", session.userId)
    .eq("draft_key", input.id ? input.id : "new");

  revalidatePath("/", "layout");
  return { ok: true, data: { id } };
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  const t = await i18n();
  const session = await getOwnerForAction();
  if (!session) return { ok: false, error: t.errors.forbidden };
  if (!isUuid(id)) return { ok: false, error: t.entry.notFound };

  const supabase = await createClient();
  const { data: entry } = await supabase.from("diary_entries").select("id").eq("id", id).eq("owner_id", session.userId).maybeSingle();
  if (!entry) return { ok: false, error: t.entry.notFound };

  // Remove the files first (registered attachments + any orphaned uploads in
  // the entry folder), so no private file outlives its entry.
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const folder = `${session.userId}/${id}`;
  const paths = new Set<string>();
  const { data: rows } = await supabase.from("diary_attachments").select("storage_path").eq("diary_id", id);
  for (const r of rows ?? []) paths.add(r.storage_path);
  const { data: listed } = await bucket.list(folder, { limit: 1000 });
  for (const o of listed ?? []) if (o.name) paths.add(`${folder}/${o.name}`);

  if (paths.size > 0) {
    const { error: removeError } = await bucket.remove([...paths]);
    if (removeError) return { ok: false, error: t.errors.generic };
  }

  const { error } = await supabase.from("diary_entries").delete().eq("id", id).eq("owner_id", session.userId);
  if (error) return { ok: false, error: t.errors.generic };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/**
 * Called after the browser has uploaded a file straight to private storage.
 * Verifies the stored object (real size + MIME from storage metadata, path,
 * ownership) before recording it. Invalid uploads are deleted.
 */
export async function registerAttachment(input: {
  entryId: string;
  storagePath: string;
  fileName: string;
  durationMs?: number | null;
}): Promise<ActionResult<DiaryAttachment>> {
  const t = await i18n();
  const session = await getOwnerForAction();
  if (!session) return { ok: false, error: t.errors.forbidden };
  if (!isUuid(input.entryId) || !isStoragePathFor(input.storagePath, session.userId, input.entryId)) {
    return { ok: false, error: t.attachments.errors.storage };
  }

  const supabase = await createClient();
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const folder = `${session.userId}/${input.entryId}`;
  const objectName = input.storagePath.slice(folder.length + 1);

  const { data: entry } = await supabase
    .from("diary_entries")
    .select("id")
    .eq("id", input.entryId)
    .eq("owner_id", session.userId)
    .maybeSingle();
  if (!entry) return { ok: false, error: t.entry.notFound };

  const { data: objects, error: listError } = await bucket.list(folder, { search: objectName, limit: 10 });
  if (listError) return { ok: false, error: t.attachments.errors.register };
  const object = objects?.find((o) => o.name === objectName);
  if (!object) return { ok: false, error: t.attachments.errors.register };

  const meta = (object.metadata ?? {}) as { size?: number; mimetype?: string };
  const fileName = sanitizeFileName(input.fileName);
  const size = Number(meta.size ?? 0);
  const check = validateFile({ name: fileName, size, type: meta.mimetype ?? "" }, uploadLimits);
  if (!check.ok) {
    await bucket.remove([input.storagePath]);
    const key = check.code === "size" ? "size" : check.code === "empty" ? "empty" : "type";
    const locale = await getLocale();
    return {
      ok: false,
      error: format(t.attachments.errors[key], { name: fileName, max: check.maxBytes ? formatBytes(check.maxBytes, locale) : "" }),
    };
  }

  const duration =
    check.type === "audio" && typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
      ? Math.max(0, Math.min(86_400_000, Math.round(input.durationMs)))
      : null;

  const { data, error } = await supabase
    .from("diary_attachments")
    .insert({
      diary_id: input.entryId,
      uploaded_by: session.userId,
      file_name: fileName,
      storage_path: input.storagePath,
      mime_type: check.mime,
      file_size: size,
      attachment_type: check.type,
      duration_ms: duration,
    })
    .select("id, diary_id, uploaded_by, file_name, storage_path, mime_type, file_size, attachment_type, duration_ms, created_at")
    .single();

  if (error || !data) {
    await bucket.remove([input.storagePath]);
    return { ok: false, error: t.attachments.errors.register };
  }

  revalidatePath(`/entries/${input.entryId}`);
  return { ok: true, data: data as DiaryAttachment };
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  const t = await i18n();
  const session = await getOwnerForAction();
  if (!session) return { ok: false, error: t.errors.forbidden };
  if (!isUuid(id)) return { ok: false, error: t.errors.generic };

  const supabase = await createClient();
  const { data: row } = await supabase.from("diary_attachments").select("id, diary_id, storage_path").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: t.errors.generic };

  const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET).remove([row.storage_path]);
  if (removeError) return { ok: false, error: t.errors.generic };
  const { error } = await supabase.from("diary_attachments").delete().eq("id", id);
  if (error) return { ok: false, error: t.errors.generic };

  revalidatePath(`/entries/${row.diary_id}`);
  return { ok: true, data: null };
}
