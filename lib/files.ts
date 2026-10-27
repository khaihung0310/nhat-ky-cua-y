/**
 * Attachment validation shared by the browser (fast feedback) and the server
 * (authoritative re-check when an upload is registered). The storage bucket's
 * allowed MIME list + size limit and the database CHECK constraints are the
 * final line of defence.
 */

export type AttachmentType = "image" | "audio" | "document";

export const ATTACHMENT_TYPES: readonly AttachmentType[] = ["image", "audio", "document"];

/** Allowed MIME types → attachment type. Must stay in sync with 20261027000300_storage.sql. */
export const ALLOWED_MIME_TYPES: Readonly<Record<string, AttachmentType>> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "image/heic": "image",
  "image/heif": "image",

  "audio/webm": "audio",
  "audio/ogg": "audio",
  "audio/mp4": "audio",
  "audio/mpeg": "audio",
  "audio/aac": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/x-m4a": "audio",
  "audio/m4a": "audio",
  "audio/flac": "audio",

  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.ms-excel": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
  "application/vnd.ms-powerpoint": "document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "document",
  "application/vnd.oasis.opendocument.text": "document",
  "application/vnd.oasis.opendocument.spreadsheet": "document",
  "application/vnd.oasis.opendocument.presentation": "document",
  "application/rtf": "document",
  "text/rtf": "document",
  "text/plain": "document",
  "text/markdown": "document",
  "text/csv": "document",
  "application/zip": "document",
  "application/x-zip-compressed": "document",
};

/** Fallback when the browser reports an empty/generic MIME type. */
const EXTENSION_MIME: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  webm: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  wav: "audio/wav",
  flac: "audio/flac",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  zip: "application/zip",
};

/** Canonical extension per MIME type, used for storage object names. */
const MIME_EXTENSION: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.oasis.opendocument.presentation": "odp",
};

/** Extensions that must never be accepted, whatever MIME type the browser claims. */
const BLOCKED_EXTENSIONS = new Set([
  "html", "htm", "xhtml", "svg", "svgz", "js", "mjs", "cjs", "exe", "msi", "bat", "cmd", "com", "scr",
  "sh", "ps1", "vbs", "jar", "apk", "dmg", "app", "php", "py", "rb", "pl", "dll", "so", "hta", "xml",
]);

export type UploadLimitsMb = { image: number; audio: number; document: number };

export const DEFAULT_LIMITS_MB: UploadLimitsMb = { image: 15, audio: 25, document: 25 };
/** Supabase free tier maximum, also enforced by the bucket + DB constraint. */
export const HARD_LIMIT_BYTES = 50 * 1024 * 1024;

function clampMb(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, 50);
}

/** Read limits from (NEXT_PUBLIC_) env values, falling back to safe defaults. */
export function limitsFromEnv(env: Record<string, string | undefined>): UploadLimitsMb {
  return {
    image: clampMb(env.NEXT_PUBLIC_MAX_IMAGE_MB, DEFAULT_LIMITS_MB.image),
    audio: clampMb(env.NEXT_PUBLIC_MAX_AUDIO_MB, DEFAULT_LIMITS_MB.audio),
    document: clampMb(env.NEXT_PUBLIC_MAX_DOCUMENT_MB, DEFAULT_LIMITS_MB.document),
  };
}

export function maxBytesFor(type: AttachmentType, limits: UploadLimitsMb): number {
  return Math.min(Math.round(limits[type] * 1024 * 1024), HARD_LIMIT_BYTES);
}

/** "audio/webm;codecs=opus" → "audio/webm" */
export function normalizeMime(mime: string | null | undefined): string {
  return (mime ?? "").split(";")[0]!.trim().toLowerCase();
}

export function fileExtension(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const idx = base.lastIndexOf(".");
  if (idx <= 0 || idx === base.length - 1) return "";
  return base.slice(idx + 1).toLowerCase();
}

/** Resolve the effective MIME + attachment type, or null if the file is not allowed. */
export function detectAttachment(name: string, mime: string | null | undefined): { mime: string; type: AttachmentType } | null {
  const ext = fileExtension(name);
  if (BLOCKED_EXTENSIONS.has(ext)) return null;
  let m = normalizeMime(mime);
  if (!m || m === "application/octet-stream" || !(m in ALLOWED_MIME_TYPES)) {
    // Browsers sometimes report "" or octet-stream for .docx/.heic/.m4a — trust the extension only then.
    if (!m || m === "application/octet-stream") {
      m = EXTENSION_MIME[ext] ?? "";
    }
  }
  // Some browsers label recorded .webm audio as video/webm.
  if (m === "video/webm" && (ext === "webm" || ext === "")) m = "audio/webm";
  if (m === "video/mp4" && ext === "m4a") m = "audio/mp4";
  const type = ALLOWED_MIME_TYPES[m];
  if (!type) return null;
  return { mime: m, type };
}

export type FileValidationResult =
  | { ok: true; mime: string; type: AttachmentType }
  | { ok: false; code: "empty" | "type" | "size" | "name"; maxBytes?: number };

export function validateFile(
  file: { name: string; size: number; type?: string | null },
  limits: UploadLimitsMb = DEFAULT_LIMITS_MB,
  expectedType?: AttachmentType,
): FileValidationResult {
  if (!file.name || file.name.length > 255) return { ok: false, code: "name" };
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, code: "empty" };
  const detected = detectAttachment(file.name, file.type);
  if (!detected) return { ok: false, code: "type" };
  if (expectedType && detected.type !== expectedType) return { ok: false, code: "type" };
  const maxBytes = maxBytesFor(detected.type, limits);
  if (file.size > maxBytes) return { ok: false, code: "size", maxBytes };
  return { ok: true, ...detected };
}

/** Make a user-supplied file name safe to store and display (never used as a path). */
export function sanitizeFileName(name: string, fallback = "file"): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!base) return fallback;
  if (base.length <= 120) return base;
  const ext = fileExtension(base);
  const keep = ext ? 120 - ext.length - 1 : 120;
  return ext ? `${base.slice(0, keep)}.${ext}` : base.slice(0, 120);
}

export function extensionForMime(mime: string): string {
  return MIME_EXTENSION[normalizeMime(mime)] ?? "bin";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** <owner>/<entry>/<random>.<ext> — the only path shape the storage policies accept. */
export function buildStoragePath(ownerId: string, entryId: string, objectId: string, mime: string): string {
  if (!isUuid(ownerId) || !isUuid(entryId) || !isUuid(objectId)) throw new Error("Invalid id for storage path");
  return `${ownerId}/${entryId}/${objectId}.${extensionForMime(mime)}`;
}

export function isStoragePathFor(path: string, ownerId: string, entryId: string): boolean {
  if (typeof path !== "string" || path.includes("..") || path.includes("//")) return false;
  const parts = path.split("/");
  if (parts.length !== 3) return false;
  const [owner, entry, file] = parts as [string, string, string];
  if (owner !== ownerId || entry !== entryId) return false;
  return /^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/i.test(file);
}

export function formatBytes(bytes: number, locale: "vi" | "en" = "vi"): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-GB", { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${fmt(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${fmt(bytes / (1024 * 1024))} MB`;
  return `${fmt(bytes / (1024 * 1024 * 1024))} GB`;
}

/** Short label for a document's type, e.g. "PDF", "DOCX". */
export function fileKindLabel(name: string, mime: string): string {
  const ext = fileExtension(name);
  if (ext) return ext.toUpperCase();
  return extensionForMime(mime).toUpperCase();
}

/** Accept attribute for <input type="file">. */
export function acceptAttribute(type?: AttachmentType): string {
  const mimes = Object.entries(ALLOWED_MIME_TYPES)
    .filter(([, t]) => !type || t === type)
    .map(([m]) => m);
  const exts = Object.entries(EXTENSION_MIME)
    .filter(([, m]) => !type || ALLOWED_MIME_TYPES[m] === type)
    .map(([e]) => `.${e}`);
  return [...mimes, ...exts].join(",");
}
