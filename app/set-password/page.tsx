import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { TulipMark } from "@/components/layout/tulip-mark";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Đặt mật khẩu" };
export const dynamic = "force-dynamic";

/** Reached from an invitation (or password-reset) link, after the token was verified. */
export default async function SetPasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login?error=link_invalid");
  const { t } = await getI18n();

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <TulipMark className="mx-auto mb-5 size-14" />
          <h1 className="font-serif text-3xl leading-tight">{t.auth.setPasswordTitle}</h1>
          <p className="mt-3 text-balance text-ink-soft">{t.auth.setPasswordSubtitle}</p>
        </div>
        <div className="rounded-[1.75rem] border border-line bg-sheet p-6 shadow-soft sm:p-7">
          {session.email && <p className="mb-4 text-sm text-ink-soft">{session.email}</p>}
          <SetPasswordForm email={session.email ?? ""} />
        </div>
      </div>
    </main>
  );
}
