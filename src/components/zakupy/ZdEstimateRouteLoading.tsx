"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { ZdEstimatePageIntro } from "@/components/zakupy/ZdEstimatePageIntro";
import { cn } from "@/lib/cn";
import {
  launchProgressStepFromElapsed,
  ZD_ESTIMATE_ROUTE_LOADING_STEP_COUNT,
  ZD_ESTIMATE_ROUTE_LOADING_STEP_MS,
} from "@/lib/orders/zd-estimate-launch-progress";
import {
  ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION,
  zdEstimateRouteLoadingAriaLabel,
  zdEstimateRouteLoadingFooter,
  zdEstimateRouteLoadingSteps,
  zdEstimateRouteLoadingTitle,
} from "@/lib/orders/zd-estimate-ui-copy";
import { panelTypography, zdEstimatePageShellClass } from "@/lib/ui/ontime-theme";

/**
 * Loading trasy — animowana checklista bootstrapu (nie kroki Policz).
 * Kroki idą z czasem, żeby nie stać wiecznie na „1”, zanim RSC odda stronę.
 */
export function ZdEstimateRouteLoading() {
  const steps = useMemo(() => zdEstimateRouteLoadingSteps(), []);
  const [startedAtMs] = useState(() => Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const activeStepIndex = launchProgressStepFromElapsed(elapsedMs, {
    scopeAlreadyResolved: false,
    stepMs: ZD_ESTIMATE_ROUTE_LOADING_STEP_MS,
    stepCount: Math.min(
      steps.length,
      ZD_ESTIMATE_ROUTE_LOADING_STEP_COUNT
    ),
  });
  const clamped = Math.max(0, Math.min(activeStepIndex, steps.length - 1));
  const progressPct = Math.min(
    92,
    ((clamped + Math.min(1, (elapsedMs % ZD_ESTIMATE_ROUTE_LOADING_STEP_MS) / ZD_ESTIMATE_ROUTE_LOADING_STEP_MS)) /
      steps.length) *
      100
  );
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const activeHint = steps[clamped]!.activeHint;

  return (
    <div className={zdEstimatePageShellClass}>
      <ZdEstimatePageIntro
        description={ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION}
        hostPlaceholder
      />
      <section
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={zdEstimateRouteLoadingAriaLabel()}
        className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card-elevated)]"
      >
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-start gap-3.5">
            <Spinner size="md" className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                {zdEstimateRouteLoadingTitle()}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {activeHint}
              </p>
              <p className="mt-3 text-xs tabular-nums text-slate-400">
                {elapsedSec}s · wczytywanie ustawień
              </p>
            </div>
          </div>
        </div>
        <ol className="divide-y divide-slate-100 px-5 py-2 sm:px-6">
          {steps.map((step, index) => {
            const done = index < clamped;
            const active = index === clamped;
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
            {zdEstimateRouteLoadingFooter()}
          </p>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-indigo-500/85 transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
