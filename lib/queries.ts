import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ENTRIES_PAGE_SIZE, SIGNED_URL_TTL_SECONDS, STORAGE_BUCKET } from "@/lib/env";
import { isMood } from "@/lib/moods";
import { isUuid } from "@/lib/files";
import { isValidDateString, monthRange, parseUserDate } from "@/lib/time";
import { normalizeSearchQuery } from "@/lib/validation";
import type { DiaryAttachment, DiaryEntry, EntryListItem, SignedAttachment } from "@/lib/types";

// All queries run with the signed-in user's session → RLS decides what is visible.

const LIST_COLUMNS = "id, title, content, mood, diary_date, created_at, diary_attachments(attachment_type)";

export async function getRecentEntries(limit = 6): Promise<EntryListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select(LIST_COLUMNS)
    .order("diary_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Failed to load entries");
  return (data ?? []) as unknown as EntryListItem[];
}

export type SearchFilters = {
  q: string;
  mood: string | null;
  from: string | null;
  to: string | null;
  withAttachments: boolean;
  page: number;
};

export function parseSearchParams(params: Record<string, string | string[] | undefined>): SearchFilters {
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const page = Math.max(1, Math.min(500, Number.parseInt(one("page"), 10) || 1));
  return {
    q: normalizeSearchQuery(one("q")),
    mood: isMood(one("mood")) ? one("mood") : null,
    from: isValidDateString(one("from")) ? one("from") : null,
    to: isValidDateString(one("to")) ? one("to") : null,
    withAttachments: one("att") === "1",
    page,
  };
}

/** Search + pagination. A query that looks like a date ("27/10/2026") searches that date. */
export async function searchEntries(f: SearchFilters): Promise<{ items: EntryListItem[]; hasMore: boolean }> {
  const supabase = await createClient();
  const asDate = f.q ? parseUserDate(f.q) : null;
  const pageSize = ENTRIES_PAGE_SIZE;
  const { data, error } = await supabase
    .rpc("search_diary_entries", {
      p_query: asDate ? null : f.q || null,
      p_mood: f.mood,
      p_from: asDate ?? f.from,
      p_to: asDate ?? f.to,
      p_has_attachments: f.withAttachments ? true : null,
      p_limit: pageSize + 1,
      p_offset: (f.page - 1) * pageSize,
    })
    .select(LIST_COLUMNS);
  if (error) throw new Error("Search failed");
  const rows = (data ?? []) as unknown as EntryListItem[];
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function getMonthEntries(month: string): Promise<EntryListItem[]> {
  const { from, to } = monthRange(month);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select(LIST_COLUMNS)
    .gte("diary_date", from)
    .lte("diary_date", to)
    .order("diary_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error("Failed to load month");
  return (data ?? []) as unknown as EntryListItem[];
}

export async function getEntry(id: string): Promise<DiaryEntry | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("diary_entries")
    .select("id, owner_id, title, content, mood, diary_date, created_at, updated_at")
    .eq("id", id)
    .maybeSingle<DiaryEntry>();
  return data ?? null;
}

export async function getAttachments(entryId: string): Promise<DiaryAttachment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diary_attachments")
    .select("id, diary_id, uploaded_by, file_name, storage_path, mime_type, file_size, attachment_type, duration_ms, created_at")
    .eq("diary_id", entryId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Failed to load attachments");
  return (data ?? []) as DiaryAttachment[];
}

/**
 * Create short-lived signed URLs with the user's own session (so storage RLS
 * applies). Documents get a "download" URL that forces Content-Disposition:
 * attachment, so they are never rendered inline by the browser.
 */
export async function signAttachments(attachments: DiaryAttachment[]): Promise<SignedAttachment[]> {
  if (attachments.length === 0) return [];
  const supabase = await createClient();
  const bucket = supabase.storage.from(STORAGE_BUCKET);

  const media = attachments.filter((a) => a.attachment_type !== "document");
  const urlByPath = new Map<string, string>();
  if (media.length > 0) {
    const { data } = await bucket.createSignedUrls(
      media.map((a) => a.storage_path),
      SIGNED_URL_TTL_SECONDS,
    );
    for (const row of data ?? []) if (row.path && row.signedUrl) urlByPath.set(row.path, row.signedUrl);
  }

  return Promise.all(
    attachments.map(async (a) => {
      const { data } = await bucket.createSignedUrl(a.storage_path, SIGNED_URL_TTL_SECONDS, { download: a.file_name });
      return {
        ...a,
        url: a.attachment_type === "document" ? null : (urlByPath.get(a.storage_path) ?? null),
        downloadUrl: data?.signedUrl ?? null,
      };
    }),
  );
}

export async function getMoodRange(from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select("id, title, mood, diary_date, created_at")
    .gte("diary_date", from)
    .lte("diary_date", to)
    .order("diary_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error("Failed to load moods");
  return (data ?? []) as Pick<DiaryEntry, "id" | "title" | "mood" | "diary_date" | "created_at">[];
}
