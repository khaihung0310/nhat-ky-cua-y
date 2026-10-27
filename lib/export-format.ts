/**
 * Pure helpers that turn an export manifest into portable files
 * (structured JSON + a readable, self-contained HTML page).
 */
import { moodEmoji } from "./moods.ts";

export type ExportEntry = {
  id: string;
  title: string;
  content: string;
  mood: string | null;
  diary_date: string;
  created_at: string;
  updated_at: string;
};

export type ExportAttachment = {
  id: string;
  diary_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  attachment_type: "image" | "audio" | "document";
  duration_ms: number | null;
  created_at: string;
  storage_path: string;
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A safe, readable file/folder name (keeps Vietnamese letters). */
export function safeName(s: string, max = 60): string {
  const cleaned = s
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  return (cleaned || "untitled").slice(0, max).trim();
}

/** Folder for one entry inside the ZIP, unique even with identical titles/dates. */
export function entryFolder(e: Pick<ExportEntry, "id" | "diary_date" | "title">): string {
  return `${e.diary_date} ${safeName(e.title, 40)} (${e.id.slice(0, 8)})`;
}

/** Path of an attachment inside the ZIP; de-duplicates equal file names. */
export function attachmentZipPaths(entries: ExportEntry[], attachments: ExportAttachment[]): Map<string, string> {
  const folderById = new Map(entries.map((e) => [e.id, entryFolder(e)]));
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const a of attachments) {
    const folder = folderById.get(a.diary_id) ?? "unknown";
    const name = safeName(a.file_name, 100);
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let candidate = `attachments/${folder}/${name}`;
    for (let i = 2; used.has(candidate); i++) candidate = `attachments/${folder}/${base} (${i})${ext}`;
    used.add(candidate);
    out.set(a.id, candidate);
  }
  return out;
}

export function buildReadableHtml(
  displayName: string,
  entries: ExportEntry[],
  attachments: ExportAttachment[],
  zipPaths: Map<string, string>,
  exportedAt: string,
): string {
  const byEntry = new Map<string, ExportAttachment[]>();
  for (const a of attachments) {
    const list = byEntry.get(a.diary_id) ?? [];
    list.push(a);
    byEntry.set(a.diary_id, list);
  }
  const sorted = [...entries].sort((a, b) => b.diary_date.localeCompare(a.diary_date) || b.created_at.localeCompare(a.created_at));
  const body = sorted
    .map((e) => {
      const atts = byEntry.get(e.id) ?? [];
      const href = (a: ExportAttachment) => encodeURI(zipPaths.get(a.id) ?? "");
      const imgs = atts
        .filter((a) => a.attachment_type === "image")
        .map((a) => `<a href="${href(a)}"><img src="${href(a)}" alt="${escapeHtml(a.file_name)}" loading="lazy"></a>`)
        .join("");
      const audio = atts
        .filter((a) => a.attachment_type === "audio")
        .map((a) => `<p><audio controls preload="none" src="${href(a)}"></audio><br><small>${escapeHtml(a.file_name)}</small></p>`)
        .join("");
      const docs = atts
        .filter((a) => a.attachment_type === "document")
        .map((a) => `<li><a href="${href(a)}">${escapeHtml(a.file_name)}</a></li>`)
        .join("");
      const mood = moodEmoji(e.mood);
      return `<article>
<h2>${escapeHtml(e.title)}</h2>
<p class="meta">${escapeHtml(e.diary_date)}${mood ? ` · ${mood}` : ""}</p>
<div class="content">${escapeHtml(e.content)}</div>
${imgs ? `<div class="photos">${imgs}</div>` : ""}${audio}${docs ? `<ul>${docs}</ul>` : ""}
</article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nhật Ký Của Ý — ${escapeHtml(displayName)}</title>
<style>
body{font-family:Georgia,"Times New Roman",serif;background:#fbf6ee;color:#3b3340;max-width:46rem;margin:0 auto;padding:2rem 1rem;line-height:1.7}
h1{font-weight:normal}article{background:#fffdf9;border:1px solid #eadfd2;border-radius:1rem;padding:1.5rem;margin:1.5rem 0}
h2{margin:0;font-weight:normal}.meta{color:#5e5296;font-size:.9rem;margin:.25rem 0 1rem}.content{white-space:pre-wrap}
.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(10rem,1fr));gap:.5rem;margin-top:1rem}.photos img{width:100%;border-radius:.5rem}
audio{width:100%}
</style></head><body>
<h1>Nhật Ký Của Ý</h1>
<p>${escapeHtml(displayName)} · ${entries.length} · ${escapeHtml(exportedAt)}</p>
${body}
</body></html>`;
}
