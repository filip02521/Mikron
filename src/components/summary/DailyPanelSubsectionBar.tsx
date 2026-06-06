import { cn } from "@/lib/cn";

export type DailyPanelSubsectionTone =
  | "default"
  | "overdue"
  | "prosby"
  | "stockOut"
  | "today"
  | "cancel";

/** Formy liczby mnogiej (np. grupa / grupy / grup). */
export type DailyPanelCountUnit = {
  one: string;
  few: string;
  many: string;
};

const TONE_DOT: Record<DailyPanelSubsectionTone, string> = {
  overdue: "bg-amber-500",
  prosby: "bg-indigo-500",
  stockOut: "bg-amber-600",
  today: "bg-sky-500",
  cancel: "bg-amber-500",
  default: "bg-slate-400",
};

/** Kropka koloru sekcji — ten sam token co w nagłówkach kolejki Dziś. */
export function dailyPanelToneDotClass(tone: DailyPanelSubsectionTone): string {
  return TONE_DOT[tone];
}

export function formatDailyPanelCount(n: number, unit: DailyPanelCountUnit): string {
  if (n === 1) return `${n} ${unit.one}`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} ${unit.few}`;
  }
  return `${n} ${unit.many}`;
}

/** Obudowa bloku kolejki w zakładce Dziś. */
export function dailyPanelQueueShellClass(tone?: DailyPanelSubsectionTone): string {
  if (tone === "stockOut") {
    return "overflow-hidden rounded-md border border-amber-300/90 bg-amber-50/40 shadow-sm ring-1 ring-amber-200/50";
  }
  return "overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm";
}

/** Nagłówek podsekcji wewnątrz karty panelu dziennego. */
export function DailyPanelSubsectionBar({
  title,
  description,
  action,
  tone = "default",
  step,
  count,
  countUnit,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: DailyPanelSubsectionTone;
  /** Kolejność obsługi w zakładce Dziś (nie liczba pozycji). */
  step?: number;
  count?: number;
  /** Jednostka przy liczbie pozycji — np. grupy, dostawców. */
  countUnit?: DailyPanelCountUnit;
  /** Krótszy nagłówek bez opisu — gdy liczby są już w pasku statusu. */
  compact?: boolean;
}) {
  const countLabel =
    count !== undefined && count > 0 && countUnit
      ? formatDailyPanelCount(count, countUnit)
      : null;

  const ariaParts = [title];
  if (step != null) ariaParts.push(`krok ${step} w kolejce dnia`);
  if (countLabel) ariaParts.push(countLabel);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-3 py-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        {step != null ? (
          <span
            className="shrink-0 rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
            title={`Krok ${step} w kolejce dnia`}
          >
            Krok {step}
          </span>
        ) : null}
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
          aria-hidden
        />
        <div className="min-w-0">
          <div
            className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
            aria-label={ariaParts.join(", ")}
          >
            <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
            {countLabel ? (
              <span className="text-xs font-normal tabular-nums text-slate-500">
                · {countLabel}
              </span>
            ) : null}
          </div>
          {!compact && description ? (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
