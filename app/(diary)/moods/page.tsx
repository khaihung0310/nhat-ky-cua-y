import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { getMoodRange } from "@/lib/queries";
import { groupByDiaryDate } from "@/lib/calendar";
import { countMoods, moodEmoji } from "@/lib/moods";
import { addMonths, formatDiaryDate, formatMonth, isValidMonthString, monthRange, vnMonthString } from "@/lib/time";

export const metadata: Metadata = { title: "Cảm xúc" };

/**
 * A simple, non-judgemental record of the moods that were written down.
 * No scores, no trends, no interpretation.
 */
export default async function MoodsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireMember();
  const params = await searchParams;
  const { t, locale } = await getI18n();
  const current = vnMonthString();
  const month = typeof params.month === "string" && isValidMonthString(params.month) ? params.month : current;
  const { from, to } = monthRange(month);
  const entries = await getMoodRange(from, to);
  const counts = countMoods(entries);
  const max = Math.max(1, ...counts.map((c) => c.count));
  const days = [...groupByDiaryDate(entries.filter((e) => e.mood))].sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <h1 className="font-serif text-3xl">{t.moodHistory.title}</h1>
        <p className="mt-2 max-w-xl text-ink-soft">{t.moodHistory.subtitle}</p>
      </header>

      <div className="flex items-center justify-between gap-2 rounded-full border border-line bg-sheet p-1.5">
        <Link href={`/moods?month=${addMonths(month, -1)}`} aria-label={t.calendar.previousMonth} className="flex size-9 items-center justify-center rounded-full hover:bg-paper-deep">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <p className="font-serif text-lg first-letter:uppercase" aria-live="polite">
          {formatMonth(month, locale)}
        </p>
        {month < current ? (
          <Link href={`/moods?month=${addMonths(month, 1)}`} aria-label={t.calendar.nextMonth} className="flex size-9 items-center justify-center rounded-full hover:bg-paper-deep">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        ) : (
          <span className="size-9" />
        )}
      </div>

      <section aria-labelledby="month-moods">
        <h2 id="month-moods" className="mb-4 font-serif text-xl">
          {t.moodHistory.thisMonth}
        </h2>
        {counts.length === 0 ? (
          <p className="rounded-[1.25rem] border border-dashed border-line px-6 py-8 text-center text-ink-soft">{t.moodHistory.empty}</p>
        ) : (
          <ul className="space-y-3">
            {counts.map((c) => (
              <li key={c.key} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <span aria-hidden className="text-lg">
                    {c.emoji}
                  </span>
                  {t.moods[c.key]}
                </span>
                <span className="h-3 overflow-hidden rounded-full bg-paper-deep" aria-hidden>
                  <span className="block h-full rounded-full bg-lavender" style={{ width: `${(c.count / max) * 100}%` }} />
                </span>
                <span className="text-sm tabular-nums text-ink-soft">{format(t.moodHistory.entries, { count: c.count })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {days.length > 0 && (
        <section aria-labelledby="timeline">
          <h2 id="timeline" className="mb-4 font-serif text-xl">
            {t.moodHistory.timeline}
          </h2>
          <ol className="space-y-2">
            {days.map(([date, list]) => (
              <li key={date} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-sheet px-4 py-3">
                <time dateTime={date} className="w-40 shrink-0 text-sm text-lavender-ink">
                  {formatDiaryDate(date, locale, "medium")}
                </time>
                <ul className="flex flex-wrap gap-2">
                  {list.map((e) => (
                    <li key={e.id}>
                      <Link href={`/entries/${e.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-paper-deep px-3 py-1 text-sm hover:bg-tulip-soft">
                        <span aria-hidden>{moodEmoji(e.mood)}</span>
                        <span className="sr-only">{t.moods[e.mood as keyof typeof t.moods]}: </span>
                        <span className="max-w-[12rem] truncate">{e.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
