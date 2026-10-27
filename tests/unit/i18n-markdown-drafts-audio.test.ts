import { test } from "node:test";
import assert from "node:assert/strict";
import { en } from "../../lib/i18n/en.ts";
import { vi } from "../../lib/i18n/vi.ts";
import { format, getDictionary } from "../../lib/i18n/index.ts";
import { parseBlocks, parseInline, preview, toPlainText } from "../../lib/markdown.ts";
import { debounce, isDraftMeaningful, parseDraft, pickNewestDraft, type DraftData } from "../../lib/drafts.ts";
import { formatDuration, micErrorKey, pickAudioMimeType } from "../../lib/audio.ts";

function shape(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") return [prefix];
  if (Array.isArray(obj)) return [`${prefix}[]`];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
}

function values(obj: unknown): string[] {
  if (typeof obj === "string") return [obj];
  if (Array.isArray(obj)) return obj as string[];
  return Object.values(obj as Record<string, unknown>).flatMap(values);
}

test("[15] Vietnamese and English dictionaries have exactly the same keys", () => {
  assert.deepEqual(shape(en).sort(), shape(vi).sort());
});

test("[15] no empty translations and placeholders match between languages", () => {
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
  const viKeys = shape(vi);
  const flat = (o: unknown, p = ""): [string, unknown][] =>
    typeof o === "string" || Array.isArray(o)
      ? [[p, o]]
      : Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k));
  const enMap = new Map(flat(en));
  for (const [key, v] of flat(vi)) {
    const e = enMap.get(key);
    if (typeof v === "string") {
      assert.ok(v.trim().length > 0, `vi.${key} empty`);
      assert.ok(typeof e === "string" && e.trim().length > 0, `en.${key} empty`);
      assert.equal(placeholders(v), placeholders(e as string), `placeholders differ for ${key}`);
    } else {
      assert.equal((v as string[]).length, (e as string[]).length, `array length differs for ${key}`);
    }
  }
  assert.ok(viKeys.length > 150);
  assert.ok(values(vi).every((s) => s.trim().length > 0));
});

test("[15] default language is Vietnamese; switching returns English", () => {
  assert.equal(getDictionary(undefined), vi as unknown);
  assert.equal(getDictionary("fr"), vi as unknown);
  assert.equal(getDictionary("en").nav.home, "Home");
  assert.equal(getDictionary("vi").nav.home, "Trang chủ");
  assert.equal(format(vi.dashboard.greetingOwner, { name: "Ý" }).replace(/\u00a0/g, " "), "Chào Ý, hôm nay của cậu thế nào? 🌷");
  assert.equal(format("{a} {b}", { a: 1 }), "1 {b}");
});

test("diary formatting is parsed to tokens, never to HTML", () => {
  assert.deepEqual(parseInline("hôm nay **rất** *vui* và _bình yên_"), [
    { kind: "text", text: "hôm nay " },
    { kind: "bold", text: "rất" },
    { kind: "text", text: " " },
    { kind: "italic", text: "vui" },
    { kind: "text", text: " và " },
    { kind: "italic", text: "bình yên" },
  ]);
  const xss = parseBlocks('<img src=x onerror="alert(1)"> **<script>alert(1)</script>**');
  const p = xss[0];
  assert.equal(p?.kind, "paragraph");
  // the markup survives only as literal text
  assert.equal(p?.kind === "paragraph" && p.lines[0]![0]!.text, '<img src=x onerror="alert(1)"> ');
  assert.equal(p?.kind === "paragraph" && p.lines[0]![1]!.kind, "bold");
});

test("snake_case and multiplication are not mangled into italics", () => {
  assert.deepEqual(parseInline("file_name_here"), [{ kind: "text", text: "file_name_here" }]);
  assert.deepEqual(parseInline("2 * 3 * 4"), [{ kind: "text", text: "2 * 3 * 4" }]);
});

test("blocks: paragraphs, line breaks, quotes, lists", () => {
  const blocks = parseBlocks("Dòng 1\nDòng 2\n\n> trích dẫn\n- một\n- hai\n\n\nCuối");
  assert.deepEqual(blocks.map((b) => b.kind), ["paragraph", "quote", "list", "paragraph"]);
  assert.equal(blocks[0]?.kind === "paragraph" && blocks[0].lines.length, 2);
  assert.equal(blocks[2]?.kind === "list" && blocks[2].items.length, 2);
});

test("plain-text preview strips formatting and truncates on a word", () => {
  assert.equal(toPlainText("**Chào** *cậu*\n> nhé"), "Chào cậu nhé");
  const p = preview("Hôm nay trời đẹp lắm, mình đi dạo quanh hồ và ăn kem", 30);
  assert.ok(p.endsWith("…"));
  assert.ok(p.length <= 31);
});

const d = (title: string, updatedAt: string, content = ""): DraftData => ({ title, content, mood: null, diaryDate: null, updatedAt });

test("[13] after a refresh the newest draft (device vs server) wins", () => {
  const local = d("local", "2026-10-27T10:00:05Z");
  const remote = d("remote", "2026-10-27T10:00:00Z");
  assert.equal(pickNewestDraft(local, remote)?.title, "local");
  assert.equal(pickNewestDraft(null, remote)?.title, "remote");
  assert.equal(pickNewestDraft(local, null)?.title, "local");
  assert.equal(pickNewestDraft(null, null), null);
});

test("[13] drafts identical to the published entry, or empty, are not offered", () => {
  const baseline = { title: "A", content: "B", mood: null, diaryDate: "2026-10-27" };
  assert.equal(isDraftMeaningful({ title: "A", content: "B", mood: null, diaryDate: "2026-10-27" }, baseline), false);
  assert.equal(isDraftMeaningful({ title: "", content: " ", mood: "happy", diaryDate: null }, baseline), false);
  assert.equal(isDraftMeaningful({ title: "A", content: "B more", mood: null, diaryDate: "2026-10-27" }, baseline), true);
});

test("[13] corrupted local drafts are ignored safely", () => {
  assert.equal(parseDraft("{not json"), null);
  assert.equal(parseDraft(JSON.stringify({ title: 1 })), null);
  assert.equal(parseDraft(JSON.stringify({ title: "a", content: "b", updatedAt: "nope" })), null);
  assert.deepEqual(parseDraft(JSON.stringify(d("a", "2026-10-27T00:00:00Z", "b"))), d("a", "2026-10-27T00:00:00Z", "b"));
});

test("debounce coalesces rapid saves and flush runs immediately", async () => {
  const calls: string[] = [];
  const save = debounce((v: string) => calls.push(v), 20);
  save("a");
  save("ab");
  save("abc");
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(calls, ["abc"]);
  save("x");
  save.flush();
  assert.deepEqual(calls, ["abc", "x"]);
  save("y");
  save.cancel();
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(calls, ["abc", "x"]);
});

test("[10] audio MIME type is detected per browser", () => {
  const chrome = (t: string) => t.startsWith("audio/webm");
  const safari = (t: string) => t.startsWith("audio/mp4");
  const firefoxOld = (t: string) => t.startsWith("audio/ogg");
  assert.equal(pickAudioMimeType(chrome), "audio/webm;codecs=opus");
  assert.equal(pickAudioMimeType(safari), "audio/mp4;codecs=mp4a.40.2");
  assert.equal(pickAudioMimeType(firefoxOld), "audio/ogg;codecs=opus");
  assert.equal(pickAudioMimeType(() => false), "");
  assert.equal(pickAudioMimeType(undefined), "");
  assert.equal(pickAudioMimeType(() => { throw new Error("x"); }), "");
});

test("recording helpers", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(65_400), "1:05");
  assert.equal(formatDuration(3_725_000), "1:02:05");
  assert.equal(micErrorKey({ name: "NotAllowedError" }), "denied");
  assert.equal(micErrorKey({ name: "NotFoundError" }), "notFound");
  assert.equal(micErrorKey(new Error("x")), "unknown");
});
