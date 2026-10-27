import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "@/lib/env";

/**
 * Supabase client bound to the signed-in user's session cookies.
 * Every query runs as that user, so Postgres RLS is always enforced.
 * This app never uses the service-role key.
 */
export async function createClient() {
  const { url, key } = requireSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component — the proxy refreshes the session instead.
        }
      },
    },
  });
}
