"use client";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

export function ActionLoadingOverlay({
  message = "Przetwarzanie…",
  hint = "Proszę czekać",
  variant = "section",
  className,
}: {
  message?: string;
  hint?: string;
  /** section = nad kartą/sekcją; viewport = cały ekran; modal = wewnątrz okna dialogowego */
  variant?: "section" | "viewport" | "modal";
  className?: string;
}) {
  const position =
    variant === "viewport"
      ? "fixed inset-0 z-[70]"
      : variant === "modal"
        ? "absolute inset-0 z-20 rounded-2xl"
        : "absolute inset-0 z-30 rounded-xl";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        position,
        "flex items-center justify-center bg-slate-900/20 backdrop-blur-[3px]",
        className
      )}
    >
      <div className="action-loading-shimmer pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
      <div className="mx-4 flex max-w-sm items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-xl ring-1 ring-slate-900/5">
        <Spinner size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{message}</p>
          {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
