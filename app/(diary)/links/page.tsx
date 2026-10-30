import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getSavedLinks } from "@/lib/queries";
import { can } from "@/lib/permissions";
import { LinksBoard } from "@/components/links/links-board";

export const metadata: Metadata = { title: "Liên kết" };

export default async function LinksPage() {
  const session = await requireMember();
  const { t } = await getI18n();
  const links = await getSavedLinks();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="font-serif text-3xl">{t.links.title}</h1>
        <p className="mt-2 max-w-xl text-ink-soft">{t.links.subtitle}</p>
      </header>
      <LinksBoard initialLinks={links} canManage={can(session.profile.role, "link:manage")} />
    </div>
  );
}
