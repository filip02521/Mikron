"use client";

import { FlowChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import { dailyPanelSectionHref, type DailyPanelQueueSectionKey } from "@/lib/orders/daily-panel-section-anchors";
import { panelQueueStepsShellClass, panelTypography } from "@/lib/ui/ontime-theme";

/** Kolejność obsługi w zakładce Dziś: grupy listy dostawców, potem sygnały braku i prośby handlowców. */
export type DailyPanelQueueStepKind = DailyPanelQueueSectionKey;

/** Kolejka dnia. „Zamów wcześniej” to praca poza planem dnia — ma link w „Poza kolejką”, nie krok. */
export const DAILY_PANEL_QUEUE_STEP_ORDER: DailyPanelQueueStepKind[] = ["send", "order", "shift", "manual", "stockOut", "prosby"];

export const DAILY_PANEL_QUEUE_STEP_LABEL: Record<DailyPanelQueueStepKind, string> = {
  send: "Do wysłania",
  order: "Do zamówienia",
  early: "Zamów wcześniej",
  shift: "Do przesunięcia",
  manual: "Ręcznie",
  stockOut: "Brak na stanie",
  prosby: "Prośby handlowców",
};

type QueueNavigate = (kind: DailyPanelQueueStepKind, event: React.MouseEvent<HTMLAnchorElement>) => void;

function QueueStepChip({ kind, count, onNavigate }: { kind: DailyPanelQueueStepKind; count: number; onNavigate?: QueueNavigate }) {
  return (
    <a
      href={dailyPanelSectionHref(kind)}
      onClick={onNavigate ? (e) => onNavigate(kind, e) : undefined}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200/80 bg-card px-2.5 py-2 text-slate-800 shadow-[var(--shadow-card)] transition-colors",
        "hover:border-slate-300/85 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        "sm:min-h-0 sm:py-1.5",
        panelTypography.tab
      )}
    >
      <span className="truncate">
        {DAILY_PANEL_QUEUE_STEP_LABEL[kind]}
        <span className="ml-1 font-semibold tabular-nums text-slate-600">({count})</span>
      </span>
    </a>
  );
}

/** Skrócona nawigacja po kolejce Dziś — krok prowadzi do grupy listy dostawców albo sekcji próśb. */
export function DailyPanelQueueSteps({
  counts,
  onNavigate,
  className,
}: {
  counts: Record<DailyPanelQueueStepKind, number>;
  /** Przed skokiem do grupy (np. zdjęcie filtra źródła, który mógłby ją ukrywać — wtedy `preventDefault` i własne przewinięcie). */
  onNavigate?: QueueNavigate;
  className?: string;
}) {
  const steps = DAILY_PANEL_QUEUE_STEP_ORDER.filter((kind) => counts[kind] > 0);
  if (steps.length < 2) return null;

  return (
    <nav aria-label="Kroki kolejki dnia" className={cn(panelQueueStepsShellClass, className)}>
      <span className={cn("mr-0.5 font-medium text-slate-500", panelTypography.caption)}>Kolejka</span>
      {steps.map((kind, index) => (
        <span key={kind} className="inline-flex shrink-0 items-center gap-2">
          {index > 0 ? <FlowChevron className="text-slate-300" /> : null}
          <QueueStepChip kind={kind} count={counts[kind]} onNavigate={onNavigate} />
        </span>
      ))}
    </nav>
  );
}
