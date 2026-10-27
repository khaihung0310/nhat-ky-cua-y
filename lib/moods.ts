export const MOODS = [
  { key: "happy", emoji: "😊" },
  { key: "peaceful", emoji: "😌" },
  { key: "excited", emoji: "🥰" },
  { key: "tired", emoji: "😴" },
  { key: "sad", emoji: "😔" },
  { key: "anxious", emoji: "😰" },
  { key: "angry", emoji: "😡" },
] as const;

export type Mood = (typeof MOODS)[number]["key"];

const MOOD_KEYS = new Set<string>(MOODS.map((m) => m.key));

export function isMood(value: unknown): value is Mood {
  return typeof value === "string" && MOOD_KEYS.has(value);
}

export function moodEmoji(mood: string | null | undefined): string | null {
  if (!mood) return null;
  return MOODS.find((m) => m.key === mood)?.emoji ?? null;
}

/** Count moods (ignoring entries without one), in the canonical MOODS order. */
export function countMoods(entries: readonly { mood: string | null }[]): { key: Mood; emoji: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (isMood(e.mood)) counts.set(e.mood, (counts.get(e.mood) ?? 0) + 1);
  }
  return MOODS.filter((m) => counts.has(m.key)).map((m) => ({ key: m.key, emoji: m.emoji, count: counts.get(m.key) ?? 0 }));
}
