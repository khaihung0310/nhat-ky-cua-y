import Link from "next/link";
import { BookOpen, CalendarDays, Mic, PenLine, Smile } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { getRecentEntries } from "@/lib/queries";
import { dayOfYear, formatDiaryDate, vnDateString } from "@/lib/time";
import { can } from "@/lib/permissions";
import { EntryCard } from "@/components/entries/entry-card";
import { TulipMark } from "@/components/layout/tulip-mark";

export default async function DashboardPage() {
  const session = await requireMember();
  const { t, locale } = await getI18n();
  const entries = await getRecentEntries(6);
  const today = vnDateString();
  const isOwner = can(session.profile.role, "entry:create");
  const message = t.dashboard.messages[dayOfYear(today) % t.dashboard.messages.length];

  const actions = isOwner
    ? [
        { href: "/entries/new", icon: PenLine, label: t.dashboard.writeEntry, hint: t.dashboard.writeEntryHint, tone: "tulip" },
        { href: "/entries/new?voice=1", icon: Mic, label: t.dashboard.recordVoice, hint: t.dashboard.recordVoiceHint, tone: "lavender" },
        { href: "/calendar", icon: CalendarDays, label: t.dashboard.viewCalendar, hint: t.dashboard.viewCalendarHint, tone: "sage" },
        { href: "/entries", icon: BookOpen, label: t.dashboard.browseEntries, hint: t.dashboard.browseEntriesHint, tone: "paper" },
      ]
    : [
        { href: "/entries", icon: BookOpen, label: t.dashboard.browseEntries, hint: t.dashboard.browseEntriesHint, tone: "tulip" },
        { href: "/calendar", icon: CalendarDays, label: t.dashboard.viewCalendar, hint: t.dashboard.viewCalendarHint, tone: "lavender" },
        { href: "/moods", icon: Smile, label: t.dashboard.viewMoods, hint: t.dashboard.viewMoodsHint, tone: "sage" },
      ];

  const toneClass: Record<string, string> = {
    tulip: "bg-tulip-soft text-tulip-ink",
    lavender: "bg-lavender-soft text-lavender-ink",
    sage: "bg-sage-soft text-sage-ink",
    paper: "bg-paper-deep text-ink",
  };

  return (
    <div className="space-y-12">
      <section aria-labelledby="greeting" className="relative pt-2">
        <TulipMark className="absolute -top-2 right-0 hidden size-24 opacity-80 sm:block" />
        <p className="text-sm text-lavender-ink">
          <time dateTime={today}>{formatDiaryDate(today, locale, "long")}</time>
        </p>
        <h1 id="greeting" className="mt-3 max-w-2xl font-serif text-[2rem] leading-[1.2] sm:text-[2.6rem]">
          {isOwner
            ? format(t.dashboard.greetingOwner, { name: session.profile.display_name })
            : format(t.dashboard.greetingViewer, { name: session.profile.display_name })}
        </h1>
        <p className="mt-4 max-w-xl font-serif text-lg italic text-ink-soft">{isOwner ? message : t.dashboard.viewerSubtitle}</p>
      </section>

      <section aria-label={t.dashboard.actions}>
        <ul className={`grid gap-3 ${actions.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
          {actions.map(({ href, icon: Icon, label, hint, tone }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full flex-col gap-3 rounded-[1.25rem] border border-line bg-sheet p-4 transition-colors hover:border-tulip/60 sm:p-5"
              >
                <span className={`flex size-10 items-center justify-center rounded-full ${toneClass[tone]}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-medium leading-snug">{label}</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recent">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="recent" className="font-serif text-2xl">
            {t.dashboard.recentMemories}
          </h2>
          {entries.length > 0 && (
            <Link href="/entries" className="text-sm text-tulip-ink underline-offset-4 hover:underline">
              {t.dashboard.seeAll}
            </Link>
          )}
        </div>
        {entries.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-line px-6 py-10 text-center">
            <p className="font-serif text-lg text-ink-soft">{isOwner ? t.dashboard.emptyOwner : t.dashboard.emptyViewer}</p>
            {isOwner && (
              <Link
                href="/entries/new"
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-tulip-ink px-5 font-medium text-white dark:text-paper"
              >
                <PenLine className="size-4" aria-hidden />
                {t.dashboard.writeEntry}
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => (
              <li key={e.id}>
                <EntryCard entry={e} t={t} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
