"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import type { DailyDayProgress } from "@/lib/orders/daily-day-progress";
import type { DailyPanelView } from "@/lib/orders/daily-panel-view";
import { DailyDayProgressBar } from "@/components/summary/DailyDayProgressBar";
import { DailyPanelShortcutsPopover } from "@/components/summary/DailyPanelShortcutsPopover";
import { cn } from "@/lib/cn";
import { PanelQueueStatDot } from "@/components/ui/UiGlyphs";
import { IconClipboardPen } from "@/components/icons/StrokeIcons";

function unitLabel(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function Stat({
  value,
  label,
  dotTone,
}: {
  value: number;
  label: string;
  dotTone?: "overdue" | "prosby" | "stockOut" | "today";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {dotTone ? <PanelQueueStatDot tone={dotTone} /> : null}
      <span className="text-sm font-semibold tabular-nums text-slate-900">{value}</span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </span>
  );
}

function StatDivider() {
  return <span className="text-slate-300" aria-hidden>·</span>;
}

function SupplementaryLinks({
  summary,
  onOpenOnDemand,
}: {
  summary: DailyInboxSummary;
  onOpenOnDemand?: () => void;
}) {
  const items: ReactNode[] = [];

  if (summary.weekPlanCount > 0) {
    items.push(
      <Link
        key="plan"
        href="/podsumowanie?view=tydzien"
        className="font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
      >
        Plan {summary.weekPlanCount}
      </Link>
    );
  }
  if (summary.onDemandCount > 0 && onOpenOnDemand) {
    items.push(
      <button
        key="demand"
        type="button"
        className="font-medium text-violet-800 hover:text-violet-950 hover:underline"
        onClick={onOpenOnDemand}
      >
        Na żądanie {summary.onDemandCount}
      </button>
    );
  }
  if (summary.hiddenScheduleCount > 0) {
    items.push(
      <Link
        key="hidden"
        href="/podsumowanie?view=wyjatki#poza-harmonogramem"
        className="font-medium text-slate-700 hover:text-slate-900 hover:underline"
      >
        Poza harm. {summary.hiddenScheduleCount}
      </Link>
    );
  }

  if (!items.length) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
      <span className="font-medium text-slate-600">Poza kolejką:</span>
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 ? <StatDivider /> : null}
          {item}
        </span>
      ))}
    </p>
  );
}

/** Zwięzły pasek: liczniki kolejki, postęp, linki poboczne, skróty. */
export function DailyPanelStatusBand({
  view,
  summary,
  dayProgress,
  verificationCount = 0,
  showVerification = true,
  urgentVacationCount = 0,
  onOpenOnDemand,
}: {
  view: DailyPanelView;
  summary: DailyInboxSummary;
  dayProgress: DailyDayProgress;
  verificationCount?: number;
  showVerification?: boolean;
  urgentVacationCount?: number;
  onOpenOnDemand?: () => void;
}) {
  if (view !== "dzis") return null;

  const queueTotal =
    summary.overdueCount +
    summary.todayCount +
    summary.forSomeoneGroupCount +
    summary.stockOutGroupCount;
  const hasSupplementary =
    summary.weekPlanCount > 0 ||
    (summary.onDemandCount > 0 && onOpenOnDemand) ||
    summary.hiddenScheduleCount > 0;

  return (
    <div className="space-y-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <Stat
            value={summary.overdueCount}
            label={unitLabel(summary.overdueCount, "zaległe", "zaległe", "zaległych")}
            dotTone="overdue"
          />
          <StatDivider />
          <Stat
            value={summary.forSomeoneGroupCount}
            label={unitLabel(summary.forSomeoneGroupCount, "grupa prośb", "grupy prośb", "grup prośb")}
            dotTone="prosby"
          />
          {summary.stockOutGroupCount > 0 ? (
            <>
              <StatDivider />
              <Stat
                value={summary.stockOutGroupCount}
                label={unitLabel(summary.stockOutGroupCount, "brak stanu", "braki stanu", "braków stanu")}
                dotTone="stockOut"
              />
            </>
          ) : null}
          <StatDivider />
          <Stat
            value={summary.todayCount}
            label={unitLabel(summary.todayCount, "na dziś", "na dziś", "na dziś")}
            dotTone="today"
          />
          <StatDivider />
          <span className="inline-flex items-baseline gap-1">
            <span className="text-sm font-semibold tabular-nums text-indigo-900">{queueTotal}</span>
            <span className="text-[11px] text-indigo-700/80">w kolejce</span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showVerification && verificationCount > 0 ? (
            <Link
              href="/weryfikacja"
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950 hover:bg-amber-200/90"
            >
              <IconClipboardPen size={12} strokeWidth={2.25} aria-hidden />
              <span className="tabular-nums">{verificationCount}</span>
              weryfikacja
            </Link>
          ) : null}
          <DailyPanelShortcutsPopover view={view} />
        </div>
      </div>

      <DailyDayProgressBar progress={dayProgress} variant="compact" />

      {hasSupplementary ? (
        <SupplementaryLinks summary={summary} onOpenOnDemand={onOpenOnDemand} />
      ) : null}

      {urgentVacationCount > 0 ? (
        <p className="text-[11px] leading-snug text-amber-900/90" role="status">
          <span className="font-medium text-amber-950">
            Urlop: {urgentVacationCount}{" "}
            {urgentVacationCount === 1 ? "dostawca" : "dostawców"} na liście zaległe / na dziś.
          </span>{" "}
          <Link href="/zakupy/urlopy" className="font-medium underline hover:text-amber-950">
            Urlopy
          </Link>
        </p>
      ) : null}
    </div>
  );
}
