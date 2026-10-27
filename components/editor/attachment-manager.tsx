"use client";

import { useRef, useState, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, FileText, Image as ImageIcon, Loader2, Mic, Paperclip, RotateCw, Trash2, UploadCloud, X } from "lucide-react";
import { acceptAttribute, formatBytes, type UploadLimitsMb } from "@/lib/files";
import { formatDuration } from "@/lib/audio";
import { format } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import type { SignedAttachment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QueueItem = {
  key: string;
  blob: Blob;
  name: string;
  mime: string;
  kind: "image" | "audio" | "document";
  size: number;
  durationMs?: number;
  previewUrl?: string;
  status: "queued" | "compressing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  /** Storage path once uploaded (lets a failed registration be retried without re-uploading). */
  uploadedPath?: string;
};

const kindIcon = { image: ImageIcon, audio: Mic, document: FileText } as const;

export function AttachmentManager({
  limits,
  existing,
  queue,
  onAddFiles,
  onRemoveQueued,
  onRetry,
  onDeleteExisting,
  busy,
}: {
  limits: UploadLimitsMb;
  existing: SignedAttachment[];
  queue: QueueItem[];
  onAddFiles: (files: File[]) => void;
  onRemoveQueued: (key: string) => void;
  onRetry: (key: string) => void;
  onDeleteExisting: (a: SignedAttachment) => void;
  busy: boolean;
}) {
  const { t, locale } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) onAddFiles(files);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-[1.25rem] border-2 border-dashed px-4 py-7 text-center transition-colors",
          dragging ? "border-tulip-ink bg-tulip-soft/60" : "border-line bg-sheet",
        )}
      >
        <UploadCloud className="size-7 text-tulip-ink" aria-hidden />
        <p className="font-medium">{t.attachments.dropHere}</p>
        <p className="text-sm text-ink-soft">{t.attachments.or}</p>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Paperclip aria-hidden />
          {t.attachments.choose}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptAttribute()}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onAddFiles(files);
            e.target.value = "";
          }}
        />
        <p className="max-w-md text-xs text-ink-soft">{format(t.attachments.allowed, { image: limits.image, audio: limits.audio, document: limits.document })}</p>
      </div>

      {queue.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {queue.map((q) => {
            const Icon = kindIcon[q.kind];
            return (
              <li key={q.key} className="flex items-center gap-3 rounded-2xl border border-line bg-sheet p-3">
                {q.kind === "image" && q.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.previewUrl} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-paper-deep text-ink-soft">
                    <Icon className="size-5" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{q.name}</p>
                  <p className="text-xs text-ink-soft">
                    {q.durationMs ? `${formatDuration(q.durationMs)} · ` : ""}
                    {formatBytes(q.size, locale)} ·{" "}
                    <span className={cn(q.status === "error" && "text-danger", q.status === "done" && "text-sage-ink")}>
                      {q.status === "queued" && t.attachments.queued}
                      {q.status === "compressing" && t.attachments.compressing}
                      {q.status === "uploading" && format(t.attachments.uploading, { percent: Math.round(q.progress * 100) })}
                      {q.status === "done" && t.attachments.uploaded}
                      {q.status === "error" && (q.error ?? t.attachments.failed)}
                    </span>
                  </p>
                  {q.status === "uploading" && (
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-deep"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(q.progress * 100)}
                      aria-label={q.name}
                    >
                      <div className="h-full rounded-full bg-tulip-ink transition-[width]" style={{ width: `${Math.round(q.progress * 100)}%` }} />
                    </div>
                  )}
                  {q.kind === "audio" && q.previewUrl && q.status !== "uploading" && (
                    <audio controls src={q.previewUrl} preload="metadata" className="mt-2 h-9 w-full" aria-label={q.name} />
                  )}
                </div>
                {q.status === "uploading" || q.status === "compressing" ? (
                  <Loader2 className="size-5 shrink-0 animate-spin text-ink-soft" aria-hidden />
                ) : q.status === "done" ? (
                  <CheckCircle2 className="size-5 shrink-0 text-sage-ink" aria-hidden />
                ) : (
                  <div className="flex shrink-0 items-center">
                    {q.status === "error" && (
                      <>
                        <AlertCircle className="mr-1 size-4 text-danger" aria-hidden />
                        <Button variant="ghost" size="icon" onClick={() => onRetry(q.key)} aria-label={`${t.common.retry}: ${q.name}`} disabled={busy}>
                          <RotateCw aria-hidden />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onRemoveQueued(q.key)} aria-label={`${t.common.remove}: ${q.name}`} disabled={busy}>
                      <X aria-hidden />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {existing.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-ink-soft">{t.attachments.existing}</h3>
          <ul className="space-y-2">
            {existing.map((a) => {
              const Icon = kindIcon[a.attachment_type];
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-line bg-sheet p-3">
                  {a.attachment_type === "image" && a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" className="size-12 shrink-0 rounded-xl object-cover" loading="lazy" />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-paper-deep text-ink-soft">
                      <Icon className="size-5" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.file_name}</p>
                    <p className="text-xs text-ink-soft">{formatBytes(a.file_size, locale)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteExisting(a)}
                    aria-label={`${t.common.remove}: ${a.file_name}`}
                    className="text-danger hover:bg-danger-soft hover:text-danger"
                    disabled={busy}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
