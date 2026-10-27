import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/env";

// /auth/confirm must be reachable while signed out: it is where invitation links land.
const PUBLIC_PATHS = ["/login", "/auth/confirm"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out
 * visitors to /login. This is a convenience layer only — every page and server
 * action also checks the session and role on the server, and RLS protects data.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cfg = getSupabaseConfig();
  if (!cfg) {
    // Not configured yet: only the login page (which explains setup) is reachable.
    if (isPublic(request.nextUrl.pathname)) return response;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // IMPORTANT: getUser() validates the JWT with Supabase Auth (getSession() would not).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }

  // Private pages must never be cached by shared caches.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
