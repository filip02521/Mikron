"use client";

import Link from "next/link";
import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
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
  panelTextLinkClass,
  panelMetricTileClass,
  panelMetricTileInteractiveClass,
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
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
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
}: {
  summary: DailyInboxSummary;
  urgentTotal: number;
  onOpenOnDemand?: () => void;
  urgentVacationCount: number;
}) {
  const mobileSummary = buildMetricsSummary(summary);

  const grid = (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <MetricTile
        value={summary.overdueCount}
        label="Zaległe"
        hint="po terminie"
        href={urgentTotal > 0 ? "/podsumowanie?view=dzis" : undefined}
        icon={<DailySectionIcon kind="harmonogram" size={15} />}
        tileClassName="bg-amber-100 text-amber-800"
      />
      <MetricTile
        value={summary.todayCount}
        label="Na dziś"
        href={urgentTotal > 0 ? "/podsumowanie?view=dzis" : undefined}
        icon={<IconCalendar size={15} />}
        tileClassName="bg-slate-100 text-slate-700"
      />
      <MetricTile
        value={summary.forSomeoneGroupCount}
        label="Prośby handlowców"
        hint={
          summary.forSomeoneLineCount > 0
            ? `${summary.forSomeoneLineCount} prod.`
            : undefined
        }
        href={summary.forSomeoneGroupCount > 0 ? "/podsumowanie?view=dzis" : undefined}
        icon={<IconClipboardList size={15} />}
        tileClassName={sectionIconTileBrandClass}
      />
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
          tileClassName="bg-slate-200/80 text-slate-600"
        />
      ) : null}
    </div>
  );

  const vacationBanner =
    urgentVacationCount > 0 ? (
      <div
        className="mt-3 rounded-xl border border-amber-200/90 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-950"
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
            href="/zakupy/urlopy"
            className="font-medium underline hover:text-amber-950"
          >
            Urlopy
          </Link>
          .
        </p>
      </div>
    ) : null;

  return (
    <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
      {/* Mobile: zwijany przegląd */}
      <details className="group sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 marker:content-none [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Przegląd dnia</p>
            <p className="mt-0.5 truncate text-xs text-slate-500 group-open:hidden">
              {mobileSummary || "Brak pozycji na liście"}
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
        <p className="text-sm font-semibold text-slate-900">Przegląd dnia</p>
        {grid}
        {vacationBanner}
      </div>
    </div>
  );
}
