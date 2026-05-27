"use client";

import { cn } from "@/lib/cn";
import { panelQueueStepsShellClass } from "@/lib/ui/ontime-theme";

export type DailyPanelQueueStepKind = "overdue" | "prosby" | "today";

const STEP_STYLES: Record<DailyPanelQueueStepKind, { chip: string; dot: string }> = {
  overdue: {
    chip: "border-amber-200/70 bg-white/80 text-amber-900/90 hover:bg-amber-50/80",
    dot: "bg-amber-500",
  },
  prosby: {
    chip: "border-indigo-200/70 bg-white/80 text-indigo-900/90 hover:bg-indigo-50/80",
    dot: "bg-indigo-500",
  },
  today: {
    chip: "border-sky-200/70 bg-white/80 text-sky-900/90 hover:bg-sky-50/80",
    dot: "bg-sky-500",
  },
};

const STEP_META: Record<
  DailyPanelQueueStepKind,
  { href: string; label: string }
> = {
  overdue: { href: "#kolejka-zalegle", label: "Zaległe" },
  prosby: { href: "#kolejka-prosby", label: "Prośby handlowców" },
  today: { href: "#kolejka-harmonogram-dzis", label: "Na dziś" },
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
  const styles = STEP_STYLES[kind];
  const { href, label } = STEP_META[kind];

  return (
    <a
      href={href}
      className={cn(
        "inline-flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
        styles.chip
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums text-white",
          styles.dot
        )}
        aria-hidden
      >
        {step}
      </span>
      <span className="truncate">
        {label}
        <span className="ml-1 font-semibold tabular-nums">({count})</span>
      </span>
    </a>
  );
}

/** Skrócona nawigacja po kolejce Dziś (zaległe → prośby → harmonogram). */
export function DailyPanelQueueSteps({
  overdueCount,
  forSomeoneGroupCount,
  todayCount,
  className,
}: {
  overdueCount: number;
  forSomeoneGroupCount: number;
  todayCount: number;
  className?: string;
}) {
  const steps: { kind: DailyPanelQueueStepKind; count: number }[] = [];
  if (overdueCount > 0) steps.push({ kind: "overdue", count: overdueCount });
  if (forSomeoneGroupCount > 0) {
    steps.push({ kind: "prosby", count: forSomeoneGroupCount });
  }
  if (todayCount > 0) steps.push({ kind: "today", count: todayCount });

  if (steps.length < 2) return null;

  return (
    <nav
      aria-label="Kroki kolejki dnia"
      className={cn(panelQueueStepsShellClass, className)}
    >
      <span className="mr-0.5 text-[11px] font-medium uppercase tracking-wide text-indigo-500/85">
        Kolejka
      </span>
      {steps.map((item, index) => (
        <span key={item.kind} className="inline-flex items-center gap-2">
          {index > 0 ? (
            <span className="text-slate-300" aria-hidden>
              →
            </span>
          ) : null}
          <QueueStepChip step={index + 1} kind={item.kind} count={item.count} />
        </span>
      ))}
    </nav>
  );
}
