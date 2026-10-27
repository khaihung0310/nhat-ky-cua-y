import type { Metadata } from "next";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { parseSearchParams, searchEntries } from "@/lib/queries";
import { MOODS } from "@/lib/moods";
import { EntryCard } from "@/components/entries/entry-card";

export const metadata: Metadata = { title: "Nhật ký" };

export default async function EntriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireMember();
  const { t, locale } = await getI18n();
  const filters = parseSearchParams(await searchParams);
  const { items, hasMore } = await searchEntries(filters);
  const filtering = Boolean(filters.q || filters.mood || filters.from || filters.to || filters.withAttachments);

  const pageHref = (page: number) => {
    const sp = new URLSearchParams();
    if (filters.q) sp.set("q", filters.q);
    if (filters.mood) sp.set("mood", filters.mood);
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
    if (filters.withAttachments) sp.set("att", "1");
    if (page > 1) sp.set("page", String(page));
    const qs = sp.toString();
    return qs ? `/entries?${qs}` : "/entries";
  };

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl">{filtering ? t.search.title : t.search.allEntries}</h1>

      {/* Plain GET form: works without JavaScript, results are server-rendered with RLS */}
      <form role="search" action="/entries" method="get" className="space-y-3">
        <div className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            {t.search.title}
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder={t.search.placeholder}
              aria-describedby="search-hint"
              maxLength={200}
              className="h-12 w-full rounded-full border border-line bg-sheet pl-11 pr-4 text-ink placeholder:text-ink-soft/70 focus-visible:border-tulip-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <button type="submit" className="h-12 rounded-full bg-tulip-ink px-5 font-medium text-white dark:text-paper">
            {t.search.submit}
          </button>
        </div>

        <p id="search-hint" className="px-4 text-xs text-ink-soft">
          {t.search.hint}
        </p>
        <details className="group rounded-2xl border border-line bg-sheet px-4 py-3" open={Boolean(filters.mood || filters.from || filters.to || filters.withAttachments)}>
          <summary className="cursor-pointer text-sm font-medium text-ink-soft">{t.search.filters}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="mood" className="mb-1 block text-sm">
                {t.search.mood}
              </label>
              <select id="mood" name="mood" defaultValue={filters.mood ?? ""} className="h-10 w-full rounded-xl border border-line bg-sheet px-3">
                <option value="">{t.search.anyMood}</option>
                {MOODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.emoji} {t.moods[m.key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="from" className="mb-1 block text-sm">
                {t.search.from}
              </label>
              <input id="from" name="from" type="date" defaultValue={filters.from ?? ""} className="h-10 w-full rounded-xl border border-line bg-sheet px-3" />
            </div>
            <div>
              <label htmlFor="to" className="mb-1 block text-sm">
                {t.search.to}
              </label>
              <input id="to" name="to" type="date" defaultValue={filters.to ?? ""} className="h-10 w-full rounded-xl border border-line bg-sheet px-3" />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="att" value="1" defaultChecked={filters.withAttachments} className="size-4 accent-[var(--tulip-ink)]" />
              {t.search.withAttachments}
            </label>
          </div>
        </details>
        {filtering && (
          <Link href="/entries" className="inline-flex items-center gap-1 text-sm text-tulip-ink hover:underline">
            <X className="size-3.5" aria-hidden />
            {t.search.clear}
          </Link>
        )}
      </form>

      <section aria-label={t.search.results}>
        {items.length === 0 ? (
          <p className="rounded-[1.25rem] border border-dashed border-line px-6 py-10 text-center font-serif text-lg text-ink-soft">
            {filtering ? t.search.noResults : t.dashboard.emptyViewer}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((e) => (
              <li key={e.id}>
                <EntryCard entry={e} t={t} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {(filters.page > 1 || hasMore) && (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          {filters.page > 1 ? (
            <Link href={pageHref(filters.page - 1)} className="rounded-full border border-line bg-sheet px-4 py-2 text-sm hover:bg-paper-deep">
              {t.common.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-ink-soft">{filters.page}</span>
          {hasMore ? (
            <Link href={pageHref(filters.page + 1)} className="rounded-full border border-line bg-sheet px-4 py-2 text-sm hover:bg-paper-deep">
              {t.common.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
