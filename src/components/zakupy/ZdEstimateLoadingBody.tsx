import { Spinner } from "@/components/ui/Spinner";
import {
  IconAlertCircle,
  IconCircleCheck,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  resolveZdEstimateLoadingBarPct,
  resolveZdEstimateLoadingStatusTone,
  resolveZdEstimateLoadingStepVisual,
  type ZdEstimateLoadingStatusTone,
} from "@/lib/orders/zd-estimate-loading-ui";

export type ZdEstimateLoadingStep = {
  id: string;
  title: string;
  /** Podpowiedź tylko w strefie statusu (nie powtarzaj w wierszu kroku). */
  activeHint: string;
  /** Podtekst pod tytułem kroku, gdy `showStepDoneHints`. */
  doneHint?: string;
};

export type ZdEstimateLoadingChip = {
  label: string;
  value: string;
  tone?: "neutral" | "emerald";
};

export type { ZdEstimateLoadingStatusTone };

/**
 * Wspólne body loadingu Kreatora ZD:
 * status (1 komunikat) + cicha checklista + pasek postępu.
 * Hint aktywnego kroku jest tylko u góry — w liście nie dublujemy go.
 * `showStepDoneHints` pokazuje podtekst zakończonych kroków; błąd kroku
 * (`stepFailureId`) zawsze może mieć własny podpis.
 */
export function ZdEstimateLoadingBody({
  statusTitle,
  statusHint,
  statusTone,
  chips,
  elapsedLabel,
  steps,
  activeStepIndex,
  forceComplete = false,
  progressPct,
  footerNote,
  footerMeta,
  busy = true,
  ariaLabel,
  progressAriaLabel = "Postęp",
  showStepDoneHints = false,
  stepFailureId = null,
  stepFailureHint = null,
  disclaimer,
}: {
  statusTitle: string;
  statusHint: string;
  /** Domyślnie z forceComplete / busy. */
  statusTone?: ZdEstimateLoadingStatusTone;
  chips?: readonly ZdEstimateLoadingChip[] | null;
  elapsedLabel: string;
  steps: readonly ZdEstimateLoadingStep[];
  activeStepIndex: number;
  forceComplete?: boolean;
  /** 0–100; gdy brak — wyliczany z indeksu kroku. */
  progressPct?: number;
  footerNote?: string | null;
  /** Lewa strona footera (np. dodatkowy meta wiersz). */
  footerMeta?: string | null;
  busy?: boolean;
  ariaLabel?: string;
  progressAriaLabel?: string;
  showStepDoneHints?: boolean;
  stepFailureId?: string | null;
  stepFailureHint?: string | null;
  /** Krótka nota pod hintem statusu. */
  disclaimer?: string | null;
}) {
  const clamped = Math.max(
    0,
    Math.min(activeStepIndex, Math.max(0, steps.length - 1))
  );
  const barPct = resolveZdEstimateLoadingBarPct({
    forceComplete,
    progressPct,
    activeStepIndex: clamped,
    stepCount: steps.length,
  });
  const tone = resolveZdEstimateLoadingStatusTone({
    forceComplete,
    statusTone,
  });

  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy={busy}
      aria-label={ariaLabel ?? statusTitle}
      className="zd-est-loading-body"
    >
      <div className="px-5 pb-3.5 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              "zd-est-loading-status-icon relative mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full ring-1",
              tone === "complete" &&
                "bg-emerald-50 text-emerald-700 ring-emerald-100/90",
              tone === "warning" &&
                "bg-amber-50 text-amber-800 ring-amber-100/90",
              tone === "busy" && "bg-indigo-50 ring-indigo-100/90"
            )}
          >
            {tone === "complete" ? (
              <IconCircleCheck size={20} strokeWidth={2.25} />
            ) : tone === "warning" ? (
              <IconAlertCircle size={20} strokeWidth={2.25} />
            ) : (
              <Spinner
                size="sm"
                className="border-indigo-200 border-t-indigo-600"
              />
            )}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[0.9375rem] font-semibold leading-snug tracking-tight text-slate-900 sm:text-base">
              {statusTitle}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              {statusHint}
            </p>
            {disclaimer ? (
              <p className="mt-1.5 text-[12px] leading-snug text-slate-500">
                {disclaimer}
              </p>
            ) : null}
            {chips && chips.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <span
                    key={`${chip.label}-${chip.value}`}
                    className={cn(
                      "inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1",
                      chip.tone === "emerald"
                        ? "bg-emerald-50/90 text-emerald-900 ring-emerald-200/80"
                        : "bg-slate-50/95 text-slate-800 ring-slate-200/90"
                    )}
                  >
                    {chip.label ? (
                      <span
                        className={cn(
                          "mr-1 shrink-0 font-normal",
                          chip.tone === "emerald"
                            ? "text-emerald-700/75"
                            : "text-slate-400"
                        )}
                      >
                        {chip.label}
                      </span>
                    ) : null}
                    <span className="truncate">{chip.value}</span>
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-2.5 text-[11px] tabular-nums tracking-wide text-slate-400">
              {elapsedLabel}
            </p>
          </div>
        </div>
      </div>

      <ol className="zd-est-loading-steps space-y-0.5 px-3.5 pb-3.5 sm:px-4 sm:pb-4">
        {steps.map((step, index) => {
          const { failed, done, active, pending } =
            resolveZdEstimateLoadingStepVisual({
              index,
              activeStepIndex: clamped,
              forceComplete,
              stepId: step.id,
              stepFailureId,
            });
          const doneHintText = failed
            ? stepFailureHint ?? step.doneHint
            : step.doneHint;
          const showHint = Boolean(
            (failed && doneHintText) ||
              (showStepDoneHints && doneHintText && done)
          );
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className={cn(
                "zd-est-loading-step flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-[background-color,opacity,box-shadow] duration-300 ease-out motion-reduce:transition-none",
                active && "zd-est-loading-step--active bg-indigo-50/75",
                failed && "bg-amber-50/60",
                pending && "opacity-[0.48]"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-300",
                  failed && "bg-amber-600 text-white",
                  done && "bg-emerald-100 text-emerald-700",
                  active &&
                    "bg-indigo-600 text-white shadow-[0_0_0_3px_rgba(99,102,241,0.18)]",
                  pending && "bg-slate-100 text-slate-500"
                )}
                aria-hidden
              >
                {failed ? (
                  <IconAlertCircle size={14} strokeWidth={2.25} />
                ) : done ? (
                  <IconCircleCheck size={14} strokeWidth={2.25} />
                ) : (
                  index + 1
                )}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={cn(
                    "text-[13px] font-medium leading-snug",
                    active && "text-indigo-950",
                    failed && "text-amber-950",
                    done && !failed && "text-slate-600",
                    pending && "text-slate-500"
                  )}
                >
                  {step.title}
                </p>
                {showHint ? (
                  <p
                    className={cn(
                      "mt-0.5 text-[11px] leading-snug",
                      failed ? "text-amber-800/90" : "text-slate-500"
                    )}
                  >
                    {doneHintText}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-slate-100/90 bg-gradient-to-b from-slate-50/80 to-slate-50/40 px-5 py-3 sm:px-6 sm:py-3.5">
        {footerMeta ? (
          <div className="mb-2 flex items-center justify-between gap-3 text-[11px] leading-snug text-slate-500">
            <span className="min-w-0">{footerMeta}</span>
            <span className="shrink-0 tabular-nums font-medium text-slate-600">
              {forceComplete ? "100%" : `${Math.round(barPct)}%`}
            </span>
          </div>
        ) : null}
        {footerNote ? (
          <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
            {footerNote}
          </p>
        ) : null}
        <div
          className="zd-est-loading-bar h-1.5 overflow-hidden rounded-full bg-slate-200/85"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(barPct)}
          aria-valuetext={
            forceComplete
              ? tone === "warning"
                ? "Ukończono z ostrzeżeniem"
                : "Ukończono"
              : `${Math.round(barPct)} procent`
          }
          aria-label={progressAriaLabel}
        >
          <div
            className={cn(
              "zd-est-loading-bar__fill h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none",
              tone === "warning"
                ? "bg-amber-500"
                : tone === "complete"
                  ? "bg-emerald-500"
                  : "bg-indigo-500"
            )}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
