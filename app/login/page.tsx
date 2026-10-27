import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabaseConfig } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { TulipMark } from "@/components/layout/tulip-mark";
import { LoginForm } from "./login-form";
import { HashSessionHandler } from "./hash-session-handler";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { t } = await getI18n();
  const configured = Boolean(getSupabaseConfig());

  let notice: string | null = null;
  if (configured) {
    const session = await getSession();
    if (session?.profile) redirect("/");
    if (session && !session.profile) notice = t.auth.noAccess;
  }
  if (params.error === "no_access") notice = t.auth.noAccess;
  if (params.error === "link_invalid") notice = t.auth.linkInvalid;
  const signedOut = params.signed_out === "1";
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <TulipMark className="mx-auto mb-5 size-14" />
          <h1 className="font-serif text-3xl leading-tight">{t.meta.appName}</h1>
          <p className="mt-3 text-balance text-ink-soft">{t.auth.subtitle}</p>
        </div>

        <div className="rounded-[1.75rem] border border-line bg-sheet p-6 shadow-soft sm:p-7">
          <h2 className="mb-5 font-serif text-xl">{t.auth.title}</h2>
          <HashSessionHandler />
          {!configured && (
            <p role="alert" className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {t.auth.configMissing}
            </p>
          )}
          {notice && (
            <p role="alert" className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {notice}
            </p>
          )}
          {signedOut && !notice && (
            <p role="status" className="mb-4 rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage-ink">
              {t.auth.signedOut}
            </p>
          )}
          <LoginForm next={next} disabled={!configured} />
        </div>
        <p className="mx-auto mt-6 max-w-xs text-balance text-center text-sm text-ink-soft">{t.auth.privateNote}</p>
      </div>
    </main>
  );
}
