/** Fallback Suspense dla OrderFormClient — ten sam układ na /prosba. */
export function ProsbaFormSuspenseFallback() {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]">
      <div className="border-b border-slate-100 px-3 pb-3 pt-4 sm:px-4">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-slate-100" />
      </div>
      <p className="px-3 py-12 text-center text-xs text-slate-500 sm:px-4">
        Ładowanie formularza…
      </p>
    </div>
  );
}
