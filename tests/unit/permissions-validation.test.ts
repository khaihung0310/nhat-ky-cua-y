import { test } from "node:test";
import assert from "node:assert/strict";
import { can } from "../../lib/permissions.ts";
import { safeRedirectPath, validateDisplayName, validateEntryInput, validatePassword } from "../../lib/validation.ts";
import { countMoods, isMood, moodEmoji } from "../../lib/moods.ts";

test("[6] viewer capabilities are read-only", () => {
  for (const a of ["entry:create", "entry:update", "entry:delete", "attachment:upload", "attachment:delete", "audio:record", "draft:use", "diary:export"] as const) {
    assert.equal(can("viewer", a), false, a);
  }
  for (const a of ["entry:read", "attachment:read", "profile:update-own", "password:change-own"] as const) {
    assert.equal(can("viewer", a), true, a);
  }
});

test("owner has full diary capabilities; unknown/missing roles have none", () => {
  assert.equal(can("owner", "entry:create"), true);
  assert.equal(can("owner", "diary:export"), true);
  assert.equal(can(null, "entry:read"), false);
  assert.equal(can(undefined, "entry:read"), false);
  // @ts-expect-error — a forged role string from the client must not grant anything
  assert.equal(can("admin", "entry:read"), false);
});

test("[2] entry validation accepts a valid entry and normalises text", () => {
  const r = validateEntryInput({ title: "  Hồ Gươm  ", content: "Dòng 1\r\nDòng 2\u0000  ", mood: "happy", diaryDate: "2026-10-27" }, "2026-10-27");
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.value, { title: "Hồ Gươm", content: "Dòng 1\nDòng 2", mood: "happy", diaryDate: "2026-10-27" });
});

test("entry validation: mood optional, back-dating allowed, future dates refused", () => {
  const ok = validateEntryInput({ title: "x", content: "", mood: "", diaryDate: "2020-01-01" }, "2026-10-27");
  assert.ok(ok.ok && ok.value.mood === null);
  const future = validateEntryInput({ title: "x", content: "", diaryDate: "2026-10-28" }, "2026-10-27");
  assert.deepEqual(!future.ok && future.errors, { diaryDate: "date_future" });
});

test("entry validation rejects bad input", () => {
  const r = validateEntryInput({ title: "   ", content: "a".repeat(100_001), mood: "depressed", diaryDate: "2026-02-30" }, "2026-10-27");
  assert.deepEqual(!r.ok && r.errors, {
    title: "title_required",
    content: "content_too_long",
    mood: "mood_invalid",
    diaryDate: "date_invalid",
  });
  const long = validateEntryInput({ title: "a".repeat(201), content: "", diaryDate: "2026-10-27" }, "2026-10-27");
  assert.deepEqual(!long.ok && long.errors, { title: "title_too_long" });
});

test("Vietnamese text is NFC-normalised (IME output may be decomposed)", () => {
  const decomposed = "Nhật ký".normalize("NFD");
  const r = validateEntryInput({ title: decomposed, content: "", diaryDate: "2026-10-27" }, "2026-10-27");
  assert.ok(r.ok && r.value.title === "Nhật ký".normalize("NFC"));
});

test("display name and password validation", () => {
  assert.deepEqual(validateDisplayName(" Ý "), { ok: true, value: "Ý" });
  assert.deepEqual(validateDisplayName(""), { ok: false });
  assert.deepEqual(validateDisplayName("a".repeat(61)), { ok: false });
  assert.equal(validatePassword("short", "short"), "too_short");
  assert.equal(validatePassword("long enough pw", "different pw!!"), "mismatch");
  assert.equal(validatePassword("long enough pw", "long enough pw"), "ok");
  assert.equal(validatePassword("x".repeat(73), "x".repeat(73)), "too_long");
});

test("login redirect cannot be used as an open redirect", () => {
  assert.equal(safeRedirectPath("/entries/abc"), "/entries/abc");
  assert.equal(safeRedirectPath("https://evil.example"), "/");
  assert.equal(safeRedirectPath("//evil.example"), "/");
  assert.equal(safeRedirectPath("/\\evil.example"), "/");
  assert.equal(safeRedirectPath(undefined), "/");
});

test("moods", () => {
  assert.ok(isMood("peaceful"));
  assert.ok(!isMood("depressed"));
  assert.equal(moodEmoji("happy"), "😊");
  assert.equal(moodEmoji(null), null);
  assert.deepEqual(
    countMoods([{ mood: "sad" }, { mood: "happy" }, { mood: null }, { mood: "happy" }]).map((m) => [m.key, m.count]),
    [["happy", 2], ["sad", 1]],
  );
});
