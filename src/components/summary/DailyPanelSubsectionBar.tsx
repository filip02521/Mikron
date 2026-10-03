import { cn } from "@/lib/cn";
import { panelSubsectionInsetClass, panelTypography, surfaceCardClass } from "@/lib/ui/ontime-theme";

export type DailyPanelSubsectionTone =
  | "default"
  | "overdue"
  | "prosby"
  | "stockOut"
  | "today"
  | "cancel"
  | "plan"
  | "informacja";

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
  plan: "bg-indigo-500",
  informacja: "bg-sky-500",
  default: "bg-slate-400",
};

function dailyPanelSubsectionBarShellClass(tone: DailyPanelSubsectionTone): string {
  // Jeden neutralny nagłówek dla wszystkich grup; ton nie barwi tła.
  void tone;
  return "border-b border-slate-100 bg-slate-50/60";
}

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

/** Obudowa bloku kolejki — ton sekcji przez delikatne tło i obwódkę (bez lewego paska). */
export function dailyPanelQueueShellClass(tone?: DailyPanelSubsectionTone): string {
  // Wszystkie grupy kolejki na tej samej, neutralnej powierzchni.
  void tone;
  return cn(surfaceCardClass, "overflow-hidden");
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
    <div className={cn("flex flex-wrap items-center justify-between gap-2 py-2 sm:py-2.5", dailyPanelSubsectionBarShellClass(tone), panelSubsectionInsetClass)}>
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0">
          <div
            className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
            aria-label={ariaParts.join(", ")}
          >
            <h4 className={panelTypography.sectionTitle}>{title}</h4>
            {countLabel ? (
              <span className={cn("font-normal tabular-nums text-slate-500", panelTypography.rowMeta)}>
                · {countLabel}
              </span>
            ) : null}
          </div>
          {!compact && description ? (
            <p className={cn("mt-0.5", panelTypography.caption)}>{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
