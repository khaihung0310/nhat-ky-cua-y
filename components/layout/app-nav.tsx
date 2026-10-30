"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, House, Link2, PenLine, Settings, Smile } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { can, type Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { TulipMark } from "./tulip-mark";

export function AppNav({ role }: { role: Role }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const canWrite = can(role, "entry:create");
  const isEditor = pathname === "/entries/new" || /^\/entries\/[^/]+\/edit$/.test(pathname);

  const items = [
    { href: "/", label: t.nav.home, icon: House, match: (p: string) => p === "/" },
    { href: "/entries", label: t.nav.entries, icon: BookOpen, match: (p: string) => p.startsWith("/entries") && p !== "/entries/new" },
    { href: "/calendar", label: t.nav.calendar, icon: CalendarDays, match: (p: string) => p.startsWith("/calendar") },
    { href: "/links", label: t.nav.links, icon: Link2, match: (p: string) => p.startsWith("/links") },
    { href: "/moods", label: t.nav.moods, icon: Smile, match: (p: string) => p.startsWith("/moods") },
    { href: "/settings", label: t.nav.settings, icon: Settings, match: (p: string) => p.startsWith("/settings") },
  ];
  // Phones: Settings lives in the small top bar so the bottom bar keeps 5 tabs + Write.
  const mobileItems = items.filter((i) => i.href !== "/settings");
  const settingsActive = pathname.startsWith("/settings");

  return (
    <>
      {/* Desktop / tablet: top bar */}
      <header className="sticky top-0 z-30 hidden border-b border-line/70 bg-paper/85 backdrop-blur md:block">
        <nav aria-label={t.nav.mainNavigation} className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-6">
          <Link href="/" className="mr-2 flex shrink-0 items-center gap-2 font-serif text-lg lg:mr-4" aria-label={t.meta.appName}>
            <TulipMark className="size-7" />
            <span className="hidden whitespace-nowrap lg:inline">{t.meta.appName}</span>
          </Link>
          <ul className="flex min-w-0 flex-1 items-center gap-0.5">
            {items.map(({ href, label, icon: Icon, match }) => {
              const active = match(pathname);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-2 text-sm transition-colors lg:px-3",
                      active ? "bg-tulip-soft font-medium text-tulip-ink" : "text-ink-soft hover:bg-paper-deep hover:text-ink",
                    )}
                  >
                    {/* Icons only where there is room (lg+); labels always. */}
                    <Icon className="hidden size-4 lg:block" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
          {canWrite && (
            <Link
              href="/entries/new"
              className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-tulip-ink px-4 text-sm font-medium text-white transition-colors hover:bg-tulip-ink/90 dark:text-paper"
            >
              <PenLine className="size-4" aria-hidden />
              {t.nav.write}
            </Link>
          )}
        </nav>
      </header>

      {/* Mobile: slim top bar with the name and Settings */}
      <header className="flex h-12 items-center justify-between px-4 md:hidden">
        <Link href="/" className="flex items-center gap-1.5 font-serif text-base">
          <TulipMark className="size-6" />
          {t.meta.appName}
        </Link>
        <Link
          href="/settings"
          aria-label={t.nav.settings}
          aria-current={settingsActive ? "page" : undefined}
          className={cn(
            "flex size-10 items-center justify-center rounded-full",
            settingsActive ? "bg-tulip-soft text-tulip-ink" : "text-ink-soft hover:bg-paper-deep hover:text-ink",
          )}
        >
          <Settings className="size-5" aria-hidden />
        </Link>
      </header>

      {/* Mobile: bottom tab bar, with the write button in the middle for the owner */}
      {/* Hidden while writing so the keyboard and the save bar have room. */}
      {!isEditor && (
      <nav
        aria-label={t.nav.mainNavigation}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-paper/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-flow-col auto-cols-fr items-end px-1 pt-1.5">
          {mobileItems.slice(0, 2).map((item) => (
            <MobileItem key={item.href} {...item} active={item.match(pathname)} />
          ))}
          {canWrite ? (
            <li className="flex justify-center">
              <Link
                href="/entries/new"
                aria-label={t.nav.write}
                className="-mt-5 flex size-14 items-center justify-center rounded-full bg-tulip-ink text-white shadow-soft dark:text-paper"
              >
                <PenLine className="size-6" aria-hidden />
              </Link>
            </li>
          ) : null}
          {mobileItems.slice(2).map((item) => (
            <MobileItem key={item.href} {...item} active={item.match(pathname)} />
          ))}
        </ul>
      </nav>
      )}
    </>
  );
}

function MobileItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof House; active: boolean }) {
  return (
    <li className="min-w-0">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center gap-0.5 whitespace-nowrap rounded-2xl px-0.5 py-1.5 text-[0.68rem] leading-tight",
          active ? "text-tulip-ink" : "text-ink-soft",
        )}
      >
        <Icon className={cn("size-5", active && "stroke-[2.25]")} aria-hidden />
        {label}
      </Link>
    </li>
  );
}
