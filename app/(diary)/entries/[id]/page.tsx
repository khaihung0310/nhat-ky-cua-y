import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { getAttachments, getEntry, signAttachments } from "@/lib/queries";
import { moodEmoji } from "@/lib/moods";
import { can } from "@/lib/permissions";
import { formatDiaryDate, formatVnDateTime, formatVnTime } from "@/lib/time";
import { RichText } from "@/components/entries/rich-text";
import { PhotoGallery } from "@/components/entries/photo-gallery";
import { AudioList, FileList } from "@/components/entries/attachment-lists";
import { DeleteEntryButton } from "@/components/entries/delete-entry-button";

// Titles are private: never put diary content into metadata.
export const metadata: Metadata = { title: "Nhật ký" };

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireMember();
  const { t, locale } = await getI18n();
  const entry = await getEntry(id);
  if (!entry) notFound();

  const attachments = await signAttachments(await getAttachments(entry.id));
  const photos = attachments.filter((a) => a.attachment_type === "image");
  const audio = attachments.filter((a) => a.attachment_type === "audio");
  const files = attachments.filter((a) => a.attachment_type === "document");
  const isOwner = can(session.profile.role, "entry:update");
  const emoji = moodEmoji(entry.mood);
  const edited = new Date(entry.updated_at).getTime() - new Date(entry.created_at).getTime() > 60_000;

  return (
    <article className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/entries" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          {t.common.back}
        </Link>
        {isOwner ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/entries/${entry.id}/edit`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-sheet px-3.5 text-sm hover:bg-paper-deep"
            >
              <Pencil className="size-4" aria-hidden />
              {t.common.edit}
            </Link>
            <DeleteEntryButton entryId={entry.id} />
          </div>
        ) : (
          <span className="rounded-full bg-lavender-soft px-3 py-1 text-xs text-lavender-ink">{t.entry.readOnly}</span>
        )}
      </div>

      {/* 1. Title */}
      <header className="margin-line rounded-t-[1.5rem] border border-b-0 border-line bg-sheet px-6 pb-2 pt-7 sm:px-10">
        <h1 className="font-serif text-[1.9rem] leading-tight sm:text-4xl">{entry.title}</h1>
        {/* 2. Date and mood */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <time dateTime={entry.diary_date} className="text-lavender-ink">
            {formatDiaryDate(entry.diary_date, locale, "long")}
          </time>
          {emoji && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tulip-soft px-2.5 py-0.5 text-tulip-ink">
              <span aria-hidden>{emoji}</span>
              {t.moods[entry.mood as keyof typeof t.moods]}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          {format(t.entry.writtenAt, { time: formatVnTime(entry.created_at, locale) })}
          {edited && <> · {format(t.entry.updatedAt, { time: formatVnDateTime(entry.updated_at, locale) })}</>}
        </p>
      </header>

      {/* 3. Written content */}
      <div className="margin-line rounded-b-[1.5rem] border border-t-0 border-line bg-sheet px-6 pb-8 pt-4 sm:px-10">
        <RichText content={entry.content} className="ruled font-serif text-[1.08rem] text-ink" />
      </div>

      {/* Attachments always come after the text */}
      {photos.length > 0 && (
        <section aria-labelledby="photos" className="mt-10">
          <h2 id="photos" className="mb-3 font-serif text-xl">
            {t.entry.photos}
          </h2>
          <PhotoGallery photos={photos} />
        </section>
      )}
      {audio.length > 0 && (
        <section aria-labelledby="audio" className="mt-10">
          <h2 id="audio" className="mb-3 font-serif text-xl">
            {t.entry.voiceRecordings}
          </h2>
          <AudioList items={audio} t={t} locale={locale} />
        </section>
      )}
      {files.length > 0 && (
        <section aria-labelledby="files" className="mt-10">
          <h2 id="files" className="mb-3 font-serif text-xl">
            {t.entry.files}
          </h2>
          <FileList items={files} t={t} locale={locale} />
        </section>
      )}
    </article>
  );
}
