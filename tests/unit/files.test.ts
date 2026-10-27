import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildStoragePath,
  detectAttachment,
  formatBytes,
  isStoragePathFor,
  limitsFromEnv,
  normalizeMime,
  sanitizeFileName,
  validateFile,
} from "../../lib/files.ts";

const MB = 1024 * 1024;
const OWNER = "11111111-1111-1111-1111-111111111111";
const ENTRY = "aaaaaaaa-0000-0000-0000-000000000001";
const OBJ = "0f8fad5b-d9cb-469f-a165-70867728950e";

test("[7] images are accepted and classified", () => {
  for (const [name, mime] of [
    ["a.jpg", "image/jpeg"],
    ["a.png", "image/png"],
    ["a.webp", "image/webp"],
    ["IMG_0001.HEIC", ""],
  ] as const) {
    const r = validateFile({ name, size: 2 * MB, type: mime });
    assert.ok(r.ok, name);
    assert.equal(r.ok && r.type, "image");
  }
});

test("[10] browser audio recordings are accepted (webm/opus, Safari mp4, ogg)", () => {
  assert.deepEqual(detectAttachment("rec.webm", "audio/webm;codecs=opus"), { mime: "audio/webm", type: "audio" });
  assert.deepEqual(detectAttachment("rec.m4a", "audio/mp4"), { mime: "audio/mp4", type: "audio" });
  assert.deepEqual(detectAttachment("rec.ogg", "audio/ogg;codecs=opus"), { mime: "audio/ogg", type: "audio" });
  assert.deepEqual(detectAttachment("rec.webm", "video/webm"), { mime: "audio/webm", type: "audio" });
});

test("documents are accepted", () => {
  for (const [name, mime] of [
    ["thư.pdf", "application/pdf"],
    ["bài.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["note.txt", "text/plain"],
    ["ảnh.zip", "application/zip"],
    ["x.docx", ""],
    ["x.docx", "application/octet-stream"],
  ] as const) {
    const r = validateFile({ name, size: 1000, type: mime });
    assert.ok(r.ok && r.type === "document", `${name} ${mime}`);
  }
});

test("dangerous or unsupported files are rejected", () => {
  for (const [name, mime] of [
    ["x.svg", "image/svg+xml"],
    ["x.html", "text/html"],
    ["x.html", "text/plain"], // lying MIME type with dangerous extension
    ["setup.exe", "application/x-msdownload"],
    ["run.sh", "text/plain"],
    ["x.js", "application/javascript"],
    ["movie.mp4", "video/mp4"],
    ["unknown", ""],
  ] as const) {
    const r = validateFile({ name, size: 1000, type: mime });
    assert.equal(r.ok, false, `${name} ${mime}`);
    assert.equal(!r.ok && r.code, "type", `${name} ${mime}`);
  }
});

test("size limits are enforced per type and capped at 50 MB", () => {
  const limits = limitsFromEnv({ NEXT_PUBLIC_MAX_IMAGE_MB: "10", NEXT_PUBLIC_MAX_AUDIO_MB: "999", NEXT_PUBLIC_MAX_DOCUMENT_MB: "abc" });
  assert.deepEqual(limits, { image: 10, audio: 50, document: 25 });
  assert.equal(validateFile({ name: "a.jpg", size: 10 * MB, type: "image/jpeg" }, limits).ok, true);
  const big = validateFile({ name: "a.jpg", size: 10 * MB + 1, type: "image/jpeg" }, limits);
  assert.equal(!big.ok && big.code, "size");
  const empty = validateFile({ name: "a.jpg", size: 0, type: "image/jpeg" }, limits);
  assert.equal(!empty.ok && empty.code, "empty");
});

test("expected type mismatch is rejected", () => {
  const r = validateFile({ name: "a.pdf", size: 10, type: "application/pdf" }, undefined, "audio");
  assert.equal(!r.ok && r.code, "type");
});

test("file names are sanitised", () => {
  assert.equal(sanitizeFileName("../../etc/passwd"), "passwd");
  assert.equal(sanitizeFileName("C:\\Users\\Ý\\ảnh đẹp.jpg"), "ảnh đẹp.jpg");
  assert.equal(sanitizeFileName('<script>"x".png'), "script>x.png".replace(">", ""));
  assert.equal(sanitizeFileName("   "), "file");
  assert.equal(sanitizeFileName(".hidden"), "hidden");
  const long = sanitizeFileName(`${"a".repeat(300)}.pdf`);
  assert.equal(long.length, 120);
  assert.ok(long.endsWith(".pdf"));
});

test("storage paths follow <owner>/<entry>/<uuid>.<ext>", () => {
  const p = buildStoragePath(OWNER, ENTRY, OBJ, "audio/webm;codecs=opus");
  assert.equal(p, `${OWNER}/${ENTRY}/${OBJ}.webm`);
  assert.ok(isStoragePathFor(p, OWNER, ENTRY));
  assert.ok(!isStoragePathFor(p, ENTRY, OWNER));
  assert.ok(!isStoragePathFor(`${OWNER}/${ENTRY}/../x.jpg`, OWNER, ENTRY));
  assert.ok(!isStoragePathFor(`${OWNER}/${ENTRY}/sub/${OBJ}.jpg`, OWNER, ENTRY));
  assert.throws(() => buildStoragePath("not-a-uuid", ENTRY, OBJ, "image/png"));
});

test("misc helpers", () => {
  assert.equal(normalizeMime(" Audio/WebM; codecs=opus "), "audio/webm");
  assert.equal(formatBytes(512, "en"), "512 B");
  assert.equal(formatBytes(1536, "en"), "1.5 KB");
  assert.equal(formatBytes(25 * MB, "en"), "25 MB");
});
