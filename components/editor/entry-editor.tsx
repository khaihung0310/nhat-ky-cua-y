"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, CloudOff, Italic, List, Loader2, Quote, Save } from "lucide-react";
import { saveEntry, registerAttachment, deleteAttachment } from "@/app/actions/entries";
import { deleteDraftAction, getDraftAction, saveDraftAction } from "@/app/actions/drafts";
import { buildStoragePath, maxBytesFor, validateFile, formatBytes, type UploadLimitsMb } from "@/lib/files";
import { debounce, draftKeyFor, isDraftMeaningful, localDraftStorageKey, parseDraft, pickNewestDraft, type DraftData } from "@/lib/drafts";
import { format } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { isMood, type Mood } from "@/lib/moods";
import { formatVnDateTime } from "@/lib/time";
import { CONTENT_MAX, TITLE_MAX } from "@/lib/validation";
import type { SignedAttachment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { MoodPicker } from "./mood-picker";
import { VoiceRecorder, type Recording } from "./voice-recorder";
import { AttachmentManager, type QueueItem } from "./attachment-manager";
import { compressImage, newObjectId, uploadToStorage, UploadError } from "./upload";

type Initial = { id: string | null; title: string; content: string; mood: Mood | null; diaryDate: string };
type DraftStatus = "idle" | "saving" | "saved" | "local" | "error";

export function EntryEditor({
  userId,
  initial,
  existingAttachments,
  todayVn,
  limits,
  startWithVoice,
}: {
  userId: string;
  initial: Initial;
  existingAttachments: SignedAttachment[];
  todayVn: string;
  limits: UploadLimitsMb;
  startWithVoice?: boolean;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();

  const [entryId, setEntryId] = useState<string | null>(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [mood, setMood] = useState<Mood | null>(initial.mood);
  const [diaryDate, setDiaryDate] = useState(initial.diaryDate);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [draftOffer, setDraftOffer] = useState<DraftData | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [existing, setExisting] = useState(existingAttachments);
  const [toDelete, setToDelete] = useState<SignedAttachment | null>(null);
  const [deletingAttachment, setDeletingAttachment] = useState(false);
  const [showRecorder, setShowRecorder] = useState(Boolean(startWithVoice));

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftKey = draftKeyFor(initial.id);
  const storageKey = localDraftStorageKey(userId, draftKey);
  const draftReady = useRef(false); // don't autosave until we've checked for an existing draft
  const savedRef = useRef(false);

  const baseline = useMemo(
    () => ({ title: initial.title, content: initial.content, mood: initial.mood, diaryDate: initial.diaryDate }),
    [initial.title, initial.content, initial.mood, initial.diaryDate],
  );
  const dirty =
    title !== baseline.title || content !== baseline.content || mood !== baseline.mood || diaryDate !== baseline.diaryDate;
  const pendingFiles = queue.some((q) => q.status !== "done");

  // ---------- Draft restore (newest of device / server) ----------
  const draftChecked = useRef(false);
  useEffect(() => {
    if (draftChecked.current) return; // only once per editor session
    draftChecked.current = true;
    (async () => {
      let local: DraftData | null = null;
      try {
        local = parseDraft(window.localStorage.getItem(storageKey));
      } catch {
        /* storage unavailable */
      }
      let remote: DraftData | null = null;
      try {
        remote = await getDraftAction(draftKey);
      } catch {
        /* offline: rely on the local copy */
      }
      const newest = pickNewestDraft(local, remote);
      if (newest && isDraftMeaningful(newest, baseline)) setDraftOffer(newest);
      draftReady.current = true;
    })();
  }, [draftKey, storageKey, baseline]);

  // ---------- Draft autosave ----------
  const saveRemote = useMemo(
    () =>
      debounce(async (data: Omit<DraftData, "updatedAt">) => {
        if (savedRef.current) return;
        try {
          const res = await saveDraftAction(draftKey, data);
          if (!savedRef.current) setDraftStatus(res.ok ? "saved" : "error");
        } catch {
          if (!savedRef.current) setDraftStatus(navigator.onLine ? "error" : "local");
        }
      }, 2500),
    [draftKey],
  );

  useEffect(() => () => saveRemote.cancel(), [saveRemote]);

  useEffect(() => {
    if (!draftReady.current || draftOffer || savedRef.current) return;
    if (!dirty) return;
    const data = { title, content, mood, diaryDate };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }));
    } catch {
      /* quota / private mode — server copy still works */
    }
    setDraftStatus(navigator.onLine ? "saving" : "local");
    saveRemote(data);
  }, [title, content, mood, diaryDate, dirty, draftOffer, storageKey, saveRemote]);

  // Retry syncing the draft when the connection comes back.
  useEffect(() => {
    const onOnline = () => {
      if (dirty && !savedRef.current) saveRemote({ title, content, mood, diaryDate });
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [dirty, title, content, mood, diaryDate, saveRemote]);

  // Warn before leaving with unsaved writing or files.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // Text already published → only unsent files matter.
      if (pendingFiles || (!savedRef.current && dirty)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, pendingFiles]);

  // Revoke object URLs for previews when items leave the queue.
  const previewUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const clearLocalDraft = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  };

  const restoreDraft = () => {
    if (!draftOffer) return;
    setTitle(draftOffer.title);
    setContent(draftOffer.content);
    setMood(isMood(draftOffer.mood) ? draftOffer.mood : null);
    if (draftOffer.diaryDate) setDiaryDate(draftOffer.diaryDate);
    setDraftOffer(null);
  };
  const discardDraft = () => {
    setDraftOffer(null);
    clearLocalDraft();
    deleteDraftAction(draftKey).catch(() => {});
  };

  // ---------- Formatting toolbar (wraps the selection, IME-safe) ----------
  const wrapSelection = (before: string, after = before, linePrefix = false) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    let next: string;
    let cursorStart: number;
    let cursorEnd: number;
    if (linePrefix) {
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      next = value.slice(0, lineStart) + before + value.slice(lineStart);
      cursorStart = s + before.length;
      cursorEnd = e + before.length;
    } else {
      next = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e);
      cursorStart = s + before.length;
      cursorEnd = e + before.length;
    }
    if (next.length > CONTENT_MAX) return;
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  // ---------- Attachments ----------
  const addToQueue = useCallback(
    (items: { blob: Blob; name: string; mime?: string; durationMs?: number }[]) => {
      const accepted: QueueItem[] = [];
      for (const item of items) {
        const check = validateFile({ name: item.name, size: item.blob.size, type: item.mime ?? item.blob.type }, limits);
        if (!check.ok) {
          const key = check.code;
          toast(
            format(t.attachments.errors[key], { name: item.name, max: check.maxBytes ? formatBytes(check.maxBytes, locale) : "" }),
            "error",
          );
          continue;
        }
        let previewUrl: string | undefined;
        if (check.type === "image" || check.type === "audio") {
          previewUrl = URL.createObjectURL(item.blob);
          previewUrls.current.add(previewUrl);
        }
        accepted.push({
          key: newObjectId(),
          blob: item.blob,
          name: item.name,
          mime: check.mime,
          kind: check.type,
          size: item.blob.size,
          durationMs: item.durationMs,
          previewUrl,
          status: "queued",
          progress: 0,
        });
      }
      if (accepted.length) setQueue((q) => [...q, ...accepted]);
    },
    [limits, locale, t, toast],
  );

  const onKeepRecording = (r: Recording) => addToQueue([{ blob: r.blob, name: r.name, mime: r.mime, durationMs: r.durationMs }]);

  const updateItem = (key: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  /** Upload one item then register it. Only marks "done" after BOTH succeed. */
  const processItem = async (item: QueueItem, id: string): Promise<boolean> => {
    try {
      let path = item.uploadedPath;
      if (!path) {
        let body: Blob = item.blob;
        let mime = item.mime;
        if (item.kind === "image") {
          updateItem(item.key, { status: "compressing", error: undefined });
          const c = await compressImage(new File([item.blob], item.name, { type: item.mime }));
          body = c.blob;
          mime = c.mime;
        }
        path = buildStoragePath(userId, id, newObjectId(), mime);
        updateItem(item.key, { status: "uploading", progress: 0, error: undefined });
        await uploadToStorage(path, body, mime, (p) => updateItem(item.key, { progress: p }));
        updateItem(item.key, { uploadedPath: path, progress: 1 });
      } else {
        updateItem(item.key, { status: "uploading", progress: 1, error: undefined });
      }
      const res = await registerAttachment({ entryId: id, storagePath: path, fileName: item.name, durationMs: item.durationMs ?? null });
      if (!res.ok) {
        // A rejected file was deleted server-side; upload again from scratch on retry.
        updateItem(item.key, { status: "error", error: res.error, uploadedPath: undefined });
        return false;
      }
      updateItem(item.key, { status: "done" });
      return true;
    } catch (err) {
      const kind = err instanceof UploadError ? err.kind : "network";
      const msg =
        kind === "session" ? t.attachments.errors.session : kind === "storage" ? t.attachments.errors.storage : t.attachments.errors.network;
      updateItem(item.key, { status: "error", error: msg });
      return false;
    }
  };

  const uploadAll = async (id: string, items: QueueItem[]) => {
    let allOk = true;
    // Sequential: gentle on mobile connections and free-tier limits.
    for (const item of items) {
      if (item.status === "done") continue;
      const ok = await processItem(item, id);
      allOk &&= ok;
    }
    return allOk;
  };

  const retryItem = async (key: string) => {
    const item = queue.find((q) => q.key === key);
    if (!item || !entryId) return;
    setSaving(true);
    await processItem(item, entryId);
    setSaving(false);
  };

  const removeQueued = (key: string) =>
    setQueue((q) => {
      const item = q.find((i) => i.key === key);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrls.current.delete(item.previewUrl);
      }
      return q.filter((i) => i.key !== key);
    });

  const confirmDeleteExisting = async () => {
    if (!toDelete) return;
    setDeletingAttachment(true);
    const res = await deleteAttachment(toDelete.id).catch(() => ({ ok: false as const, error: t.errors.offline }));
    setDeletingAttachment(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setExisting((list) => list.filter((a) => a.id !== toDelete.id));
    setToDelete(null);
    toast(t.attachments.removed);
  };

  // ---------- Save ----------
  const onSave = async () => {
    setFieldErrors({});
    setSaving(true);
    saveRemote.cancel();
    let res;
    try {
      res = await saveEntry({ id: entryId, title, content, mood, diaryDate });
    } catch {
      setSaving(false);
      toast(t.editor.saveFailed, "error");
      return;
    }
    if (!res.ok) {
      setSaving(false);
      setFieldErrors(res.fieldErrors ?? {});
      toast(res.error, "error");
      return;
    }
    const id = res.data.id;
    setEntryId(id);
    savedRef.current = true;
    clearLocalDraft();
    setDraftStatus("idle");

    const pending = queue.filter((q) => q.status !== "done");
    if (pending.length > 0) {
      const ok = await uploadAll(id, pending);
      if (!ok) {
        setSaving(false);
        // The entry text is saved; stay here (keeping the file queue) so failed
        // files can be retried. Update the URL without remounting the editor.
        toast(t.editor.uploadsPartial, "error");
        if (!initial.id) window.history.replaceState(null, "", `/entries/${id}/edit`);
        return;
      }
    }
    toast(t.editor.saved);
    router.push(`/entries/${id}`);
    router.refresh();
  };

  const titleErr = fieldErrors.title;
  const contentErr = fieldErrors.content;
  const dateErr = fieldErrors.diaryDate;

  return (
    <div className="space-y-8">
      {draftOffer && (
        <div role="status" className="flex flex-col gap-3 rounded-2xl border border-lavender/60 bg-lavender-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-lavender-ink">{format(t.editor.draftFound, { time: formatVnDateTime(draftOffer.updatedAt, locale) })}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={discardDraft}>
              {t.editor.draftDiscard}
            </Button>
            <Button size="sm" variant="soft" onClick={restoreDraft}>
              {t.editor.draftRestore}
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!saving) onSave();
        }}
        className="space-y-6"
        noValidate
      >
        <div className="margin-line space-y-5 rounded-[1.5rem] border border-line bg-sheet p-5 pl-7 sm:p-8 sm:pl-10">
          <div>
            <Label htmlFor="title">{t.editor.titleLabel}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              placeholder={t.editor.titlePlaceholder}
              aria-invalid={Boolean(titleErr)}
              aria-describedby={titleErr ? "title-error" : undefined}
              className="h-auto border-0 bg-transparent px-0 py-1 font-serif text-2xl focus-visible:ring-0 sm:text-3xl"
              autoComplete="off"
              required
            />
            <FieldError id="title-error">{titleErr}</FieldError>
          </div>

          <div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_1fr]">
            <div>
              <Label htmlFor="diary-date">{t.editor.dateLabel}</Label>
              <Input
                id="diary-date"
                type="date"
                value={diaryDate}
                max={todayVn}
                min="1900-01-01"
                onChange={(e) => setDiaryDate(e.target.value)}
                aria-invalid={Boolean(dateErr)}
                aria-describedby={dateErr ? "date-error" : "date-hint"}
                required
              />
              {dateErr ? <FieldError id="date-error">{dateErr}</FieldError> : <FieldHint id="date-hint">{t.editor.dateHint}</FieldHint>}
            </div>
            <div>
              <p id="mood-label" className="mb-1.5 text-sm font-medium">
                {t.editor.moodLabel} <span className="font-normal text-ink-soft">({t.common.optional})</span>
              </p>
              <MoodPicker value={mood} onChange={setMood} labelId="mood-label" />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-end justify-between gap-2">
              <Label htmlFor="content" className="mb-0">
                {t.editor.contentLabel}
              </Label>
              <div className="flex items-center gap-0.5" role="toolbar" aria-label={t.editor.contentLabel} aria-controls="content">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => wrapSelection("**")} aria-label={t.editor.bold} title={t.editor.bold}>
                  <Bold aria-hidden />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => wrapSelection("*")} aria-label={t.editor.italic} title={t.editor.italic}>
                  <Italic aria-hidden />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => wrapSelection("> ", "", true)} aria-label={t.editor.quote} title={t.editor.quote}>
                  <Quote aria-hidden />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => wrapSelection("- ", "", true)} aria-label={t.editor.list} title={t.editor.list}>
                  <List aria-hidden />
                </Button>
              </div>
            </div>
            <Textarea
              id="content"
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={CONTENT_MAX}
              placeholder={t.editor.contentPlaceholder}
              rows={14}
              lang={locale}
              spellCheck
              aria-invalid={Boolean(contentErr)}
              aria-describedby={contentErr ? "content-error" : "content-hint"}
              className="ruled min-h-[20rem] resize-y rounded-none border-0 border-t border-line bg-transparent px-0 py-0 font-serif text-[1.08rem] focus-visible:ring-0"
            />
            {contentErr ? <FieldError id="content-error">{contentErr}</FieldError> : <FieldHint id="content-hint">{t.editor.formattingHelp}</FieldHint>}
          </div>
        </div>

        <section aria-labelledby="attachments-title" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="attachments-title" className="font-serif text-xl">
              {t.attachments.title}
            </h2>
            <p className="text-sm text-ink-soft">{t.attachments.hint}</p>
          </div>
          {showRecorder ? (
            <VoiceRecorder maxBytes={maxBytesFor("audio", limits)} onKeep={onKeepRecording} autoFocus={startWithVoice} />
          ) : (
            <Button variant="soft" onClick={() => setShowRecorder(true)}>
              {t.recorder.title}
            </Button>
          )}
          <AttachmentManager
            limits={limits}
            existing={existing}
            queue={queue}
            onAddFiles={(files) => addToQueue(files.map((f) => ({ blob: f, name: f.name, mime: f.type })))}
            onRemoveQueued={removeQueued}
            onRetry={retryItem}
            onDeleteExisting={setToDelete}
            busy={saving}
          />
        </section>

        <div className="pb-safe sticky bottom-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-full border border-line bg-paper/95 px-4 py-2.5 shadow-soft backdrop-blur md:bottom-4">
          <p className="flex items-center gap-1.5 text-sm text-ink-soft" aria-live="polite">
            {draftStatus === "saving" && (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {t.editor.draftSaving}
              </>
            )}
            {draftStatus === "saved" && t.editor.draftSaved}
            {draftStatus === "local" && (
              <>
                <CloudOff className="size-3.5" aria-hidden />
                {t.editor.draftSavedLocal}
              </>
            )}
            {draftStatus === "error" && t.editor.draftError}
            {saving && pendingFiles && t.editor.uploadsPending}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                if ((pendingFiles || (!savedRef.current && dirty)) && !window.confirm(t.editor.unsavedWarning)) return;
                savedRef.current = true;
                setQueue([]);
                router.push(entryId ? `/entries/${entryId}` : "/");
              }}
              disabled={saving}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              {saving ? t.common.saving : initial.id ? t.editor.update : t.editor.publish}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDeleteExisting}
        title={t.attachments.removeConfirmTitle}
        description={toDelete ? format(t.attachments.removeConfirmBody, { name: toDelete.file_name }) : ""}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        closeLabel={t.common.close}
        pending={deletingAttachment}
        pendingLabel={t.common.deleting}
      />
    </div>
  );
}
