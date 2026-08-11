"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { launchProgressStepFromElapsed } from "@/lib/orders/zd-estimate-launch-progress";
import { ZD_ESTIMATE_LAUNCH_FOCUS_ID } from "@/lib/orders/zd-estimate-launch-scroll";

export const ZD_ESTIMATE_LAUNCH_PROGRESS_STEPS = [
  {
    id: "scope",
    title: "Zakres Subiekta",
    activeHint: "Potwierdzam grupę lub cechę dostawcy…",
    doneHint: "Zakres ustawiony",
  },
  {
    id: "fetch",
    title: "Towary i stany",
    activeHint: "Pobieram pełny zakres z testowego API…",
    doneHint: "Dane z Subiekta wczytane",
  },
  {
    id: "calc",
    title: "Sprzedaż, zapas i prośby",
    activeHint: "Analizuję sprzedaż, stany i dołączam prośby handlowców…",
    doneHint: "Wyliczenia i prośby gotowe",
  },
  {
    id: "list",
    title: "Lista do ZD",
    activeHint: "Składam pozycje „Do zamówienia”…",
    doneHint: "Lista gotowa",
  },
] as const;

export function ZdEstimateLaunchProgressPanel({
  supplierName,
  scopeLabel,
  scopeMode,
  startedAtMs,
  scopeAlreadyResolved = true,
  /** Wymuś ostatni krok (np. tuż przed reveal sukcesu). */
  forceComplete = false,
}: {
  supplierName?: string | null;
  scopeLabel?: string | null;
  scopeMode?: "grupa" | "cecha" | null;
  startedAtMs: number;
  scopeAlreadyResolved?: boolean;
  forceComplete?: boolean;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAtMs]);

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const activeStepIndex = forceComplete
    ? ZD_ESTIMATE_LAUNCH_PROGRESS_STEPS.length - 1
    : launchProgressStepFromElapsed(elapsedMs, {
        scopeAlreadyResolved,
        stepCount: ZD_ESTIMATE_LAUNCH_PROGRESS_STEPS.length,
      });

  const clamped = Math.max(
    0,
    Math.min(activeStepIndex, ZD_ESTIMATE_LAUNCH_PROGRESS_STEPS.length - 1)
  );
  const elapsedSec = Math.floor(elapsedMs / 1000);

  return (
    <section
      id={ZD_ESTIMATE_LAUNCH_FOCUS_ID}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      aria-busy={!forceComplete}
      aria-label="Przygotowywanie zamówienia ZD"
      className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card-elevated)] outline-none"
    >
      <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start gap-3.5">
          <Spinner size="md" className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              Przygotowuję zamówienie ZD
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {forceComplete
                ? "Lista gotowa — pokazuję wynik…"
                : ZD_ESTIMATE_LAUNCH_PROGRESS_STEPS[clamped]!.activeHint}
            </p>
            {supplierName || scopeLabel ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {supplierName ? (
                  <span className="inline-flex max-w-full items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800">
                    <span className="mr-1.5 text-slate-400">Dostawca</span>
                    <span className="truncate">{supplierName}</span>
                  </span>
                ) : null}
                {scopeLabel ? (
                  <span className="inline-flex max-w-full items-center rounded-md border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-900">
                    <span className="mr-1.5 text-emerald-700/70">
                      {scopeMode === "cecha" ? "Cecha" : "Grupa"}
                    </span>
                    <span className="truncate">{scopeLabel}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ol className="space-y-0 px-5 py-4 sm:px-6">
        {ZD_ESTIMATE_LAUNCH_PROGRESS_STEPS.map((step, index) => {
          const done = forceComplete || index < clamped;
          const active = !forceComplete && index === clamped;
          return (
            <li
              key={step.id}
              className={cn(
                "relative flex gap-3 py-2.5 transition-colors duration-300",
                index < ZD_ESTIMATE_LAUNCH_PROGRESS_STEPS.length - 1 &&
                  "border-b border-slate-100/90"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-300",
                  done && "bg-emerald-600 text-white",
                  active && "bg-slate-900 text-white ring-2 ring-slate-900/20 ring-offset-2",
                  !done && !active && "bg-slate-100 text-slate-400"
                )}
                aria-hidden
              >
                {done ? "✓" : index + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors duration-300",
                    active
                      ? "text-slate-900"
                      : done
                        ? "text-slate-700"
                        : "text-slate-400"
                  )}
                >
                  {step.title}
                </p>
                <p className={cn(panelTypography.caption, "mt-0.5")}>
                  {done
                    ? step.doneHint
                    : active
                      ? step.activeHint
                      : "Oczekuje…"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
        <p className="text-xs leading-relaxed text-slate-500">
          Duży zakres (np. cecha Ivoclar) może potrwać nawet kilka minut.
          {elapsedSec >= 2
            ? ` Minęło ${elapsedSec} s…`
            : " Proszę nie zamykać tej karty."}
        </p>
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-slate-800/85 transition-[width] duration-500 ease-out"
            style={{
              width: `${((clamped + (forceComplete ? 1 : 0.35)) / ZD_ESTIMATE_LAUNCH_PROGRESS_STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </section>
  );
}
