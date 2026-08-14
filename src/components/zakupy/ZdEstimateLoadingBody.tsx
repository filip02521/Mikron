import { Spinner } from "@/components/ui/Spinner";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

export type ZdEstimateLoadingStep = {
  id: string;
  title: string;
  /** Podpowiedź tylko w strefie statusu (nie powtarzaj w wierszu kroku). */
  activeHint: string;
  /** Zachowane w danych kroków / testach copy — UI pokazuje tylko check, bez podtekstu. */
  doneHint?: string;
};

export type ZdEstimateLoadingChip = {
  label: string;
  value: string;
  tone?: "neutral" | "emerald";
};

/**
 * Wspólne body loadingu: status (1 komunikat) + cicha checklista + pasek postępu.
 * Hint aktywnego kroku jest tylko u góry — w liście nie dublujemy go.
 */
export function ZdEstimateLoadingBody({
  statusTitle,
  statusHint,
  chips,
  elapsedLabel,
  steps,
  activeStepIndex,
  forceComplete = false,
  progressPct,
  footerNote,
  busy = true,
  ariaLabel,
}: {
  statusTitle: string;
  statusHint: string;
  chips?: readonly ZdEstimateLoadingChip[] | null;
  elapsedLabel: string;
  steps: readonly ZdEstimateLoadingStep[];
  activeStepIndex: number;
  forceComplete?: boolean;
  /** 0–100; gdy brak — wyliczany z indeksu kroku. */
  progressPct?: number;
  footerNote?: string | null;
  busy?: boolean;
  ariaLabel?: string;
}) {
  const clamped = Math.max(
    0,
    Math.min(activeStepIndex, Math.max(0, steps.length - 1))
  );
  const derivedPct = forceComplete
    ? 100
    : Math.min(
        96,
        ((clamped + 0.45) / Math.max(1, steps.length)) * 100
      );
  const barPct = Math.max(
    forceComplete ? 100 : 4,
    Math.min(100, progressPct ?? derivedPct)
  );

  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy={busy}
      aria-label={ariaLabel ?? statusTitle}
    >
      <div className="px-5 pb-3.5 pt-4 sm:px-6 sm:pb-4 sm:pt-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ring-1",
              forceComplete
                ? "bg-emerald-50 text-emerald-700 ring-emerald-100/90"
                : "bg-indigo-50 ring-indigo-100/90"
            )}
          >
            {forceComplete ? (
              <IconCircleCheck size={18} strokeWidth={2.25} />
            ) : (
              <Spinner
                size="sm"
                className="border-indigo-200 border-t-indigo-600"
              />
            )}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[0.9375rem] font-semibold leading-snug tracking-tight text-slate-900">
              {statusTitle}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              {statusHint}
            </p>
            {chips && chips.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <span
                    key={`${chip.label}-${chip.value}`}
                    className={cn(
                      "inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1",
                      chip.tone === "emerald"
                        ? "bg-emerald-50/90 text-emerald-900 ring-emerald-200/80"
                        : "bg-slate-50 text-slate-800 ring-slate-200/90"
                    )}
                  >
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
                    <span className="truncate">{chip.value}</span>
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-[11px] tabular-nums tracking-wide text-slate-400">
              {elapsedLabel}
            </p>
          </div>
        </div>
      </div>

      <ol className="space-y-0.5 px-3.5 pb-3.5 sm:px-4 sm:pb-4">
        {steps.map((step, index) => {
          const done = index < clamped || forceComplete;
          const active = index === clamped && !forceComplete;
          const pending = !done && !active;
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
                active && "bg-indigo-50/70",
                pending && "opacity-50"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  done
                    ? "bg-emerald-100 text-emerald-700"
                    : active
                      ? "bg-indigo-600 text-white ring-2 ring-indigo-100"
                      : "bg-slate-100 text-slate-500"
                )}
                aria-hidden
              >
                {done ? (
                  <IconCircleCheck size={14} strokeWidth={2.25} />
                ) : (
                  index + 1
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[13px] font-medium leading-snug",
                    active
                      ? "text-indigo-950"
                      : done
                        ? "text-slate-600"
                        : "text-slate-500"
                  )}
                >
                  {step.title}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-slate-100/90 bg-slate-50/50 px-5 py-3 sm:px-6">
        {footerNote ? (
          <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
            {footerNote}
          </p>
        ) : null}
        <div
          className="h-1 overflow-hidden rounded-full bg-slate-200/80"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(barPct)}
          aria-label="Postęp wczytywania"
        >
          <div
            className="h-full rounded-full bg-indigo-500/90 transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
