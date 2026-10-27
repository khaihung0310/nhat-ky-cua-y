/**
 * Draft logic (pure). Drafts are stored separately from published entries:
 *   - immediately in localStorage (survives refresh / offline)
 *   - debounced in the diary_drafts table (survives device changes)
 * A draft NEVER overwrites a published entry; it is only applied to the editor
 * when the user chooses to restore it.
 */

export type DraftData = {
  title: string;
  content: string;
  mood: string | null;
  diaryDate: string | null;
  updatedAt: string; // ISO timestamp
};

export function draftKeyFor(entryId: string | null | undefined): string {
  return entryId ? entryId : "new";
}

export function localDraftStorageKey(userId: string, draftKey: string): string {
  return `nhatky:draft:${userId}:${draftKey}`;
}

/** Pick the most recently updated draft (local vs. server). */
export function pickNewestDraft(a: DraftData | null, b: DraftData | null): DraftData | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;
}

/** True when the draft differs from what is already published / empty form. */
export function isDraftMeaningful(
  draft: Pick<DraftData, "title" | "content" | "mood" | "diaryDate"> | null,
  baseline: { title: string; content: string; mood: string | null; diaryDate: string | null },
): boolean {
  if (!draft) return false;
  const norm = (s: string | null) => (s ?? "").trim();
  if (!norm(draft.title) && !norm(draft.content)) return false;
  return (
    norm(draft.title) !== norm(baseline.title) ||
    norm(draft.content) !== norm(baseline.content) ||
    (draft.mood ?? null) !== (baseline.mood ?? null) ||
    (draft.diaryDate ?? null) !== (baseline.diaryDate ?? null)
  );
}

export function parseDraft(json: string | null): DraftData | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Partial<DraftData>;
    if (typeof v !== "object" || v === null) return null;
    if (typeof v.title !== "string" || typeof v.content !== "string" || typeof v.updatedAt !== "string") return null;
    if (Number.isNaN(Date.parse(v.updatedAt))) return null;
    return {
      title: v.title,
      content: v.content,
      mood: typeof v.mood === "string" ? v.mood : null,
      diaryDate: typeof v.diaryDate === "string" ? v.diaryDate : null,
      updatedAt: v.updatedAt,
    };
  } catch {
    return null;
  }
}

/** Minimal debounce with flush/cancel (used by the editor). */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;
  const run = () => {
    timer = null;
    if (pending) {
      const args = pending;
      pending = null;
      fn(...args);
    }
  };
  const debounced = (...args: A) => {
    pending = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, waitMs);
  };
  debounced.flush = () => {
    if (timer) clearTimeout(timer);
    run();
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return debounced;
}
