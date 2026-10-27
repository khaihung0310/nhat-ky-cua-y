"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { format } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import type { SignedAttachment } from "@/lib/types";

/**
 * Thumbnail grid + full-screen viewer (native <dialog>, keyboard and swipe).
 * Images are private files served through short-lived signed URLs, so plain
 * <img> is used (Next image optimisation would need public URLs).
 */
export function PhotoGallery({ photos }: { photos: SignedAttachment[] }) {
  const { t } = useI18n();
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);

  const visible = photos.filter((p) => p.url);
  const open = index !== null;

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const go = useCallback(
    (delta: number) => setIndex((i) => (i === null ? i : (i + delta + visible.length) % visible.length)),
    [visible.length],
  );

  if (visible.length === 0) return null;
  const current = index !== null ? visible[index] : null;

  return (
    <>
      <ul className={`grid gap-2 ${visible.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
        {visible.map((p, i) => (
          <li key={p.id} className={visible.length === 1 ? "" : i === 0 && visible.length % 2 === 1 ? "col-span-2 sm:col-span-1" : ""}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={format(t.entry.openPhoto, { name: p.file_name })}
              className="block w-full overflow-hidden rounded-2xl border border-line bg-paper-deep"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url!}
                alt={p.file_name}
                loading="lazy"
                decoding="async"
                className={`w-full object-cover transition-transform duration-300 hover:scale-[1.02] ${visible.length === 1 ? "max-h-[32rem]" : "aspect-square"}`}
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label={t.entry.photoViewer}
        onClose={() => setIndex(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          if (start != null && end != null && Math.abs(end - start) > 50) go(end < start ? 1 : -1);
          touchX.current = null;
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 text-white backdrop:bg-black/80"
      >
        {current && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 p-3">
              <p className="truncate px-2 text-sm text-white/80">
                {index! + 1} / {visible.length} · {current.file_name}
              </p>
              <div className="flex items-center gap-1">
                {current.downloadUrl && (
                  <a href={current.downloadUrl} className="flex size-10 items-center justify-center rounded-full hover:bg-white/10" aria-label={t.common.download}>
                    <Download className="size-5" aria-hidden />
                  </a>
                )}
                <button type="button" onClick={() => setIndex(null)} className="flex size-10 items-center justify-center rounded-full hover:bg-white/10" aria-label={t.common.close} autoFocus>
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            </div>
            <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.url!} alt={current.file_name} className="max-h-full max-w-full rounded-lg object-contain" />
              {visible.length > 1 && (
                <>
                  <button type="button" onClick={() => go(-1)} aria-label={t.entry.previousPhoto} className="absolute left-2 flex size-11 items-center justify-center rounded-full bg-black/40 hover:bg-black/60">
                    <ChevronLeft className="size-6" aria-hidden />
                  </button>
                  <button type="button" onClick={() => go(1)} aria-label={t.entry.nextPhoto} className="absolute right-2 flex size-11 items-center justify-center rounded-full bg-black/40 hover:bg-black/60">
                    <ChevronRight className="size-6" aria-hidden />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
