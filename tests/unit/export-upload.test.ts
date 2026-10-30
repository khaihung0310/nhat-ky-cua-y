import { test } from "node:test";
import assert from "node:assert/strict";
import { attachmentZipPaths, buildReadableHtml, entryFolder, escapeHtml, safeName, type ExportAttachment, type ExportEntry } from "../../lib/export-format.ts";
import { classifyUploadStatus } from "../../lib/upload-errors.ts";

const entry = (id: string, title: string, date = "2026-10-27"): ExportEntry => ({
  id, title, content: "", mood: "happy", diary_date: date, created_at: `${date}T01:00:00Z`, updated_at: `${date}T01:00:00Z`,
});
const att = (id: string, diary_id: string, file_name: string, type: ExportAttachment["attachment_type"] = "image"): ExportAttachment => ({
  id, diary_id, file_name, mime_type: "image/jpeg", file_size: 10, attachment_type: type, duration_ms: null, created_at: "2026-10-27T01:00:00Z", storage_path: `o/${diary_id}/${id}.jpg`,
});

test("[14] upload failures are classified so the user can retry", () => {
  assert.equal(classifyUploadStatus(200), null);
  assert.equal(classifyUploadStatus(0), "network");
  assert.equal(classifyUploadStatus(503), "network");
  assert.equal(classifyUploadStatus(429), "network");
  assert.equal(classifyUploadStatus(401), "session");
  assert.equal(classifyUploadStatus(403), "session");
  assert.equal(classifyUploadStatus(413), "storage");
  assert.equal(classifyUploadStatus(415), "storage");
});

test("export: readable HTML escapes diary content (no script injection)", () => {
  const e = { ...entry("aaaaaaaa-1", "<script>alert(1)</script>"), content: '<img src=x onerror="alert(1)">' };
  const html = buildReadableHtml("Ý", [e], [], new Map(), "2026-10-27T00:00:00Z");
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(escapeHtml(`a&b"'`), "a&amp;b&quot;&#39;");
});

test("export: unique, safe, Vietnamese-friendly paths inside the ZIP", () => {
  const e1 = entry("aaaaaaaa-1111", "Hồ Gươm / chiều");
  const e2 = entry("bbbbbbbb-2222", "Hồ Gươm / chiều");
  const paths = attachmentZipPaths([e1, e2], [att("1", e1.id, "ảnh.jpg"), att("2", e1.id, "ảnh.jpg"), att("3", e2.id, "../../evil.jpg")]);
  assert.equal(paths.get("1"), "attachments/2026-10-27 Hồ Gươm chiều (aaaaaaaa)/ảnh.jpg");
  assert.equal(paths.get("2"), "attachments/2026-10-27 Hồ Gươm chiều (aaaaaaaa)/ảnh (2).jpg");
  assert.ok(!paths.get("3")!.includes(".."));
  assert.notEqual(entryFolder(e1), entryFolder(e2));
  assert.equal(safeName("   "), "untitled");
});

test("export: saved links are included safely in diary.html", () => {
  const html = buildReadableHtml("Ý", [], [], new Map(), "2026-10-30T00:00:00Z", [
    { id: "1", url: "https://youtube.com/watch?v=a&b=<x>", title: "<b>Bài hát</b>", note: "nghe khi buồn", created_at: "2026-10-30T10:00:00Z", updated_at: "2026-10-30T10:00:00Z" },
    { id: "2", url: "javascript:alert(1)", title: "evil", note: "", created_at: "2026-10-30T10:00:00Z", updated_at: "2026-10-30T10:00:00Z" },
  ]);
  assert.ok(html.includes("Liên kết đã lưu"));
  assert.ok(html.includes('href="https://youtube.com/watch?v=a&amp;b=&lt;x&gt;"'));
  assert.ok(html.includes("&lt;b&gt;Bài hát&lt;/b&gt;"));
  assert.ok(!html.includes("javascript:"));
});
