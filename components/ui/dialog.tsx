"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Accessible modal built on the native <dialog> element: focus trapping,
 * Escape-to-close and inert background come from the browser.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  closeLabel,
  hideTitle,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  closeLabel: string;
  hideTitle?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // click on the backdrop closes
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,28rem)] rounded-[1.5rem] border border-line bg-sheet p-0 text-ink shadow-soft",
        className,
      )}
    >
      {open && (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className={cn("font-serif text-xl leading-snug", hideTitle && "sr-only")}>
              {title}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label={closeLabel} className="-mr-2 -mt-2 shrink-0">
              <X />
            </Button>
          </div>
          {description && (
            <div id={descId} className="mt-2 text-ink-soft">
              {description}
            </div>
          )}
          {children && <div className="mt-5">{children}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  pending,
  pendingLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  pending?: boolean;
  pendingLabel?: string;
}) {
  return (
    <Dialog open={open} onClose={pending ? () => {} : onClose} title={title} description={description} closeLabel={closeLabel}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending} aria-busy={pending}>
          {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
