import { cn } from "@/lib/cn";

export type DailyPanelSubsectionTone = "default" | "overdue" | "prosby" | "today";

const TONE_BAR: Record<
  DailyPanelSubsectionTone,
  { bar: string; title: string; description: string; step: string; count: string }
> = {
  overdue: {
    bar: "border-amber-100 bg-amber-50/60",
    title: "text-amber-950",
    description: "text-amber-900/80",
    step: "bg-amber-200/80 text-amber-950",
    count: "bg-amber-100 text-amber-900",
  },
  prosby: {
    bar: "border-indigo-100/90 bg-gradient-to-r from-indigo-50/75 to-sky-50/35",
    title: "text-indigo-950",
    description: "text-indigo-800/85",
    step: "bg-indigo-200/70 text-indigo-950",
    count: "bg-indigo-100 text-indigo-900",
  },
  today: {
    bar: "border-sky-100 bg-sky-50/55",
    title: "text-sky-950",
    description: "text-sky-900/80",
    step: "bg-sky-200/70 text-sky-950",
    count: "bg-sky-100 text-sky-900",
  },
  default: {
    bar: "border-indigo-100/75 bg-gradient-to-r from-indigo-50/30 via-white to-sky-50/20",
    title: "text-indigo-950",
    description: "text-indigo-800/75",
    step: "bg-indigo-200/65 text-indigo-950",
    count: "bg-indigo-100/90 text-indigo-900",
  },
};

/** Obudowa bloku kolejki w zakładce Dziś — lewy akcent + delikatna obwódka. */
export function dailyPanelQueueShellClass(tone: DailyPanelSubsectionTone): string {
  const accent =
    tone === "overdue"
      ? "border-l-amber-500 ring-amber-100/80"
      : tone === "prosby"
        ? "border-l-indigo-500 ring-indigo-100/70"
        : tone === "today"
          ? "border-l-sky-500 ring-sky-100/70"
          : "border-l-indigo-400/90 ring-indigo-100/70";

  const border =
    tone === "overdue"
      ? "border-amber-200/90"
      : tone === "prosby"
        ? "border-indigo-200/85"
        : tone === "today"
          ? "border-sky-200/85"
          : "border-indigo-200/80";

  return cn(
    "overflow-hidden rounded-xl border border-l-4 bg-white shadow-sm ring-1",
    border,
    accent
  );
}

/** Nagłówek podsekcji wewnątrz karty panelu dziennego (np. prośby handlowców). */
export function DailyPanelSubsectionBar({
  title,
  description,
  action,
  tone = "default",
  step,
  count,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: DailyPanelSubsectionTone;
  /** Numer kroku w kolejce dnia (1 = zaległe, …). */
  step?: number;
  count?: number;
}) {
  const styles = TONE_BAR[tone];

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3 sm:px-5",
        styles.bar
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {step != null ? (
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
              styles.step
            )}
            aria-hidden
          >
            {step}
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className={cn("text-sm font-semibold", styles.title)}>{title}</h4>
            {count !== undefined && count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                  styles.count
                )}
              >
                {count}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className={cn("mt-0.5 text-xs leading-relaxed", styles.description)}>
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
