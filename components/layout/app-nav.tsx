"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, House, PenLine, Settings, Smile } from "lucide-react";
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
    { href: "/moods", label: t.nav.moods, icon: Smile, match: (p: string) => p.startsWith("/moods") },
    { href: "/settings", label: t.nav.settings, icon: Settings, match: (p: string) => p.startsWith("/settings") },
  ];

  return (
    <>
      {/* Desktop / tablet: top bar */}
      <header className="sticky top-0 z-30 hidden border-b border-line/70 bg-paper/85 backdrop-blur md:block">
        <nav aria-label={t.nav.mainNavigation} className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-6">
          <Link href="/" className="mr-4 flex items-center gap-2 font-serif text-lg">
            <TulipMark className="size-7" />
            {t.meta.appName}
          </Link>
          <ul className="flex flex-1 items-center gap-1">
            {items.map(({ href, label, icon: Icon, match }) => {
              const active = match(pathname);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors",
                      active ? "bg-tulip-soft font-medium text-tulip-ink" : "text-ink-soft hover:bg-paper-deep hover:text-ink",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
          {canWrite && (
            <Link
              href="/entries/new"
              className="flex h-10 items-center gap-2 rounded-full bg-tulip-ink px-4 text-sm font-medium text-white transition-colors hover:bg-tulip-ink/90 dark:text-paper"
            >
              <PenLine className="size-4" aria-hidden />
              {t.nav.write}
            </Link>
          )}
        </nav>
      </header>

      {/* Mobile: bottom tab bar, with the write button in the middle for the owner */}
      {/* Hidden while writing so the keyboard and the save bar have room. */}
      {!isEditor && (
      <nav
        aria-label={t.nav.mainNavigation}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-paper/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-flow-col auto-cols-fr items-end px-1 pt-1.5">
          {items.slice(0, 2).map((item) => (
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
          {items.slice(2).map((item) => (
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
