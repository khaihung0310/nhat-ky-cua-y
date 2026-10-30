import { NextResponse } from "next/server";
import { getOwnerForAction } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/env";
import type { DiaryAttachment, DiaryEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE = 1000;
const URL_TTL = 15 * 60; // 15 minutes — enough for the browser to download every file

/**
 * Owner-only export manifest: every entry + attachment metadata + short-lived
 * signed download URLs. The browser downloads the files directly from
 * Supabase Storage and builds the ZIP itself, so large diaries never hit the
 * Vercel Hobby function size/time limits.
 */
export async function GET() {
  const session = await getOwnerForAction();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = await createClient();

  const entries: DiaryEntry[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("diary_entries")
      .select("id, owner_id, title, content, mood, diary_date, created_at, updated_at")
      .order("diary_date", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: "export_failed" }, { status: 500 });
    entries.push(...((data ?? []) as DiaryEntry[]));
    if (!data || data.length < PAGE) break;
  }

  const attachments: DiaryAttachment[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("diary_attachments")
      .select("id, diary_id, uploaded_by, file_name, storage_path, mime_type, file_size, attachment_type, duration_ms, created_at")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: "export_failed" }, { status: 500 });
    attachments.push(...((data ?? []) as DiaryAttachment[]));
    if (!data || data.length < PAGE) break;
  }

  // Saved links are small; if they can't be read the diary export still proceeds.
  const { data: links } = await supabase
    .from("saved_links")
    .select("id, url, title, note, created_at, updated_at")
    .order("created_at", { ascending: true })
    .limit(5000);

  const urls = new Map<string, string>();
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  for (let i = 0; i < attachments.length; i += 100) {
    const chunk = attachments.slice(i, i + 100).map((a) => a.storage_path);
    const { data } = await bucket.createSignedUrls(chunk, URL_TTL);
    for (const row of data ?? []) if (row.path && row.signedUrl) urls.set(row.path, row.signedUrl);
  }

  return NextResponse.json(
    {
      format: "nhat-ky-cua-y/v1",
      exportedAt: new Date().toISOString(),
      timeZone: "Asia/Ho_Chi_Minh",
      owner: { displayName: session.profile.display_name },
      entries,
      attachments: attachments.map((a) => ({ ...a, url: urls.get(a.storage_path) ?? null })),
      links: links ?? [],
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
