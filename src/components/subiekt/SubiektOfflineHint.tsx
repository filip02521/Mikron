"use client";

import { IconAlertCircle } from "@/components/icons/StrokeIcons";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { cn } from "@/lib/cn";

function badgeLabel(count: number): string {
  if (count <= 1) return "Tryb ręczny";
  const word = count < 5 ? "informacje" : "informacji";
  return `${count} ${word}`;
}

const FOOTER: Record<"prosba" | "moje", string> = {
  prosba: "Możesz wpisać dane ręcznie i wysłać prośbę bez Subiekta.",
  moje: "Lista prośb działa normalnie — szacunki terminów z historii dostaw.",
};

/** Dyskretna informacja: Subiekt niedostępny — szczegóły po najechaniu / fokusie. */
export function SubiektOfflineHint({
  feedback,
  count = 1,
  className,
  align = "right",
  context = "prosba",
}: {
  feedback: SubiektFeedback;
  /** Liczba komunikatów (domyślnie 1 → „Tryb ręczny”). */
  count?: number;
  className?: string;
  align?: "left" | "right";
  /** Kontekst ekranu — zmienia tekst w stopce tooltipa. */
  context?: "prosba" | "moje";
}) {
  const label = badgeLabel(count);
  const footer = FOOTER[context];

  return (
    <div className={cn("group relative inline-flex", className)}>
      <button
        type="button"
        aria-label={`${label}: ${feedback.title}`}
        className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 shadow-sm transition hover:border-amber-300 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
      >
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
          aria-hidden
        >
          <IconAlertCircle size={14} strokeWidth={2.5} />
        </span>
        <span>{label}</span>
      </button>

      <div
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full z-30 mt-1.5 w-[min(100vw-2rem,17rem)] rounded-lg border border-amber-200 bg-white p-3 text-xs leading-relaxed text-slate-600 shadow-lg",
          "opacity-0 transition-opacity duration-150",
          "group-hover:pointer-events-auto group-hover:opacity-100",
          "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
          align === "right" ? "right-0" : "left-0"
        )}
      >
        <p className="font-semibold text-slate-900">{feedback.title}</p>
        <p className="mt-1">{feedback.message}</p>
        {feedback.hint ? <p className="mt-2 text-slate-500">{feedback.hint}</p> : null}
        <p className="mt-2 font-medium text-emerald-800/90">{footer}</p>
      </div>
    </div>
  );
}
