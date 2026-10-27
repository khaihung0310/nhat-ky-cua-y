export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-8 w-2/3 max-w-sm animate-pulse rounded-full bg-paper-deep" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-[1.25rem] bg-paper-deep" />
        ))}
      </div>
    </div>
  );
}
