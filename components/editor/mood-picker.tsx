"use client";

import { MOODS, type Mood } from "@/lib/moods";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Optional mood: a radio group of emoji chips. Selecting the active one clears it. */
export function MoodPicker({ value, onChange, labelId }: { value: Mood | null; onChange: (m: Mood | null) => void; labelId: string }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
      {MOODS.map((m) => {
        const active = value === m.key;
        return (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : m.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              active ? "border-tulip-ink bg-tulip-soft text-tulip-ink" : "border-line bg-sheet text-ink-soft hover:text-ink",
            )}
          >
            <span aria-hidden className="text-base">
              {m.emoji}
            </span>
            {t.moods[m.key]}
          </button>
        );
      })}
    </div>
  );
}
