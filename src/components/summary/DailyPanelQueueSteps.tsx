"use client";

import { FlowChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import { dailyPanelSectionHref } from "@/lib/orders/daily-panel-section-anchors";
import {
  dailyPanelToneDotClass,
  type DailyPanelSubsectionTone,
} from "@/components/summary/DailyPanelSubsectionBar";
import {
  panelQueueStepsShellClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";

/** Kolejność obsługi w zakładce Dziś (zgodna z DailyTodayView). */
export type DailyPanelQueueStepKind = "overdue" | "stockOut" | "prosby" | "today";

const STEP_ORDER: DailyPanelQueueStepKind[] = [
  "overdue",
  "stockOut",
  "prosby",
  "today",
];

const STEP_TONE: Record<DailyPanelQueueStepKind, DailyPanelSubsectionTone> = {
  overdue: "overdue",
  stockOut: "stockOut",
  prosby: "prosby",
  today: "today",
};

const STEP_META: Record<DailyPanelQueueStepKind, { label: string }> = {
  overdue: { label: "Zaległe" },
  stockOut: { label: "Brak na stanie" },
  prosby: { label: "Prośby handlowców" },
  today: { label: "Na dziś" },
};

function QueueStepChip({
  step,
  kind,
  count,
}: {
  step: number;
  kind: DailyPanelQueueStepKind;
  count: number;
}) {
  const { label } = STEP_META[kind];
  const href = dailyPanelSectionHref(kind);

  return (
    <a
      href={href}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200/80 bg-white px-2.5 py-2 text-slate-800 shadow-[var(--shadow-card)] transition-colors",
        "hover:border-slate-300/85 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80",
        "sm:min-h-0 sm:py-1.5",
        panelTypography.tab
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums text-white",
          dailyPanelToneDotClass(STEP_TONE[kind])
        )}
        aria-hidden
      >
        {step}
      </span>
      <span className="truncate">
        {label}
        <span className="ml-1 font-semibold tabular-nums text-slate-600">({count})</span>
      </span>
    </a>
  );
}

/** Skrócona nawigacja po kolejce Dziś (zaległe → brak stanu → prośby → harmonogram). */
export function DailyPanelQueueSteps({
  overdueCount,
  stockOutGroupCount,
  forSomeoneGroupCount,
  todayCount,
  className,
}: {
  overdueCount: number;
  stockOutGroupCount: number;
  forSomeoneGroupCount: number;
  todayCount: number;
  className?: string;
}) {
  const counts: Record<DailyPanelQueueStepKind, number> = {
    overdue: overdueCount,
    stockOut: stockOutGroupCount,
    prosby: forSomeoneGroupCount,
    today: todayCount,
  };

  const steps = STEP_ORDER.filter((kind) => counts[kind] > 0).map((kind) => ({
    kind,
    count: counts[kind],
  }));

  if (steps.length < 2) return null;

  return (
    <nav
      aria-label="Kroki kolejki dnia"
      className={cn(panelQueueStepsShellClass, className)}
    >
      <span className={cn("mr-0.5 font-medium text-slate-500", panelTypography.caption)}>
        Kolejka
      </span>
      {steps.map((item, index) => (
        <span key={item.kind} className="inline-flex shrink-0 items-center gap-2">
          {index > 0 ? <FlowChevron className="text-slate-300" /> : null}
          <QueueStepChip step={index + 1} kind={item.kind} count={item.count} />
        </span>
      ))}
    </nav>
  );
}
