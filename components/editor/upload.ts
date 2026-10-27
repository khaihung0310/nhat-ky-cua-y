"use client";

import { getBrowserClient } from "@/lib/supabase/client";
import { requireSupabaseConfig, STORAGE_BUCKET } from "@/lib/env";
import { classifyUploadStatus, type UploadFailure } from "@/lib/upload-errors";

export class UploadError extends Error {
  constructor(public kind: UploadFailure) {
    super(kind);
  }
}

/**
 * Upload a file straight from the browser to the PRIVATE storage bucket using
 * the user's own session (storage RLS checks the owner + entry folder).
 * XMLHttpRequest is used because fetch() cannot report upload progress.
 * Never overwrites (x-upsert: false).
 */
export async function uploadToStorage(
  path: string,
  body: Blob,
  contentType: string,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { url, key } = requireSupabaseConfig();
  const {
    data: { session },
  } = await getBrowserClient().auth.getSession();
  if (!session) throw new UploadError("session");

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const endpoint = `${url}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      const failure = classifyUploadStatus(xhr.status);
      if (!failure) return resolve();
      reject(new UploadError(failure));
    };
    xhr.onerror = () => reject(new UploadError("network"));
    xhr.ontimeout = () => reject(new UploadError("network"));
    xhr.onabort = () => reject(new UploadError("aborted"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

const COMPRESSIBLE = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_DIMENSION = 2560;

/**
 * Downscale large photos in the browser before upload (keeps EXIF orientation,
 * strips location metadata as a side effect). Returns the original file when
 * compression isn't possible or doesn't help.
 */
export async function compressImage(file: File): Promise<{ blob: Blob; mime: string }> {
  const original = { blob: file as Blob, mime: file.type };
  if (!COMPRESSIBLE.has(file.type) || file.size < 1.2 * 1024 * 1024) return original;
  if (typeof createImageBitmap !== "function") return original;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    // PNG/WebP may have transparency → WebP; photos → JPEG.
    const outMime = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, outMime, 0.85));
    if (!blob || blob.type !== outMime || blob.size >= file.size) return original;
    return { blob, mime: outMime };
  } catch {
    return original;
  }
}

export function newObjectId(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback for older browsers without crypto.randomUUID
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
