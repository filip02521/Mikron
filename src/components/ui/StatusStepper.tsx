import { IconCheck } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

export type StatusStepperStep = { key: string; title: string };

/**
 * Oś postępu sprawy (tylko odczyt): kroki przed bieżącym zrobione, bieżący wyróżniony, dalsze szare.
 * `nav` z listą numerowaną — czytnik podaje liczbę kroków i stan każdego („zrobione”, „teraz”);
 * bieżący ma aria-current="step". Na telefonie widać tytuł tylko bieżącego kroku, reszta jest czytana.
 * `currentTone="warn"` — bieżący krok stoi (np. czeka na część).
 */
export function StatusStepper({
  steps,
  current,
  currentTitle,
  currentTone = "brand",
  label,
  compact = false,
}: {
  /** Wąski kontener (panel boczny): tytuł tylko bieżącego kroku przy każdej szerokości ekranu. */
  compact?: boolean;
  steps: StatusStepperStep[];
  /** Indeks bieżącego kroku; -1 = poza osią (np. anulowane) — wszystko szare. */
  current: number;
  /** Inny tytuł bieżącego kroku niż w `steps` (np. „Czeka na część” w miejscu naprawy). */
  currentTitle?: string;
  currentTone?: "brand" | "warn";
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {steps.map((s, i) => {
          const state = current < 0 || i > current ? "upcoming" : i < current ? "done" : "current";
          const title = state === "current" && currentTitle ? currentTitle : s.title;
          const last = i === steps.length - 1;
          return (
            <li
              key={s.key}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2",
                !last && "flex-1 max-sm:flex-auto",
                // W wąskim kontenerze bieżący krok trzyma pełny tytuł, kreski oddają miejsce.
                state === "current" && (compact ? "shrink-0" : "min-w-0")
              )}
            >
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                  state === "done" && "border-indigo-600 bg-indigo-600 text-white",
                  state === "current" && currentTone === "brand" && "border-indigo-600 bg-card text-indigo-700",
                  state === "current" && currentTone === "warn" && "border-amber-500 bg-amber-50 text-amber-800",
                  state === "upcoming" && "border-slate-200 bg-slate-50 text-slate-500"
                )}
              >
                {state === "done" ? <IconCheck size={14} aria-hidden /> : i + 1}
                <span className="sr-only">{`. ${title}, ${state === "done" ? "zrobione" : state === "current" ? "teraz" : "dalej"}`}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "whitespace-nowrap text-[0.8125rem]",
                  state === "current" ? "font-semibold text-slate-900" : state === "done" ? "text-slate-600" : "text-slate-500",
                  state === "current" ? (compact ? "" : "max-sm:truncate") : compact ? "hidden" : "max-sm:hidden"
                )}
              >
                {title}
              </span>
              {!last ? (
                <span
                  aria-hidden
                  className={cn("h-px min-w-2 flex-1 sm:min-w-4", state === "done" ? "bg-indigo-600" : "bg-slate-200")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
