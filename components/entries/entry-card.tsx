import Link from "next/link";
import { FileText, Image as ImageIcon, Mic } from "lucide-react";
import { format, type Dictionary, type Locale } from "@/lib/i18n";
import { preview } from "@/lib/markdown";
import { moodEmoji } from "@/lib/moods";
import { formatDiaryDate } from "@/lib/time";
import type { EntryListItem } from "@/lib/types";

/** A diary page in a list: date in lavender, serif title, a short preview. */
export function EntryCard({ entry, t, locale }: { entry: EntryListItem; t: Dictionary; locale: Locale }) {
  const counts = { image: 0, audio: 0, document: 0 };
  for (const a of entry.diary_attachments ?? []) counts[a.attachment_type] += 1;
  const emoji = moodEmoji(entry.mood);
  const text = preview(entry.content, 150);

  return (
    <article className="group relative h-full">
      <Link
        href={`/entries/${entry.id}`}
        className="margin-line flex h-full flex-col rounded-[1.25rem] border border-line bg-sheet py-5 pl-6 pr-5 transition-colors hover:border-tulip/60 hover:bg-sheet/80"
      >
        <div className="flex items-center justify-between gap-3">
          <time dateTime={entry.diary_date} className="text-sm text-lavender-ink">
            {formatDiaryDate(entry.diary_date, locale, "medium")}
          </time>
          {emoji && (
            <span className="text-lg" role="img" aria-label={t.moods[entry.mood as keyof typeof t.moods]}>
              {emoji}
            </span>
          )}
        </div>
        <h3 className="mt-2 font-serif text-xl leading-snug text-ink">{entry.title || t.common.noTitle}</h3>
        {text && <p className="mt-2 line-clamp-3 text-[0.95rem] leading-relaxed text-ink-soft">{text}</p>}
        {(counts.image > 0 || counts.audio > 0 || counts.document > 0) && (
          <ul className="mt-auto flex flex-wrap gap-3 pt-4 text-xs text-ink-soft">
            {counts.image > 0 && (
              <li className="flex items-center gap-1">
                <ImageIcon className="size-3.5" aria-hidden />
                {format(t.entry.photoCount, { count: counts.image })}
              </li>
            )}
            {counts.audio > 0 && (
              <li className="flex items-center gap-1">
                <Mic className="size-3.5" aria-hidden />
                {format(t.entry.audioCount, { count: counts.audio })}
              </li>
            )}
            {counts.document > 0 && (
              <li className="flex items-center gap-1">
                <FileText className="size-3.5" aria-hidden />
                {format(t.entry.fileCount, { count: counts.document })}
              </li>
            )}
          </ul>
        )}
      </Link>
    </article>
  );
}
