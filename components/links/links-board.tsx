"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, ExternalLink, Link2, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deleteLink, saveLink } from "@/app/actions/links";
import { format } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { LINK_NOTE_MAX, LINK_TITLE_MAX, linkHost, linkMatches } from "@/lib/links";
import { formatDiaryDate, formatVnDateTime, formatVnTime, vnDateString } from "@/lib/time";
import type { SavedLink } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FieldError, Input, Label, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

type FormValues = { url: string; title: string; note: string };
const EMPTY: FormValues = { url: "", title: "", note: "" };

/** Add / edit form, used for the "new link" card and inline editing. */
function LinkForm({
  initial,
  submitLabel,
  idPrefix,
  onSaved,
  onCancel,
  linkId,
}: {
  initial: FormValues;
  submitLabel: string;
  idPrefix: string;
  onSaved: (link: SavedLink) => void;
  onCancel?: () => void;
  linkId?: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = () =>
    start(async () => {
      const res = await saveLink({ id: linkId ?? null, ...values }).catch(() => ({ ok: false as const, error: t.errors.offline }));
      if (!res.ok) {
        setErrors("fieldErrors" in res && res.fieldErrors ? res.fieldErrors : {});
        toast(res.error, "error");
        return;
      }
      setErrors({});
      onSaved(res.data);
      if (!linkId) setValues(EMPTY);
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) submit();
      }}
      className="space-y-4"
      noValidate
    >
      <div>
        <Label htmlFor={`${idPrefix}-url`}>{t.links.url}</Label>
        <Input
          id={`${idPrefix}-url`}
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={values.url}
          onChange={set("url")}
          placeholder={t.links.urlPlaceholder}
          aria-invalid={Boolean(errors.url)}
          aria-describedby={errors.url ? `${idPrefix}-url-error` : undefined}
        />
        <FieldError id={`${idPrefix}-url-error`}>{errors.url}</FieldError>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-title`}>
          {t.links.name} <span className="font-normal text-ink-soft">({t.common.optional})</span>
        </Label>
        <Input
          id={`${idPrefix}-title`}
          value={values.title}
          onChange={set("title")}
          maxLength={LINK_TITLE_MAX}
          placeholder={t.links.namePlaceholder}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${idPrefix}-title-error` : undefined}
        />
        <FieldError id={`${idPrefix}-title-error`}>{errors.title}</FieldError>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-note`}>
          {t.links.note} <span className="font-normal text-ink-soft">({t.common.optional})</span>
        </Label>
        <Textarea
          id={`${idPrefix}-note`}
          rows={3}
          value={values.note}
          onChange={set("note")}
          maxLength={LINK_NOTE_MAX}
          placeholder={t.links.notePlaceholder}
          className="resize-y"
          aria-invalid={Boolean(errors.note)}
          aria-describedby={errors.note ? `${idPrefix}-note-error` : undefined}
        />
        <FieldError id={`${idPrefix}-note-error`}>{errors.note}</FieldError>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            {t.common.cancel}
          </Button>
        )}
        <Button type="submit" disabled={pending || !values.url.trim()} aria-busy={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : linkId ? null : <Plus aria-hidden />}
          {pending ? t.common.saving : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function LinksBoard({ initialLinks, canManage }: { initialLinks: SavedLink[]; canManage: boolean }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [links, setLinks] = useState(initialLinks);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SavedLink | null>(null);
  const [deleting, startDelete] = useTransition();

  const visible = useMemo(() => links.filter((l) => linkMatches(l, query)), [links, query]);

  // Group by the Vietnamese date the link was saved.
  const groups = useMemo(() => {
    const map = new Map<string, SavedLink[]>();
    for (const l of visible) {
      const day = vnDateString(l.created_at);
      const list = map.get(day);
      if (list) list.push(l);
      else map.set(day, [l]);
    }
    return [...map.entries()];
  }, [visible]);

  const nameOf = (l: SavedLink) => l.title || linkHost(l.url);

  const confirmDelete = () =>
    startDelete(async () => {
      if (!toDelete) return;
      const res = await deleteLink(toDelete.id).catch(() => ({ ok: false as const, error: t.errors.offline }));
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      setLinks((ls) => ls.filter((l) => l.id !== toDelete.id));
      setToDelete(null);
      toast(t.links.deleted);
    });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t.links.copied, "info");
    } catch {
      /* clipboard blocked — the link itself is still visible */
    }
  };

  return (
    <div className="space-y-8">
      {canManage && (
        <section aria-labelledby="add-link" className="margin-line rounded-[1.5rem] border border-line bg-sheet p-5 pl-7 sm:p-7 sm:pl-9">
          <h2 id="add-link" className="mb-4 flex items-center gap-2 font-serif text-xl">
            <Link2 className="size-5 text-tulip-ink" aria-hidden />
            {t.links.addTitle}
          </h2>
          <LinkForm
            idPrefix="new"
            initial={EMPTY}
            submitLabel={t.links.save}
            onSaved={(link) => {
              setLinks((ls) => [link, ...ls]);
              toast(t.links.saved);
            }}
          />
        </section>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <label htmlFor="link-filter" className="sr-only">
              {t.links.filter}
            </label>
            <input
              id="link-filter"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.links.filter}
              className="h-11 w-full rounded-full border border-line bg-sheet pl-11 pr-4 text-ink placeholder:text-ink-soft/70 focus-visible:border-tulip-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <p className="text-sm text-ink-soft" aria-live="polite">
            {format(t.links.count, { count: visible.length })}
          </p>
        </div>
      )}

      {links.length === 0 ? (
        <p className="rounded-[1.25rem] border border-dashed border-line px-6 py-10 text-center font-serif text-lg text-ink-soft">
          {canManage ? t.links.emptyOwner : t.links.emptyViewer}
        </p>
      ) : visible.length === 0 ? (
        <p className="text-center text-ink-soft">{t.links.noMatches}</p>
      ) : (
        <div className="space-y-8">
          {groups.map(([day, items]) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h2 id={`day-${day}`} className="mb-3 text-sm text-lavender-ink">
                <time dateTime={day}>{formatDiaryDate(day, locale, "long")}</time>
              </h2>
              <ul className="space-y-3">
                {items.map((l) => {
                  const edited = new Date(l.updated_at).getTime() - new Date(l.created_at).getTime() > 60_000;
                  return (
                    <li key={l.id} className="rounded-[1.25rem] border border-line bg-sheet p-4 sm:p-5">
                      {editingId === l.id ? (
                        <LinkForm
                          idPrefix={`edit-${l.id}`}
                          linkId={l.id}
                          initial={{ url: l.url, title: l.title, note: l.note }}
                          submitLabel={t.links.update}
                          onCancel={() => setEditingId(null)}
                          onSaved={(saved) => {
                            setLinks((ls) => ls.map((x) => (x.id === saved.id ? saved : x)));
                            setEditingId(null);
                            toast(t.links.updated);
                          }}
                        />
                      ) : (
                        <article>
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-lavender-soft text-lavender-ink">
                              <Link2 className="size-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-serif text-lg leading-snug">
                                <a
                                  href={l.url}
                                  target="_blank"
                                  rel="noopener noreferrer nofollow"
                                  referrerPolicy="no-referrer"
                                  className="break-words underline decoration-tulip/50 underline-offset-4 hover:decoration-tulip-ink"
                                  aria-label={format(t.links.open, { name: nameOf(l) })}
                                >
                                  {nameOf(l)}
                                </a>
                              </h3>
                              <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-soft">
                                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                                <span className="truncate">{l.title ? linkHost(l.url) : l.url.replace(/^https?:\/\//, "")}</span>
                              </p>
                            </div>
                          </div>
                          {l.note && <p className="mt-3 whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-ink">{l.note}</p>}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-ink-soft">
                              <span className="keep">{format(t.links.savedAt, { time: formatVnTime(l.created_at, locale) })}</span>
                              {edited && (
                                <>
                                  {" · "}
                                  <span className="keep">{format(t.links.editedAt, { time: formatVnDateTime(l.updated_at, locale) })}</span>
                                </>
                              )}
                            </p>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="size-9" onClick={() => copy(l.url)} aria-label={t.links.copy} title={t.links.copy}>
                                <Copy aria-hidden />
                              </Button>
                              {canManage && (
                                <>
                                  <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditingId(l.id)} aria-label={`${t.common.edit}: ${nameOf(l)}`} title={t.common.edit}>
                                    <Pencil aria-hidden />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-9 text-danger hover:bg-danger-soft hover:text-danger"
                                    onClick={() => setToDelete(l)}
                                    aria-label={`${t.common.delete}: ${nameOf(l)}`}
                                    title={t.common.delete}
                                  >
                                    <Trash2 aria-hidden />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </article>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title={t.links.deleteTitle}
        description={toDelete ? format(t.links.deleteBody, { name: nameOf(toDelete) }) : ""}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        closeLabel={t.common.close}
        pending={deleting}
        pendingLabel={t.common.deleting}
      />
    </div>
  );
}
