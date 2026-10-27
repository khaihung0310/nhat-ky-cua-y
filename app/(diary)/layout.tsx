import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { AppNav } from "@/components/layout/app-nav";

// Private, per-user pages: always rendered on demand, never statically cached.
export const dynamic = "force-dynamic";

export default async function DiaryLayout({ children }: { children: React.ReactNode }) {
  const session = await requireMember();
  if (session.profile.role === "owner" && !session.profile.onboarded_at) redirect("/welcome");
  const { t } = await getI18n();

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-sheet focus:px-4 focus:py-2 focus:shadow-soft"
      >
        {t.nav.skipToContent}
      </a>
      <AppNav role={session.profile.role} />
      <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-6 md:pb-16 md:pt-10">
        {children}
      </main>
    </div>
  );
}
