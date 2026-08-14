"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconAlertCircle,
  IconCircleCheck,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import {
  createZdProgressDurationHint,
  createZdProgressPercent,
  createZdProgressStepFromElapsed,
  formatZdCreateElapsedLabel,
  ZD_CREATE_PROGRESS_STEPS,
} from "@/lib/orders/zd-estimate-create-progress";
import {
  ZD_ESTIMATE_UI,
  zdEstimateCreateProgressAriaLabel,
  zdEstimateCreateProgressCompleteHint,
  zdEstimateCreateProgressCompleteTitle,
  zdEstimateCreateProgressSnapshotFailedHint,
  zdEstimateCreateProgressTitle,
} from "@/lib/orders/zd-estimate-ui-copy";

export function ZdEstimateCreateZdProgressPanel({
  startedAtMs,
  lineCount,
  supplierName,
  forceComplete = false,
  snapshotOk = null,
}: {
  startedAtMs: number;
  lineCount: number;
  supplierName?: string | null;
  forceComplete?: boolean;
  /** null = jeszcze w toku; true/false po create. */
  snapshotOk?: boolean | null;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (forceComplete) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [startedAtMs, forceComplete]);

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const stepIndex = createZdProgressStepFromElapsed(elapsedMs, {
    lineCount,
    forceComplete,
  });
  const clamped = Math.max(
    0,
    Math.min(stepIndex, ZD_CREATE_PROGRESS_STEPS.length - 1)
  );
  const percent = createZdProgressPercent(elapsedMs, { forceComplete });
  const active = ZD_CREATE_PROGRESS_STEPS[clamped]!;
  const statusTitle = forceComplete
    ? zdEstimateCreateProgressCompleteTitle()
    : zdEstimateCreateProgressTitle();
  const statusHint = forceComplete
    ? zdEstimateCreateProgressCompleteHint({ snapshotOk })
    : active.activeHint;
  const completeFailed = forceComplete && snapshotOk === false;

  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy={!forceComplete}
      aria-label={zdEstimateCreateProgressAriaLabel()}
      className="overflow-hidden rounded-xl border border-indigo-200/70 bg-white shadow-sm"
    >
      <div className="border-b border-indigo-100/80 bg-gradient-to-b from-indigo-50/70 to-white px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ring-1",
              forceComplete
                ? completeFailed
                  ? "bg-amber-50 text-amber-800 ring-amber-100"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-100/90"
                : "bg-indigo-50 ring-indigo-100/90"
            )}
          >
            {forceComplete ? (
              completeFailed ? (
                <IconAlertCircle size={18} strokeWidth={2.25} />
              ) : (
                <IconCircleCheck size={18} strokeWidth={2.25} />
              )
            ) : (
              <Spinner
                size="sm"
                className="border-indigo-200 border-t-indigo-600"
              />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold tracking-tight text-slate-900">
              {statusTitle}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {statusHint}
            </p>
            {!forceComplete ? (
              <p className="mt-2 text-xs leading-snug text-slate-500">
                {ZD_ESTIMATE_UI.createProgressDisclaimer}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {supplierName ? (
                <span className="inline-flex max-w-full items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800">
                  <span className="mr-1.5 text-slate-400">Dostawca</span>
                  <span className="truncate">{supplierName}</span>
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium tabular-nums text-slate-700">
                {lineCount} poz.
              </span>
            </div>
          </div>
        </div>
      </div>

      <ol className="px-4 py-3 sm:px-5">
        {ZD_CREATE_PROGRESS_STEPS.map((step, index) => {
          const isSnapshot = step.id === "snapshot";
          const done = forceComplete || index < clamped;
          const isActive = !forceComplete && index === clamped;
          const snapshotFailed =
            forceComplete && isSnapshot && snapshotOk === false;
          const doneHint = snapshotFailed
            ? zdEstimateCreateProgressSnapshotFailedHint()
            : step.doneHint;
          return (
            <li
              key={step.id}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "relative flex gap-3 py-2.5",
                index < ZD_CREATE_PROGRESS_STEPS.length - 1 &&
                  "border-b border-slate-100/90"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-300",
                  snapshotFailed && "bg-amber-600 text-white",
                  !snapshotFailed && done && "bg-emerald-600 text-white",
                  isActive &&
                    "bg-indigo-700 text-white ring-2 ring-indigo-700/25 ring-offset-2",
                  !done && !isActive && "bg-slate-100 text-slate-400"
                )}
                aria-hidden
              >
                {snapshotFailed ? (
                  <IconAlertCircle size={14} strokeWidth={2.25} />
                ) : done ? (
                  <IconCircleCheck size={14} strokeWidth={2.25} />
                ) : (
                  index + 1
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors duration-300",
                    isActive
                      ? "text-slate-900"
                      : snapshotFailed
                        ? "text-amber-900"
                        : done
                          ? "text-slate-700"
                          : "text-slate-400"
                  )}
                >
                  {step.title}
                </p>
                {done || snapshotFailed ? (
                  <p className={cn(panelTypography.caption, "mt-0.5")}>
                    {doneHint}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3.5 sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{createZdProgressDurationHint(lineCount)}</span>
          <span className="shrink-0 tabular-nums font-medium text-slate-600">
            {forceComplete
              ? "100%"
              : `${formatZdCreateElapsedLabel(elapsedMs)} · ${percent}%`}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-slate-200/90"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={
            forceComplete
              ? "Ukończono"
              : `${percent} procent, ${formatZdCreateElapsedLabel(elapsedMs)}`
          }
        >
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
        {!forceComplete && elapsedMs >= 45_000 ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Sfera nadal pracuje — to normalne przy większych listach. Nie zamykaj
            karty ani okna.
          </p>
        ) : !forceComplete ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Proszę nie zamykać tej karty ani okna przeglądarki.
          </p>
        ) : null}
      </div>
    </section>
  );
}
