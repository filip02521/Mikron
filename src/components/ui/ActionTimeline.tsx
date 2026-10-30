"use client";

import { IconAlertCircle } from "@/components/icons/StrokeIcons";
import { BrandStepMark } from "@/components/ui/BrandStepMark";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type ActionStepStatus = "idle" | "running" | "ok" | "error";
export type ActionStep = { key: string; title: string; detail: React.ReactNode; status: ActionStepStatus; message?: string; onRetry?: () => void };

/**
 * Pionowa oś działań. Krok w toku i zakończony to ten sam znak OnTime (BrandStepMark): w toku
 * obiega łuk, po sukcesie tarcza się domyka i rysuje się ptaszek; szyna do następnego kroku
 * przejmuje kolor marki.
 */
export function ActionTimeline({ steps, ariaLabel = "Działania po zatwierdzeniu" }: { steps: ActionStep[]; ariaLabel?: string }) {
  return (
    <ol className="relative" aria-label={ariaLabel}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={s.status === "running" ? "step" : undefined}>
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-9 bottom-1 left-4 w-px -translate-x-1/2 transition-colors duration-300 motion-reduce:transition-none",
                  s.status === "ok" ? "bg-indigo-300" : "bg-slate-200"
                )}
              />
            ) : null}
            <span aria-hidden className="relative z-[1] flex size-8 shrink-0 items-center justify-center">
              {/* Ten sam element w toku i po sukcesie — przejście stanu się animuje. */}
              {s.status === "running" || s.status === "ok" ? (
                <BrandStepMark state={s.status === "ok" ? "done" : "running"} />
              ) : (
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-200 motion-reduce:transition-none",
                    s.status === "error" && "bg-red-600 text-white",
                    s.status === "idle" && "bg-white text-slate-500 ring-1 ring-slate-300"
                  )}
                >
                  {s.status === "error" ? (
                    <IconAlertCircle size={15} />
                  ) : (
                    i + 1
                  )}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className={cn("text-sm font-semibold", s.status === "idle" ? "text-slate-600" : "text-slate-900")}>{s.title}</p>
              <div className={cn("mt-0.5 leading-snug", s.status === "idle" ? "text-xs text-slate-500" : "text-sm text-slate-600")}>
                {s.detail}
              </div>
              {s.message ? (
                <p
                  className={cn("mt-1 text-sm", s.status === "error" ? "text-red-700" : "text-slate-700")}
                  role={s.status === "error" ? "alert" : undefined}
                >
                  {s.message}
                </p>
              ) : null}
              {s.onRetry ? (
                <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={s.onRetry}>
                  Spróbuj ponownie
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
