"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CalendarDay } from "@/lib/calendar";
import { format } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { formatDiaryDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export function MonthGrid({
  month,
  direction,
  weeks,
  weekdays,
  counts,
  moods,
  selected,
  today,
  monthLabel,
}: {
  monthLabel: string;
  month: string;
  direction: number;
  weeks: CalendarDay[][];
  weekdays: string[];
  counts: Record<string, number>;
  moods: Record<string, string>;
  selected: string | null;
  today: string;
}) {
  const { t, locale } = useI18n();
  const reduce = useReducedMotion();

  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-7 pb-2 text-center text-xs text-ink-soft" aria-hidden>
        {weekdays.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.table
          key={month}
          aria-label={monthLabel}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.18 }}
          className="w-full table-fixed border-separate border-spacing-1"
        >
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]!.date}>
                {week.map((d) => {
                  const count = counts[d.date] ?? 0;
                  const isSel = selected === d.date;
                  const isToday = today === d.date;
                  const label = `${formatDiaryDate(d.date, locale, "long")}${count ? `, ${format(t.calendar.hasEntries, { count })}` : ""}`;
                  return (
                    <td key={d.date} className="p-0">
                      <Link
                        href={`/calendar?month=${d.date.slice(0, 7)}&date=${d.date}`}
                        scroll={false}
                        aria-label={label}
                        aria-current={isToday ? "date" : undefined}
                        className={cn(
                          "relative flex aspect-square flex-col items-center justify-center rounded-2xl text-sm transition-colors sm:text-base",
                          !d.inMonth && "text-ink-soft/45",
                          d.inMonth && !isSel && "hover:bg-paper-deep",
                          isSel && "bg-tulip-ink font-semibold text-white dark:text-paper",
                          isToday && !isSel && "ring-1 ring-tulip-ink ring-inset",
                          count > 0 && !isSel && "bg-tulip-soft/70",
                        )}
                      >
                        <span>{d.day}</span>
                        {count > 0 && (
                          <span className="absolute bottom-1 text-[0.7rem] leading-none sm:bottom-1.5" aria-hidden>
                            {moods[d.date] ?? (
                              <span className={cn("inline-block size-1.5 rounded-full", isSel ? "bg-white" : "bg-tulip-ink")} />
                            )}
                          </span>
                        )}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </motion.table>
      </AnimatePresence>
    </div>
  );
}
