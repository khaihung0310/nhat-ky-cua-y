import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { getMonthEntries } from "@/lib/queries";
import { buildMonthGrid, groupByDiaryDate, weekdayLabels } from "@/lib/calendar";
import { moodEmoji } from "@/lib/moods";
import { can } from "@/lib/permissions";
import { addMonths, formatDiaryDate, formatWeekday, formatMonth, isValidDateString, isValidMonthString, vnDateString } from "@/lib/time";
import { MonthGrid } from "@/components/calendar/month-grid";
import { EntryCard } from "@/components/entries/entry-card";

export const metadata: Metadata = { title: "Lịch" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireMember();
  const params = await searchParams;
  const { t, locale } = await getI18n();
  const today = vnDateString(); // Vietnamese date, never the browser's

  const dateParam = typeof params.date === "string" && isValidDateString(params.date) ? params.date : null;
  const month =
    typeof params.month === "string" && isValidMonthString(params.month) ? params.month : (dateParam ?? today).slice(0, 7);
  const selected = dateParam && dateParam.startsWith(month) ? dateParam : month === today.slice(0, 7) ? today : null;
  const direction = typeof params.dir === "string" && params.dir === "-1" ? -1 : 1;

  const entries = await getMonthEntries(month);
  const byDate = groupByDiaryDate(entries);
  const counts: Record<string, number> = {};
  const moods: Record<string, string> = {};
  for (const [date, list] of byDate) {
    counts[date] = list.length;
    const last = [...list].reverse().find((e) => e.mood);
    const emoji = moodEmoji(last?.mood);
    if (emoji) moods[date] = emoji;
  }
  const dayEntries = selected ? (byDate.get(selected) ?? []) : [];
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <section aria-labelledby="cal-title" className="rounded-[1.5rem] border border-line bg-sheet p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href={`/calendar?month=${prev}&dir=-1`} scroll={false} aria-label={t.calendar.previousMonth} className="flex size-10 items-center justify-center rounded-full hover:bg-paper-deep">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h1 id="cal-title" className="font-serif text-xl first-letter:uppercase" aria-live="polite">
            {formatMonth(month, locale)}
          </h1>
          <Link href={`/calendar?month=${next}&dir=1`} scroll={false} aria-label={t.calendar.nextMonth} className="flex size-10 items-center justify-center rounded-full hover:bg-paper-deep">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>
        <MonthGrid
          month={month}
          monthLabel={formatMonth(month, locale)}
          direction={direction}
          weeks={buildMonthGrid(month)}
          weekdays={weekdayLabels(locale)}
          counts={counts}
          moods={moods}
          selected={selected}
          today={today}
        />
        <div className="mt-3 flex justify-center">
          <Link href={`/calendar?month=${today.slice(0, 7)}&date=${today}`} scroll={false} className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-paper-deep">
            {t.calendar.jumpToday}
          </Link>
        </div>
      </section>

      <section aria-labelledby="day-title" aria-live="polite">
        {selected ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="day-title" className="font-serif text-2xl">
                {/* Weekday, then the date kept on one line ("27 tháng 10, 2026" never splits). */}
                <span className="sr-only">{format(t.calendar.entriesOn, { date: "" })}</span>
                <span className="block text-base font-sans text-lavender-ink first-letter:uppercase">{formatWeekday(selected, locale)}</span>
                <span className="keep">{formatDiaryDate(selected, locale, "medium")}</span>
              </h2>
              {can(session.profile.role, "entry:create") && selected <= today && (
                <Link href={`/entries/new?date=${selected}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-tulip-soft px-3.5 text-sm text-tulip-ink">
                  <PenLine className="size-4" aria-hidden />
                  {t.calendar.writeForDay}
                </Link>
              )}
            </div>
            {dayEntries.length === 0 ? (
              <p className="rounded-[1.25rem] border border-dashed border-line px-6 py-10 text-center text-ink-soft">{t.calendar.noEntries}</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {dayEntries.map((e) => (
                  <li key={e.id}>
                    <EntryCard entry={e} t={t} locale={locale} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p id="day-title" className="text-ink-soft">
            {t.calendar.selectDay}
          </p>
        )}
      </section>
    </div>
  );
}
