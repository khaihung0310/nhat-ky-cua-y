import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { getI18n, getThemePreference } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ExportButton } from "@/components/settings/export-button";
import { DisplayNameForm, LogoutButton, PasswordForm, ThemePicker } from "@/components/settings/settings-forms";

export const metadata: Metadata = { title: "Cài đặt" };

function Section({ id, title, children, hint }: { id: string; title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section aria-labelledby={id} className="rounded-[1.5rem] border border-line bg-sheet p-5 sm:p-7">
      <h2 id={id} className="font-serif text-xl">
        {title}
      </h2>
      {hint && <p className="mt-1.5 max-w-xl text-sm text-ink-soft">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const session = await requireMember();
  const { t } = await getI18n();
  const theme = await getThemePreference();
  const isOwner = session.profile.role === "owner";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-serif text-3xl">{t.settings.title}</h1>

      <Section id="s-profile" title={t.settings.profile}>
        <DisplayNameForm initial={session.profile.display_name} />
      </Section>

      <Section id="s-prefs" title={t.settings.preferences}>
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium">{t.common.language}</p>
            <LanguageSwitcher />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t.settings.theme}</p>
            <ThemePicker initial={theme} />
          </div>
        </div>
      </Section>

      <Section id="s-password" title={t.settings.password}>
        <PasswordForm />
      </Section>

      {can(session.profile.role, "diary:export") && (
        <Section id="s-export" title={t.settings.export} hint={t.settings.exportHint}>
          <ExportButton />
        </Section>
      )}

      <Section id="s-account" title={t.settings.account}>
        <dl className="mb-5 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-ink-soft">{t.settings.role}</dt>
          <dd>{isOwner ? t.settings.roleOwner : t.settings.roleViewer}</dd>
          {session.email && (
            <>
              <dt className="sr-only">Email</dt>
              <dd className="text-ink-soft sm:col-span-2">{format(t.settings.signedInAs, { email: session.email })}</dd>
            </>
          )}
        </dl>
        <LogoutButton />
      </Section>
    </div>
  );
}
