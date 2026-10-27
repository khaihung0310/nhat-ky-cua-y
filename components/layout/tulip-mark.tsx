/** The little pressed-tulip mark used across the app (decorative). */
export function TulipMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <path d="M32 58V30" stroke="var(--sage)" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 47c-7-1-11-6-12-12 7 0 11 5 12 12z" fill="var(--sage)" opacity="0.8" />
      <path d="M32 44c6-1 9-4 10-9-6 0-9 4-10 9z" fill="var(--sage)" opacity="0.55" />
      <path d="M32 31c-8 0-12-6-12-15l6 4 6-9 6 9 6-4c0 9-4 15-12 15z" fill="var(--tulip)" />
      <path d="M32 31c-3-2-4-7-3-12l3-8 3 8c1 5 0 10-3 12z" fill="var(--tulip-ink)" opacity="0.45" />
    </svg>
  );
}
