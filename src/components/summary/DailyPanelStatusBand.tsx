"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import { useSupplierHubContext } from "@/components/layout/AppRoleContext";
import { supplierVacationsHref } from "@/lib/supplier-hub";
import { withAutomatDayProgress, type DailyDayProgress } from "@/lib/orders/daily-day-progress";
import type { DailyPanelView } from "@/lib/orders/daily-panel-view";
import { DailyDayProgressBar } from "@/components/summary/DailyDayProgressBar";
import {
  DAILY_PANEL_QUEUE_STEP_LABEL,
  DAILY_PANEL_QUEUE_STEP_ORDER,
  DailyPanelQueueSteps,
  type DailyPanelQueueStepKind,
} from "@/components/summary/DailyPanelQueueSteps";
import { DailyPanelShortcutsPopover } from "@/components/summary/DailyPanelShortcutsPopover";
import { DailyPanelVacationNotice } from "@/components/summary/DailyPanelVacationNotice";
import { cn } from "@/lib/cn";
import {
  panelChromeInsetClass,
  panelQueueStatButtonClass,
  panelTextLinkClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import { IconChevronDown, IconClipboardPen } from "@/components/icons/StrokeIcons";
import {
  dailyPanelSectionHref,
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
  sectionKey,
}: {
  value: number;
  label: string;
  sectionKey?: DailyPanelQueueSectionKey;
}) {
  const content = (
    <>
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
      className={panelQueueStatButtonClass}
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
  earlyCount,
  onQueueNavigate,
  onOpenOnDemand,
}: {
  summary: DailyInboxSummary;
  /** Dostawcy poza planem, u których zapas nie wystarczy do planowego zamówienia (grupa listy). */
  earlyCount: number;
  onQueueNavigate?: (kind: DailyPanelQueueStepKind, event: React.MouseEvent<HTMLAnchorElement>) => void;
  onOpenOnDemand?: () => void;
}) {
  const items: ReactNode[] = [];
  if (earlyCount > 0) {
    items.push(
      <a
        key="early"
        href={dailyPanelSectionHref("early")}
        onClick={onQueueNavigate ? (e) => onQueueNavigate("early", e) : undefined}
        className={cn(panelTextLinkClass, "text-xs")}
      >
        Zamów wcześniej {earlyCount}
      </a>
    );
  }
  // Plan tygodnia ma własną zakładkę „Tydzień N” tuż obok — bez powtórki tej samej liczby.
  if (summary.onDemandCount > 0 && onOpenOnDemand) {
    items.push(
      <button
        key="demand"
        type="button"
        className={cn(panelTextLinkClass, "text-xs")}
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
        className={cn(panelTypography.caption, "font-medium text-slate-600 hover:text-slate-900 hover:underline")}
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
  dayProgressReady = true,
  queueTotal,
  cancelledCount,
  showQueueSteps,
  hasSupplementary,
  showVerification,
  verificationCount,
  urgentVacationCount,
  stepCounts,
  onQueueNavigate,
  onOpenOnDemand,
}: {
  view: DailyPanelView;
  summary: DailyInboxSummary;
  dayProgress: DailyDayProgress;
  dayProgressReady?: boolean;
  stepCounts: Record<DailyPanelQueueStepKind, number>;
  onQueueNavigate?: (kind: DailyPanelQueueStepKind, event: React.MouseEvent<HTMLAnchorElement>) => void;
  queueTotal: number;
  /** Wliczone do „w kolejce” — pokazane osobno, żeby liczby się sumowały. */
  cancelledCount: number;
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
          {/* Z paskiem „Kolejka” liczniki sekcji są w krokach — tu tylko suma (bez powtórki). */}
          {!showQueueSteps
            ? DAILY_PANEL_QUEUE_STEP_ORDER.filter((kind) => stepCounts[kind] > 0).map((kind) => (
                <span key={kind} className="inline-flex items-center gap-2">
                  <Stat value={stepCounts[kind]} label={DAILY_PANEL_QUEUE_STEP_LABEL[kind].toLowerCase()} sectionKey={kind} />
                  <StatDivider />
                </span>
              ))
            : null}
          {cancelledCount > 0 ? (
            <>
              <Stat
                value={cancelledCount}
                label={unitLabel(cancelledCount, "anulowanie", "anulowania", "anulowań")}
              />
              <StatDivider />
            </>
          ) : null}
          <span className="inline-flex items-baseline gap-1">
            <span className="text-sm font-semibold tabular-nums text-slate-900">{queueTotal}</span>
            <span className={panelTypography.caption}>w kolejce</span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showVerification && verificationCount > 0 ? (
            <Link
              href="/weryfikacja"
              className="inline-flex min-h-9 items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-[0.625rem] font-semibold text-amber-950 hover:bg-amber-200/90 sm:min-h-0 sm:px-2 sm:py-0.5"
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
        <DailyPanelQueueSteps counts={stepCounts} onNavigate={onQueueNavigate} />
      ) : null}

      <DailyDayProgressBar
        progress={dayProgress}
        variant="compact"
        ready={dayProgressReady}
      />

      {hasSupplementary ? (
        <SupplementaryLinks
          summary={summary}
          earlyCount={stepCounts.early}
          onQueueNavigate={onQueueNavigate}
          onOpenOnDemand={onOpenOnDemand}
        />
      ) : null}

      {urgentVacationCount > 0 ? (
        <DailyPanelVacationNotice
          count={urgentVacationCount}
          vacationsHref={vacationsHref}
          density="compact"
        />
      ) : null}
    </>
  );
}

/** Zwięzły pasek: liczniki kolejki, nawigacja kroków, postęp, linki poboczne. */
export function DailyPanelStatusBand({
  view,
  summary,
  dayProgress,
  dayProgressReady = true,
  verificationCount = 0,
  showVerification = true,
  urgentVacationCount = 0,
  cancelledCount = 0,
  automat = null,
  supplierGroups,
  onQueueNavigate,
  onOpenOnDemand,
}: {
  view: DailyPanelView;
  summary: DailyInboxSummary;
  dayProgress: DailyDayProgress;
  /** Zamówienia automatu ZD na dziś: ile jest i ile domkniętych (wysłane albo odrzucone). */
  automat?: { done: number; total: number } | null;
  /** Liczba wierszy w grupach listy „Dostawcy na dziś” (bez „Zrobione dziś”). */
  supplierGroups: Record<"send" | "order" | "early" | "shift" | "manual", number>;
  /** Przed skokiem z kroku kolejki do grupy listy. */
  onQueueNavigate?: (kind: DailyPanelQueueStepKind, event: React.MouseEvent<HTMLAnchorElement>) => void;
  dayProgressReady?: boolean;
  verificationCount?: number;
  showVerification?: boolean;
  urgentVacationCount?: number;
  /** Anulowania handlowców do rozliczenia — liczone też w zakładce „Dziś”. */
  cancelledCount?: number;
  onOpenOnDemand?: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  if (view !== "dzis") return null;

  const progress = withAutomatDayProgress(dayProgress, automat);
  const stepCounts: Record<DailyPanelQueueStepKind, number> = {
    ...supplierGroups,
    stockOut: summary.stockOutGroupCount,
    prosby: summary.forSomeoneGroupCount,
  };
  // Jeden dostawca = jedna pozycja kolejki, także gdy stoi w automacie i w harmonogramie naraz.
  // „Zamów wcześniej” nie jest krokiem kolejki — stoi w „Poza kolejką”, obok „Na żądanie”.
  const queueTotal = DAILY_PANEL_QUEUE_STEP_ORDER.reduce((n, kind) => n + stepCounts[kind], 0) + cancelledCount;
  const hasSupplementary =
    supplierGroups.early > 0 ||
    (summary.onDemandCount > 0 && Boolean(onOpenOnDemand)) ||
    summary.hiddenScheduleCount > 0;
  const showQueueSteps = DAILY_PANEL_QUEUE_STEP_ORDER.filter((kind) => stepCounts[kind] > 0).length >= 2;

  const progressHint =
    dayProgressReady && progress.combined.hasWork
      ? progress.combined.complete
        ? " · domknięte"
        : ` · ${progress.combined.percent}% postępu`
      : "";

  return (
    <div className={cn("py-3 sm:py-4", panelChromeInsetClass)}>
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
          <span className="tabular-nums font-semibold text-slate-900">{queueTotal}</span>
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
          dayProgress={progress}
          stepCounts={stepCounts}
          onQueueNavigate={onQueueNavigate}
          dayProgressReady={dayProgressReady}
          queueTotal={queueTotal}
          cancelledCount={cancelledCount}
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
