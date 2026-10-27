import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole } from "@/lib/permissions";
import type { Profile } from "@/lib/types";

export type Session = {
  userId: string;
  email: string | null;
  /** null when the account exists in Auth but no role has been assigned. */
  profile: Profile | null;
};

export type MemberSession = Session & { profile: Profile };

/**
 * Reads the authenticated user (validated by Supabase Auth) and their profile.
 * The role ALWAYS comes from the database, never from the client.
 * Cached per request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, language, theme, onboarded_at, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile || !isRole(profile.role)) {
    return { userId: user.id, email: user.email ?? null, profile: null };
  }
  return { userId: user.id, email: user.email ?? null, profile };
});

/** For pages: any authorised member (owner or viewer). */
export async function requireMember(): Promise<MemberSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile) redirect("/login?error=no_access");
  return session as MemberSession;
}

/** For owner-only pages. Viewers are sent home (they never see write UI). */
export async function requireOwner(): Promise<MemberSession> {
  const session = await requireMember();
  if (session.profile.role !== "owner") redirect("/");
  return session;
}

/** For server actions: returns null instead of redirecting. */
export async function getOwnerForAction(): Promise<MemberSession | null> {
  const session = await getSession();
  if (!session?.profile || session.profile.role !== "owner") return null;
  return session as MemberSession;
}

export async function getMemberForAction(): Promise<MemberSession | null> {
  const session = await getSession();
  if (!session?.profile) return null;
  return session as MemberSession;
}
