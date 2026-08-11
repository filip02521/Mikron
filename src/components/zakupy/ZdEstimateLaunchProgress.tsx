"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { launchProgressStepFromElapsed } from "@/lib/orders/zd-estimate-launch-progress";
import { ZD_ESTIMATE_LAUNCH_FOCUS_ID } from "@/lib/orders/zd-estimate-launch-scroll";
import { zdEstimateLaunchFetchHint } from "@/lib/orders/zd-estimate-ui-copy";

function buildLaunchProgressSteps(isLive: boolean) {
  return [
    {
      id: "scope",
      title: "Zakres Subiekta",
      activeHint: "Potwierdzam grupę lub cechę dostawcy…",
      doneHint: "Zakres ustawiony",
    },
    {
      id: "fetch",
      title: "Towary i stany",
      activeHint: zdEstimateLaunchFetchHint(isLive),
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
      activeHint: "Składam pozycje „Do ZD”…",
      doneHint: "Lista gotowa",
    },
  ] as const;
}

/** @deprecated użyj buildLaunchProgressSteps — zostawione dla importów testowych. */
export const ZD_ESTIMATE_LAUNCH_PROGRESS_STEPS = buildLaunchProgressSteps(false);

export function ZdEstimateLaunchProgressPanel({
  supplierName,
  scopeLabel,
  scopeMode,
  startedAtMs,
  scopeAlreadyResolved = true,
  forceComplete = false,
  ordersIsLive = false,
}: {
  supplierName?: string | null;
  scopeLabel?: string | null;
  scopeMode?: "grupa" | "cecha" | null;
  startedAtMs: number;
  scopeAlreadyResolved?: boolean;
  forceComplete?: boolean;
  ordersIsLive?: boolean;
}) {
  const steps = useMemo(
    () => buildLaunchProgressSteps(ordersIsLive),
    [ordersIsLive]
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAtMs]);

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const activeStepIndex = forceComplete
    ? steps.length - 1
    : launchProgressStepFromElapsed(elapsedMs, {
        scopeAlreadyResolved,
        stepCount: steps.length,
      });

  const clamped = Math.max(0, Math.min(activeStepIndex, steps.length - 1));
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
                : steps[clamped]!.activeHint}
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
            <p className="mt-3 text-xs tabular-nums text-slate-400">
              {elapsedSec}s · postęp szacunkowy
            </p>
          </div>
        </div>
      </div>

      <ol className="divide-y divide-slate-100 px-5 py-2 sm:px-6">
        {steps.map((step, index) => {
          const done = index < clamped || forceComplete;
          const active = index === clamped && !forceComplete;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-3 py-3",
                done && "opacity-70",
                active && "opacity-100"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  done
                    ? "bg-emerald-100 text-emerald-800"
                    : active
                      ? "bg-indigo-100 text-indigo-800"
                      : "bg-slate-100 text-slate-500"
                )}
                aria-hidden
              >
                {done ? "✓" : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    active ? "text-slate-900" : "text-slate-700"
                  )}
                >
                  {step.title}
                </p>
                <p className={cn(panelTypography.caption, "mt-0.5")}>
                  {done ? step.doneHint : active ? step.activeHint : "Oczekuje…"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
