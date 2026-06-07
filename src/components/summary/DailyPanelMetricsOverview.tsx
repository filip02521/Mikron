"use client";

import Link from "next/link";
import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import { useSupplierHubContext } from "@/components/layout/AppRoleContext";
import { supplierVacationsHref } from "@/lib/supplier-hub";
import {
  DailySectionIcon,
  IconCalendar,
  IconChevronDown,
  IconClipboardList,
  IconTruck,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { cn } from "@/lib/cn";
import {
  panelSectionInsetClass,
  panelTextLinkClass,
  panelMetricTileClass,
  panelMetricTileInteractiveClass,
  panelTypography,
  sectionIconTileBrandClass,
  sectionIconTileBrandSoftClass,
} from "@/lib/ui/ontime-theme";

function MetricTile({
  value,
  label,
  hint,
  href,
  icon,
  tileClassName,
  onClick,
}: {
  value: number;
  label: string;
  hint?: string;
  href?: string;
  icon: React.ReactNode;
  tileClassName: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <SectionHeadingIcon tileClassName={tileClassName} className="mb-2 h-7 w-7">
        {icon}
      </SectionHeadingIcon>
      <p className={panelTypography.statValue}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-700">{label}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </>
  );

  const className = cn(
    panelMetricTileClass,
    (href || onClick) && panelMetricTileInteractiveClass
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}

function buildMetricsSummary(summary: DailyInboxSummary): string {
  const parts: string[] = [];
  if (summary.overdueCount > 0) parts.push(`${summary.overdueCount} zaległe`);
  if (summary.forSomeoneGroupCount > 0) {
    parts.push(`${summary.forSomeoneGroupCount} prośby`);
  }
  if (summary.todayCount > 0) parts.push(`${summary.todayCount} na dziś`);
  if (summary.weekPlanCount > 0) parts.push(`${summary.weekPlanCount} w planie`);
  return parts.join(" · ");
}

export function DailyPanelMetricsOverview({
  summary,
  urgentTotal,
  onOpenOnDemand,
  urgentVacationCount,
  verificationCount = 0,
  hideVerificationMetric = false,
  hideQueueMetrics = false,
}: {
  summary: DailyInboxSummary;
  urgentTotal: number;
  onOpenOnDemand?: () => void;
  urgentVacationCount: number;
  verificationCount?: number;
  /** Ukryj kafelek weryfikacji, gdy baner w zakładce Dziś już informuje. */
  hideVerificationMetric?: boolean;
  /** Ukryj zaległe / na dziś / prośby — gdy te same liczby są w pasku u góry. */
  hideQueueMetrics?: boolean;
}) {
  const hubContext = useSupplierHubContext();
  const vacationsHref = supplierVacationsHref(hubContext);
  const mobileSummary = buildMetricsSummary(summary);

  const queueTiles = hideQueueMetrics ? null : (
    <>
      <MetricTile
        value={summary.overdueCount}
        label="Zaległe"
        hint="po terminie"
        href={
          summary.overdueCount > 0
            ? "/podsumowanie?view=dzis#kolejka-zalegle"
            : undefined
        }
        icon={<DailySectionIcon kind="harmonogram" size={15} />}
        tileClassName="bg-amber-100 text-amber-800"
      />
      <MetricTile
        value={summary.todayCount}
        label="Na dziś"
        href={
          summary.todayCount > 0
            ? "/podsumowanie?view=dzis#kolejka-harmonogram-dzis"
            : undefined
        }
        icon={<IconCalendar size={15} />}
        tileClassName="bg-sky-100 text-sky-800"
      />
      <MetricTile
        value={summary.forSomeoneGroupCount}
        label="Prośby handlowców"
        hint={
          summary.forSomeoneLineCount > 0
            ? `${summary.forSomeoneLineCount} produktów`
            : undefined
        }
        href={
          summary.forSomeoneGroupCount > 0
            ? "/podsumowanie?view=dzis#kolejka-prosby"
            : undefined
        }
        icon={<IconClipboardList size={15} />}
        tileClassName={sectionIconTileBrandClass}
      />
      {verificationCount > 0 && !hideVerificationMetric ? (
        <MetricTile
          value={verificationCount}
          label="Do weryfikacji"
          hint="brak dostawcy lub towaru"
          href="/weryfikacja"
          icon={<IconClipboardList size={15} />}
          tileClassName="bg-amber-100 text-amber-900"
        />
      ) : null}
    </>
  );

  const supplementaryTiles = (
    <>
      <MetricTile
        value={summary.weekPlanCount}
        label="W planie tygodnia"
        href={summary.weekPlanCount > 0 ? "/podsumowanie?view=tydzien" : undefined}
        icon={<DailySectionIcon kind="plan" size={15} />}
        tileClassName={sectionIconTileBrandSoftClass}
      />
      {summary.onDemandCount > 0 && onOpenOnDemand ? (
        <MetricTile
          value={summary.onDemandCount}
          label="W razie potrzeby"
          hint="na żądanie"
          onClick={onOpenOnDemand}
          icon={<IconTruck size={15} />}
          tileClassName="bg-violet-100 text-violet-800"
        />
      ) : null}
      {summary.hiddenScheduleCount > 0 ? (
        <MetricTile
          value={summary.hiddenScheduleCount}
          label="Poza harmonogramem"
          hint="brak danych"
          href="/podsumowanie?view=wyjatki#poza-harmonogramem"
          icon={<DailySectionIcon kind="hidden" size={15} />}
          tileClassName="bg-indigo-100/70 text-indigo-800/90"
        />
      ) : null}
    </>
  );

  const hasSupplementaryTiles =
    summary.weekPlanCount > 0 ||
    (summary.onDemandCount > 0 && onOpenOnDemand) ||
    summary.hiddenScheduleCount > 0;

  const grid = hideQueueMetrics ? (
    hasSupplementaryTiles ? (
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {supplementaryTiles}
      </div>
    ) : null
  ) : (
    <div
      className={cn(
        "mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
      )}
    >
      {queueTiles}
      {supplementaryTiles}
    </div>
  );

  const vacationBanner =
    urgentVacationCount > 0 ? (
      <div
        className="mt-3 rounded-md border border-amber-200/90 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-950"
        role="status"
      >
        <p className="font-medium">
          Urlop wpływa na{" "}
          {urgentVacationCount === 1
            ? "1 dostawcę"
            : `${urgentVacationCount} dostawców`}{" "}
          na liście zaległe / na dziś
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">
          Szczegóły przy każdej karcie harmonogramu.{" "}
          <Link
            href={vacationsHref}
            className="font-medium underline hover:text-amber-950"
          >
            Urlopy
          </Link>
          .
        </p>
      </div>
    ) : null;

  if (hideQueueMetrics && !grid && !vacationBanner) {
    return null;
  }

  if (hideQueueMetrics && !grid && vacationBanner) {
    return (
      <div className={cn("border-t border-indigo-100/70", panelSectionInsetClass)}>
        {vacationBanner}
      </div>
    );
  }

  const sectionTitle = hideQueueMetrics ? "Poza kolejką dziś" : "Przegląd dnia";
  const mobileLine = hideQueueMetrics
    ? [
        summary.weekPlanCount > 0 ? `${summary.weekPlanCount} w planie` : null,
        summary.onDemandCount > 0 ? `${summary.onDemandCount} na żądanie` : null,
        summary.hiddenScheduleCount > 0 ? `${summary.hiddenScheduleCount} poza harmonogramem` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : mobileSummary;

  return (
    <div className={cn("border-t border-indigo-100/70", panelSectionInsetClass)}>
      {/* Mobile: zwijany przegląd */}
      <details className="group sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 marker:content-none [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{sectionTitle}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500 group-open:hidden">
              {mobileLine || "Brak dodatkowych pozycji"}
            </p>
          </div>
          <span className={cn("inline-flex shrink-0 items-center gap-0.5 text-xs", panelTextLinkClass)}>
            <span className="group-open:hidden">Rozwiń</span>
            <span className="hidden group-open:inline">Zwiń</span>
            <IconChevronDown size={14} className="group-open:rotate-180" />
          </span>
        </summary>
        <div className="pt-3">
          {grid}
          {vacationBanner}
        </div>
      </details>

      {/* Desktop: zawsze widoczny */}
      <div className="hidden sm:block">
        <p className="text-sm font-semibold text-slate-900">{sectionTitle}</p>
        {grid}
        {vacationBanner}
      </div>
    </div>
  );
}
