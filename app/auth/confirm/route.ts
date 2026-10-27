import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env";
import { safeRedirectPath } from "@/lib/validation";

const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "email", "signup"];

/**
 * Landing point for links in Supabase Auth e-mails (invitation, password reset).
 *   ?token_hash=…&type=invite&next=/set-password   (recommended e-mail template)
 *   ?code=…                                        (PKCE links)
 * Verifies the one-time token server-side, stores the session cookie, then
 * sends the person on to choose their password.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const needsPassword = type === "invite" || type === "recovery";
  const next = safeRedirectPath(url.searchParams.get("next"), needsPassword ? "/set-password" : "/");

  const fail = () => NextResponse.redirect(new URL("/login?error=link_invalid", url.origin));
  if (!getSupabaseConfig()) return fail();

  const supabase = await createClient();

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail();
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail();
    return NextResponse.redirect(new URL(next, url.origin));
  }

  return fail();
}
