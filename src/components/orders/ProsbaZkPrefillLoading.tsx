"use client";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

/** Skeleton pozycji podczas wczytywania prefillu ZK na /prosba. */
export function ProsbaZkPrefillLoading({
  zkNumber,
  className,
}: {
  zkNumber?: string | null;
  className?: string;
}) {
  const zk = zkNumber?.trim();
  const title = zk
    ? `Wczytywanie pozycji z ZK ${zk}…`
    : "Wczytywanie pozycji z ZK…";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
      className={cn(
        "rounded-lg border border-slate-200/90 bg-slate-50/70 px-3 py-4 sm:px-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Spinner size="md" className="mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs leading-relaxed text-slate-500">
            Pobieramy listę produktów i stany magazynowe. Przy większej liczbie
            pozycji może to potrwać kilka sekund — formularz uzupełni się
            automatycznie.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="rounded-md border border-slate-200/80 bg-white px-3 py-3"
          >
            <div className="h-3.5 w-[55%] animate-pulse rounded bg-slate-200/90" />
            <div className="mt-2.5 flex gap-2">
              <div className="h-9 flex-1 animate-pulse rounded-md bg-slate-100" />
              <div className="h-9 w-20 animate-pulse rounded-md bg-slate-100" />
            </div>
            <div className="mt-2 h-3 w-[38%] animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
