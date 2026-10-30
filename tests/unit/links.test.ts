import { test } from "node:test";
import assert from "node:assert/strict";
import { foldForSearch, linkHost, linkMatches, normalizeUrl, validateLinkInput } from "../../lib/links.ts";

test("[links] pasted links are normalised", () => {
  assert.equal(normalizeUrl("https://www.youtube.com/watch?v=abc"), "https://www.youtube.com/watch?v=abc");
  assert.equal(normalizeUrl("  youtube.com/watch?v=abc  "), "https://youtube.com/watch?v=abc");
  assert.equal(normalizeUrl("open.spotify.com/track/1"), "https://open.spotify.com/track/1");
  assert.equal(normalizeUrl("http://vnexpress.net"), "http://vnexpress.net/");
  assert.equal(normalizeUrl("https://vi.wikipedia.org/wiki/Hồ_Gươm"), "https://vi.wikipedia.org/wiki/H%E1%BB%93_G%C6%B0%C6%A1m");
});

test("[links] dangerous or broken links are rejected", () => {
  for (const bad of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "vbscript:msgbox",
    "https://user:pass@example.com",
    "not a link",
    "hello",
    "",
    "   ",
    "https://",
  ]) {
    assert.equal(normalizeUrl(bad), null, bad);
  }
});

test("[links] input validation", () => {
  const ok = validateLinkInput({ url: "youtube.com/x", title: "  Bài   hát  ", note: " nghe khi buồn \r\n " });
  assert.deepEqual(ok, { ok: true, value: { url: "https://youtube.com/x", title: "Bài hát", note: "nghe khi buồn" } });
  const bad = validateLinkInput({ url: "javascript:x", title: "a".repeat(201), note: "b".repeat(2001) });
  assert.deepEqual(!bad.ok && bad.errors, { url: "url_invalid", title: "title_too_long", note: "note_too_long" });
  const long = validateLinkInput({ url: `https://example.com/${"x".repeat(2100)}` });
  assert.deepEqual(!long.ok && long.errors, { url: "url_too_long" });
});

test("[links] display host and accent-insensitive filter", () => {
  assert.equal(linkHost("https://www.youtube.com/watch?v=abc"), "youtube.com");
  assert.equal(foldForSearch("Nhạc ĐÊM"), "nhac dem");
  const link = { url: "https://youtube.com/x", title: "Bài hát hôm nay", note: "Nghe lúc đi dạo" };
  assert.ok(linkMatches(link, "bai hat"));
  assert.ok(linkMatches(link, "di dao"));
  assert.ok(linkMatches(link, "youtube"));
  assert.ok(linkMatches(link, ""));
  assert.ok(!linkMatches(link, "spotify"));
});
