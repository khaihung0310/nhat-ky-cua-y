"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLanguage } from "@/app/actions/auth";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Two-option segmented switch: Tiếng Việt / English. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  const choose = (next: "vi" | "en") => {
    if (next === locale) return;
    start(async () => {
      await setLanguage(next);
      router.refresh();
    });
  };

  return (
    <div role="group" aria-label={t.common.language} className={cn("inline-flex items-center gap-1 rounded-full border border-line bg-sheet p-1 text-sm", className)}>
      <Languages className="ml-1.5 size-4 text-ink-soft" aria-hidden />
      {(["vi", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          disabled={pending}
          lang={l}
          className={cn(
            "rounded-full px-3 py-1 transition-colors",
            locale === l ? "bg-tulip-soft font-medium text-tulip-ink" : "text-ink-soft hover:text-ink",
          )}
        >
          {l === "vi" ? "Tiếng Việt" : "English"}
        </button>
      ))}
    </div>
  );
}
