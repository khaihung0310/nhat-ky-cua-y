import { limitsFromEnv } from "./files.ts";

/**
 * Public configuration. These values are safe in the browser: the publishable
 * (anon) key only grants what Row Level Security allows.
 * NEXT_PUBLIC_* variables must be referenced literally so Next.js inlines them.
 */
export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("your-project-ref") || key.includes("replace_me")) return null;
  return { url, key };
}

export function requireSupabaseConfig(): { url: string; key: string } {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return cfg;
}

export const STORAGE_BUCKET = "diary-files";

export const uploadLimits = limitsFromEnv({
  NEXT_PUBLIC_MAX_IMAGE_MB: process.env.NEXT_PUBLIC_MAX_IMAGE_MB,
  NEXT_PUBLIC_MAX_AUDIO_MB: process.env.NEXT_PUBLIC_MAX_AUDIO_MB,
  NEXT_PUBLIC_MAX_DOCUMENT_MB: process.env.NEXT_PUBLIC_MAX_DOCUMENT_MB,
});

/** Signed URLs for viewing private files are short-lived. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const ENTRIES_PAGE_SIZE = 12;
