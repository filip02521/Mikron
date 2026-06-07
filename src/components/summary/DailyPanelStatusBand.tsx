"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import { useSupplierHubContext } from "@/components/layout/AppRoleContext";
import { supplierVacationsHref } from "@/lib/supplier-hub";
import type { DailyDayProgress } from "@/lib/orders/daily-day-progress";
import type { DailyPanelView } from "@/lib/orders/daily-panel-view";
import { DailyDayProgressBar } from "@/components/summary/DailyDayProgressBar";
import { DailyPanelQueueSteps } from "@/components/summary/DailyPanelQueueSteps";
import { DailyPanelShortcutsPopover } from "@/components/summary/DailyPanelShortcutsPopover";
import { cn } from "@/lib/cn";
import { panelChromeInsetClass, panelTypography } from "@/lib/ui/ontime-theme";
import { PanelQueueStatDot } from "@/components/ui/UiGlyphs";
import { IconChevronDown, IconClipboardPen } from "@/components/icons/StrokeIcons";
import {
  scrollToDailyPanelSection,
  type DailyPanelQueueSectionKey,
} from "@/lib/orders/daily-panel-section-anchors";

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
  sectionKey,
}: {
  value: number;
  label: string;
  dotTone?: "overdue" | "prosby" | "stockOut" | "today";
  sectionKey?: DailyPanelQueueSectionKey;
}) {
  const content = (
    <>
      {dotTone ? <PanelQueueStatDot tone={dotTone} /> : null}
      <span className="text-sm font-semibold tabular-nums text-slate-900">{value}</span>
      <span className={panelTypography.caption}>{label}</span>
    </>
  );

  if (value <= 0 || !sectionKey) {
    return (
      <span className="inline-flex items-center gap-1.5" aria-disabled={value <= 0}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => scrollToDailyPanelSection(sectionKey)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 min-h-9 -mx-1",
        "cursor-pointer transition-colors hover:bg-indigo-50/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300",
        "underline decoration-indigo-300/70 decoration-dotted underline-offset-[3px] hover:decoration-indigo-500/80"
      )}
      title={`Przejdź do sekcji: ${label}`}
    >
      {content}
    </button>
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
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5", panelTypography.caption)}>
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

function StatusBandBody({
  view,
  summary,
  dayProgress,
  queueTotal,
  showQueueSteps,
  hasSupplementary,
  showVerification,
  verificationCount,
  urgentVacationCount,
  onOpenOnDemand,
}: {
  view: DailyPanelView;
  summary: DailyInboxSummary;
  dayProgress: DailyDayProgress;
  queueTotal: number;
  showQueueSteps: boolean;
  hasSupplementary: boolean;
  showVerification: boolean;
  verificationCount: number;
  urgentVacationCount: number;
  onOpenOnDemand?: () => void;
}) {
  const hubContext = useSupplierHubContext();
  const vacationsHref = supplierVacationsHref(hubContext);

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <Stat
            value={summary.overdueCount}
            label={unitLabel(summary.overdueCount, "zaległe", "zaległe", "zaległych")}
            dotTone="overdue"
            sectionKey="overdue"
          />
          {summary.stockOutGroupCount > 0 ? (
            <>
              <StatDivider />
              <Stat
                value={summary.stockOutGroupCount}
                label={unitLabel(
                  summary.stockOutGroupCount,
                  "brak stanu",
                  "braki stanu",
                  "braków stanu"
                )}
                dotTone="stockOut"
                sectionKey="stockOut"
              />
            </>
          ) : null}
          <StatDivider />
          <Stat
            value={summary.forSomeoneGroupCount}
            label={unitLabel(summary.forSomeoneGroupCount, "grupa prośb", "grupy prośb", "grup prośb")}
            dotTone="prosby"
            sectionKey="prosby"
          />
          <StatDivider />
          <Stat
            value={summary.todayCount}
            label={unitLabel(summary.todayCount, "na dziś", "na dziś", "na dziś")}
            dotTone="today"
            sectionKey="today"
          />
          <StatDivider />
          <span className="inline-flex items-baseline gap-1">
            <span className="text-sm font-semibold tabular-nums text-indigo-900">{queueTotal}</span>
            <span className={cn(panelTypography.caption, "text-indigo-700/80")}>w kolejce</span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showVerification && verificationCount > 0 ? (
            <Link
              href="/weryfikacja"
              className="inline-flex min-h-9 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-950 hover:bg-amber-200/90 sm:min-h-0 sm:px-2 sm:py-0.5"
            >
              <IconClipboardPen size={12} strokeWidth={2.25} aria-hidden />
              <span className="tabular-nums">{verificationCount}</span>
              weryfikacja
            </Link>
          ) : null}
          <DailyPanelShortcutsPopover view={view} />
        </div>
      </div>

      {showQueueSteps ? (
        <DailyPanelQueueSteps
          overdueCount={summary.overdueCount}
          stockOutGroupCount={summary.stockOutGroupCount}
          forSomeoneGroupCount={summary.forSomeoneGroupCount}
          todayCount={summary.todayCount}
        />
      ) : null}

      <DailyDayProgressBar progress={dayProgress} variant="compact" />

      {hasSupplementary ? (
        <SupplementaryLinks summary={summary} onOpenOnDemand={onOpenOnDemand} />
      ) : null}

      {urgentVacationCount > 0 ? (
        <p className={cn(panelTypography.caption, "leading-snug text-amber-900/90")} role="status">
          <span className="font-medium text-amber-950">
            Urlop: {urgentVacationCount}{" "}
            {urgentVacationCount === 1 ? "dostawca" : "dostawców"} na liście zaległe / na dziś.
          </span>{" "}
          <Link href={vacationsHref} className="font-medium underline hover:text-amber-950">
            Urlopy
          </Link>
        </p>
      ) : null}
    </>
  );
}

/** Zwięzły pasek: liczniki kolejki, nawigacja kroków, postęp, linki poboczne. */
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
    (summary.onDemandCount > 0 && Boolean(onOpenOnDemand)) ||
    summary.hiddenScheduleCount > 0;
  const activeSectionCount =
    Number(summary.overdueCount > 0) +
    Number(summary.stockOutGroupCount > 0) +
    Number(summary.forSomeoneGroupCount > 0) +
    Number(summary.todayCount > 0);
  const showQueueSteps = activeSectionCount >= 2;
  const [mobileOpen, setMobileOpen] = useState(false);

  const progressHint = dayProgress.combined.hasWork
    ? dayProgress.combined.complete
      ? " · domknięte"
      : ` · ${dayProgress.combined.percent}% postępu`
    : "";

  return (
    <div className={cn("border-b border-slate-100 bg-slate-50/50 py-2.5 sm:py-3", panelChromeInsetClass)}>
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md text-left transition-colors hover:bg-slate-100/60 sm:hidden"
        aria-expanded={mobileOpen}
        aria-controls="daily-panel-status-mobile"
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className={cn("min-w-0 leading-snug text-slate-700", panelTypography.chrome)}>
          <span className="font-semibold text-slate-900">Kolejka dnia</span>
          {": "}
          <span className="tabular-nums font-semibold text-indigo-900">{queueTotal}</span>
          {progressHint}
          {showVerification && verificationCount > 0 ? (
            <span className="text-amber-900"> · {verificationCount} weryf.</span>
          ) : null}
        </span>
        <IconChevronDown
          size={16}
          className={cn("shrink-0 text-slate-400 transition-transform", mobileOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      <div id="daily-panel-status-mobile" className={cn("space-y-2", mobileOpen ? "pt-2" : "hidden", "sm:block sm:pt-0")}>
        <StatusBandBody
          view={view}
          summary={summary}
          dayProgress={dayProgress}
          queueTotal={queueTotal}
          showQueueSteps={showQueueSteps}
          hasSupplementary={hasSupplementary}
          showVerification={showVerification}
          verificationCount={verificationCount}
          urgentVacationCount={urgentVacationCount}
          onOpenOnDemand={onOpenOnDemand}
        />
      </div>
    </div>
  );
}
