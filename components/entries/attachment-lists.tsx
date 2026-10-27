import { Download, FileText, Mic } from "lucide-react";
import { formatDuration } from "@/lib/audio";
import { fileKindLabel, formatBytes } from "@/lib/files";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { SignedAttachment } from "@/lib/types";

export function AudioList({ items, t, locale }: { items: SignedAttachment[]; t: Dictionary; locale: Locale }) {
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="rounded-2xl border border-line bg-sheet p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Mic className="size-4 shrink-0 text-lavender-ink" aria-hidden />
              <span className="truncate">{a.file_name}</span>
            </span>
            <span className="shrink-0 text-ink-soft">
              {a.duration_ms ? formatDuration(a.duration_ms) : formatBytes(a.file_size, locale)}
            </span>
          </div>
          {a.url ? (
            // preload="none": nothing is downloaded until play is pressed
            <audio controls preload="none" src={a.url} className="w-full" aria-label={a.file_name}>
              <a href={a.downloadUrl ?? a.url}>{t.common.download}</a>
            </audio>
          ) : null}
          {a.downloadUrl && (
            <a href={a.downloadUrl} className="mt-2 inline-flex items-center gap-1.5 text-sm text-tulip-ink underline-offset-4 hover:underline">
              <Download className="size-3.5" aria-hidden />
              {t.common.download}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export function FileList({ items, t, locale }: { items: SignedAttachment[]; t: Dictionary; locale: Locale }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-sheet">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sage-soft text-sage-ink">
            <FileText className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{a.file_name}</span>
            <span className="block text-sm text-ink-soft">
              {fileKindLabel(a.file_name, a.mime_type)} · {formatBytes(a.file_size, locale)}
            </span>
          </span>
          {a.downloadUrl && (
            <a
              href={a.downloadUrl}
              rel="noopener noreferrer"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm hover:bg-paper-deep"
            >
              <Download className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">{t.common.download}</span>
              <span className="sr-only">{a.file_name}</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
