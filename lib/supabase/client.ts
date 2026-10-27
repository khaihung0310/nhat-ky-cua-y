"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Browser client (publishable key + the user's session). Used for direct-to-storage uploads. */
export function getBrowserClient(): SupabaseClient {
  if (!client) {
    const { url, key } = requireSupabaseConfig();
    client = createBrowserClient(url, key);
  }
  return client;
}
