"use client";

import { Suspense, useMemo, useState, type ComponentProps } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";
import type {
  DeliveryStats,
  SupplierWithSchedule,
  TeethSupplierSchedule,
} from "@/types/database";
import { SalesPlanWeekStrip } from "@/components/plan/SalesPlanWeekStrip";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackChevron } from "@/components/ui/UiGlyphs";
import { Badge } from "@/components/ui/Badge";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { NotatnikListFilterBar } from "@/components/notatnik/NotatnikListFilterBar";
import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { locationLabel } from "@/lib/display-labels";
import {
  matchSuppliersByQuery,
  orderSalesPrioritySuppliers,
  SALES_PLAN_SEARCH_LIMIT,
} from "@/lib/orders/plan-preview";
import {
  buildSalesSupplierInsight,
  describeNextOrderForSales,
  type SalesSupplierInsight,
} from "@/lib/orders/sales-supplier-insight";
import { leadTimeDisplayFromQuantiles } from "@/lib/orders/delivery-eta-quantiles-load";
import { prosbaHref } from "@/lib/orders/prosba-url";
import { useSalesPreviewHref } from "@/lib/nav/use-sales-preview-href";
import {
  IconCalendar,
  IconChevronDown,
  IconClipboardList,
  IconPlusCircle,
  PlanSectionIcon,
  planSectionIconTileClass,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { cn } from "@/lib/cn";
import {
  buttonPrimaryClass,
  salesChromeInsetClass,
  salesPageShellClass,
  salesTypography,
} from "@/lib/ui/ontime-theme";
import {
  SALES_PLAN_COPY,
  salesPlanOpenRequestsLabel,
} from "@/lib/sales/sales-plan-ui-copy";
import { salesSearchPlaceholder } from "@/lib/sales/sales-search-ui";
import { Alert } from "@/components/ui/Alert";
import { SupplierVacationNowChip } from "@/components/summary/SupplierVacationNowChip";
import { formatSupplierVacationRangeTitle } from "@/lib/orders/procurement-supplier-vacation";

const C = SALES_PLAN_COPY;

/** Link stylowany jak Button — bez zagnieżdżania <button> w <a>. */
function planLinkButtonClass(
  variant: "primary" | "secondary",
  size: "sm" | "md" = "md"
) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium transition-colors",
    size === "sm"
      ? "rounded-md px-2.5 py-1.5 text-xs leading-none"
      : "rounded-md px-4 py-2 text-sm",
    variant === "primary"
      ? buttonPrimaryClass
      : "border border-[var(--card-border)] bg-[var(--card)] text-slate-700 shadow-sm hover:bg-slate-50"
  );
}

function PlanGuide() {
  return (
    <HelpPopover
      label={C.helpLabel}
      title={C.helpTitle}
      shortLabel={C.helpShort}
      icon={<GuideIcon />}
    >
      <HelpBlock title={C.helpTwoDatesTitle}>
        <p>{C.helpTwoDatesBody}</p>
      </HelpBlock>
      <HelpBlock title={C.helpOpenTitle}>
        <p>{C.helpOpenBody}</p>
      </HelpBlock>
      <HelpBlock title={C.helpSearchTitle}>
        <p>{C.helpSearchBody}</p>
      </HelpBlock>
      <HelpBlock title={C.helpWeekTitle}>
        <p>{C.helpWeekBody}</p>
      </HelpBlock>
    </HelpPopover>
  );
}

function orderSummaryLabel(insight: SalesSupplierInsight): string {
  if (insight.orderOnDemand) return C.labelOnDemand;
  if (insight.isOverdue) return C.labelOverdue;
  if (insight.weekDayLabel && insight.weekDateLabel) {
    return `${insight.weekDayLabel} ${insight.weekDateLabel}`;
  }
  if (insight.nextDate) {
    return insight.weekDateLabel ?? C.labelOutsideWeek;
  }
  return C.labelNoDate;
}

function warehouseSummaryLabel(insight: SalesSupplierInsight): {
  text: string;
  empty: boolean;
  title?: string;
} {
  if (insight.orderOnDemand) {
    return { text: "—", empty: true, title: C.tipOnDemand };
  }
  if (!insight.nextDate) {
    return { text: "—", empty: true, title: C.tipNoOrderDate };
  }
  if (!insight.arrivalEta) {
    return { text: "—", empty: true, title: C.tipNoHistory };
  }
  return {
    text: insight.arrivalEta.shortLabel,
    empty: false,
    title: insight.arrivalEta.fullLabel,
  };
}

/** Wspólna siatka wiersza — wyrównanie kolumn między wierszami. */
const PLAN_ROW_GRID =
  "grid w-full min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-2 sm:grid-cols-[1.25rem_minmax(0,1.4fr)_6.5rem_6.5rem_8.25rem] sm:gap-x-3";

function SalesPlanColumnHeader() {
  return (
    <div
      className={cn(
        "hidden border-b border-slate-200/90 bg-slate-50/90 px-3 py-1.5 sm:grid sm:px-4",
        PLAN_ROW_GRID
      )}
      aria-hidden
    >
      <span />
      <span className={cn(salesTypography.sectionLabel, "text-slate-500")}>
        {C.colSupplier}
      </span>
      <span className={cn(salesTypography.sectionLabel, "text-right text-slate-500")}>
        {C.colOrder}
      </span>
      <span className={cn(salesTypography.sectionLabel, "text-right text-slate-500")}>
        {C.colWarehouse}
      </span>
      <span className="min-w-0" />
    </div>
  );
}

function SalesSupplierRow({
  insight,
  openOrderCount,
  defaultOpen = false,
  previewHref,
  previewDla,
  adminReadOnlyPreview,
}: {
  insight: SalesSupplierInsight;
  openOrderCount?: number;
  defaultOpen?: boolean;
  previewHref: (href: string) => string;
  previewDla: string | null;
  adminReadOnlyPreview: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const next = describeNextOrderForSales(insight, {
    readOnlyPreview: adminReadOnlyPreview,
  });
  const orderLabel = orderSummaryLabel(insight);
  const warehouse = warehouseSummaryLabel(insight);
  const hasOpenRequests = Boolean(openOrderCount && openOrderCount > 0);
  const titleId = `sales-plan-supplier-${insight.supplierId}`;
  const panelId = `${titleId}-details`;

  return (
    <li
      className={cn(
        "border-b border-slate-100/90 transition-[background-color] duration-150 last:border-b-0",
        expanded
          ? "z-[1] bg-indigo-50/60 ring-1 ring-inset ring-indigo-200/70"
          : "hover:bg-slate-50/80"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          PLAN_ROW_GRID,
          "min-h-[2.85rem] px-3 py-2 text-left sm:px-4",
          expanded && "bg-indigo-50/30"
        )}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-labelledby={titleId}
      >
        <IconChevronDown
          open={expanded}
          className="shrink-0 text-slate-400"
          size={16}
        />

        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-x-1.5">
            <span
              id={titleId}
              className={cn("min-w-0 truncate", salesTypography.rowTitle, "font-medium")}
            >
              {insight.name}
            </span>
            <span className="shrink-0 rounded bg-slate-100/90 px-1 py-px text-[10px] font-medium text-slate-500">
              {locationLabel(insight.location)}
            </span>
          </div>
          <p
            className={cn(
              "mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:hidden",
              salesTypography.rowMeta
            )}
          >
            <span className="tabular-nums text-slate-700">{orderLabel}</span>
            <span className="text-slate-300" aria-hidden>
              →
            </span>
            <span
              className={cn(
                "tabular-nums",
                warehouse.empty ? "text-slate-400" : "text-slate-700"
              )}
              title={warehouse.title}
            >
              {warehouse.empty ? C.mobileWarehouseEmpty : warehouse.text}
            </span>
            {hasOpenRequests ? (
              <span className="font-medium text-indigo-600">· {openOrderCount}</span>
            ) : null}
            {insight.onVacationNow ? (
              <span className="font-medium text-amber-700">· {C.labelVacationShort}</span>
            ) : null}
            {insight.isOverdue ? (
              <span className="font-medium text-amber-800">· {C.labelOverdue}</span>
            ) : null}
          </p>
        </div>

        <p
          className={cn(
            "hidden tabular-nums text-right sm:block",
            salesTypography.rowBody,
            "font-semibold text-slate-800",
            insight.isOverdue && "text-amber-900"
          )}
        >
          {orderLabel}
        </p>
        <p
          className={cn(
            "hidden tabular-nums text-right sm:block",
            salesTypography.rowBody,
            warehouse.empty
              ? "font-normal text-slate-400"
              : "font-semibold text-slate-800"
          )}
          title={warehouse.title}
        >
          {warehouse.text}
        </p>

        <div className="hidden min-w-0 flex-wrap items-center justify-end gap-1 sm:flex">
          {insight.isOverdue ? (
            <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
              {C.labelOverdue}
            </Badge>
          ) : null}
          {insight.onVacationNow && insight.vacationWindow ? (
            <SupplierVacationNowChip window={insight.vacationWindow} compact />
          ) : null}
          {insight.orderOnDemand ? (
            <Badge variant="default" className="px-1.5 py-0 text-[10px]">
              {C.labelOnDemand}
            </Badge>
          ) : null}
          {insight.activeShift && !insight.isOverdue ? (
            <Badge variant="info" className="px-1.5 py-0 text-[10px]">
              {C.labelShifted}
            </Badge>
          ) : null}
          {hasOpenRequests ? (
            <span title={salesPlanOpenRequestsLabel(openOrderCount!)}>
              <Badge variant="info" className="px-1.5 py-0 text-[10px] tabular-nums">
                {openOrderCount}
              </Badge>
            </span>
          ) : null}
        </div>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={titleId}
        hidden={!expanded}
        className="border-t border-indigo-200/40 bg-white/70 px-3 pb-3 pt-2 sm:px-4"
      >
        {expanded ? (
          <div className="space-y-2.5 rounded-md border border-slate-200/90 bg-white px-3 py-2.5">
            <div>
              <p className={cn(salesTypography.sectionLabel, "text-slate-500")}>
                {C.expandOrderTitle}
              </p>
              <p className={cn("mt-0.5 leading-snug", salesTypography.rowTitle)}>
                {next.primary}
              </p>
              {next.secondary ? (
                <p className={cn("mt-0.5 leading-snug", salesTypography.rowBody)}>
                  {next.secondary}
                </p>
              ) : null}
              {insight.lastOrderLabel ? (
                <p className={cn("mt-1", salesTypography.rowMeta)}>
                  {C.expandLastOrder(insight.lastOrderLabel)}
                </p>
              ) : null}
              {insight.activeShift ? (
                <p className={cn("mt-0.5", salesTypography.rowMeta)}>
                  {C.expandActiveShift}
                </p>
              ) : null}
            </div>

            <dl className="grid gap-2 border-t border-slate-100 pt-2.5 text-xs sm:grid-cols-2 sm:gap-x-4">
              <div>
                <dt className={cn(salesTypography.sectionLabel, "text-slate-500")}>
                  {C.expandWarehouseTitle}
                </dt>
                {insight.arrivalEta ? (
                  <>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {insight.arrivalEta.fullLabel}
                    </dd>
                    {insight.statsMode === "OSOBNO" && insight.leadTimeSummary ? (
                      <dd className="mt-0.5 text-[0.7rem] text-slate-600">
                        {insight.leadTimeSummary}
                      </dd>
                    ) : null}
                    {insight.leadTimeDetail ? (
                      <dd className="mt-0.5 text-[0.7rem] text-slate-600">
                        {insight.leadTimeDetail}
                      </dd>
                    ) : null}
                  </>
                ) : insight.orderOnDemand ? (
                  <>
                    <dd className="mt-0.5 font-medium text-slate-900">—</dd>
                    <dd className="mt-0.5 text-[0.7rem] text-slate-600">
                      {C.expandOnDemandWarehouse}
                      {insight.leadTimeSummary ? `: ${insight.leadTimeSummary}` : "."}
                    </dd>
                    {insight.statsMode === "OSOBNO" && insight.leadTimeDetail ? (
                      <dd className="mt-0.5 text-[0.7rem] text-slate-600">
                        {insight.leadTimeDetail}
                      </dd>
                    ) : null}
                  </>
                ) : (
                  <>
                    <dd className="mt-0.5 font-medium text-slate-900">—</dd>
                    {insight.leadTimeSummary ? (
                      <dd className="mt-0.5 text-[0.7rem] text-slate-600">
                        {insight.leadTimeSummary}
                      </dd>
                    ) : null}
                    {insight.leadTimeDetail ? (
                      <dd className="mt-0.5 text-[0.7rem] text-slate-600">
                        {insight.leadTimeDetail}
                      </dd>
                    ) : !insight.leadTimeSummary ? (
                      <dd className="mt-0.5 text-[0.7rem] text-slate-600">
                        {C.expandNoHistory}
                      </dd>
                    ) : null}
                  </>
                )}
              </div>
              <div>
                <dt className={cn(salesTypography.sectionLabel, "text-slate-500")}>
                  {C.expandIntervalTitle}
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {insight.orderIntervalLabel}
                </dd>
                {insight.vacationNote &&
                !next.secondary?.includes(insight.vacationNote) ? (
                  <dd className="mt-0.5 text-[0.7rem] text-amber-900">
                    {C.expandCycleNote(insight.vacationNote)}
                  </dd>
                ) : null}
              </div>
            </dl>

            {insight.vacationWindow ? (
              <div className="border-t border-slate-100 pt-2.5">
                <p className={cn(salesTypography.sectionLabel, "text-slate-500")}>
                  {C.expandVacationTitle}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <SupplierVacationNowChip window={insight.vacationWindow} />
                  <span className={salesTypography.rowMeta}>
                    {formatSupplierVacationRangeTitle(insight.vacationWindow)}
                  </span>
                </div>
              </div>
            ) : null}

            {insight.teethLine ? (
              <div className="border-t border-slate-100 pt-2.5">
                <p className={cn(salesTypography.sectionLabel, "text-slate-500")}>
                  {C.expandTeethTitle}
                </p>
                <p className={cn("mt-0.5", salesTypography.rowBody)}>
                  {C.expandTeethNext(insight.teethLine.nextOrderLabel)}
                  {insight.teethLine.etaLabel
                    ? C.expandTeethEta(insight.teethLine.etaLabel)
                    : C.expandTeethNoEta}
                </p>
              </div>
            ) : null}

            {insight.contactEmail ? (
              <div className="border-t border-slate-100 pt-2.5">
                <p className={cn(salesTypography.sectionLabel, "text-slate-500")}>
                  {C.expandContactTitle}
                </p>
                <a
                  href={`mailto:${insight.contactEmail}`}
                  className={cn(
                    "mt-0.5 inline-block font-medium text-indigo-700 hover:underline",
                    salesTypography.rowBody
                  )}
                >
                  {insight.contactEmail}
                </a>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2.5">
              {hasOpenRequests ? (
                <Link
                  href={previewHref("/moje")}
                  className={planLinkButtonClass("primary", "sm")}
                >
                  <IconClipboardList size={14} />
                  {C.ctaMyRequests(openOrderCount!)}
                </Link>
              ) : null}
              {!adminReadOnlyPreview ? (
                <Link
                  href={prosbaHref({
                    supplierId: insight.supplierId,
                    salesPersonId: previewDla ?? undefined,
                  })}
                  title={C.ctaNewForSupplierTitle(insight.name)}
                  className={planLinkButtonClass("secondary", "sm")}
                >
                  {C.ctaNewForSupplier}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function SalesPlanView(props: {
  workspace: SummaryWorkspaceData;
  suppliers: SupplierWithSchedule[];
  statsBySupplierId: Record<string, DeliveryStats>;
  etaUseP50?: boolean;
  etaQuantilesBySupplierId?: Record<
    string,
    import("@/lib/orders/delivery-eta-quantiles-load").DeliveryEtaSupplierQuantiles
  >;
  prioritySupplierIds: string[];
  openOrderCountBySupplier: Record<string, number>;
  tourPreview?: boolean;
  error?: string | null;
  pageTitle?: string;
  adminReadOnlyPreview?: boolean;
  teethOpenSupplierIds?: string[];
  teethScheduleBySupplierId?: Record<string, TeethSupplierSchedule>;
  teethHistoryEtaLabelBySupplierId?: Record<string, string>;
}) {
  return (
    <Suspense fallback={<SalesPlanViewFallback {...props} />}>
      <SalesPlanViewContent {...props} />
    </Suspense>
  );
}

function SalesPlanViewFallback({
  error = null,
  pageTitle = C.pageTitle,
}: Pick<ComponentProps<typeof SalesPlanViewContent>, "error" | "pageTitle">) {
  return (
    <div className={salesPageShellClass}>
      {error ? <Alert tone="warning">{error}</Alert> : null}
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title={pageTitle}
          hint={C.headerHint}
          hintAriaLabel={C.headerHintAria}
        />
        <div className="px-4 py-12 text-center text-sm text-slate-500">{C.loading}</div>
      </Card>
    </div>
  );
}

function SalesPlanViewContent({
  workspace,
  suppliers,
  statsBySupplierId,
  etaUseP50 = false,
  etaQuantilesBySupplierId = {},
  prioritySupplierIds,
  openOrderCountBySupplier,
  tourPreview = false,
  error = null,
  pageTitle = C.pageTitle,
  adminReadOnlyPreview = false,
  teethOpenSupplierIds = [],
  teethScheduleBySupplierId = {},
  teethHistoryEtaLabelBySupplierId = {},
}: {
  workspace: SummaryWorkspaceData;
  suppliers: SupplierWithSchedule[];
  statsBySupplierId: Record<string, DeliveryStats>;
  etaUseP50?: boolean;
  etaQuantilesBySupplierId?: Record<
    string,
    import("@/lib/orders/delivery-eta-quantiles-load").DeliveryEtaSupplierQuantiles
  >;
  prioritySupplierIds: string[];
  openOrderCountBySupplier: Record<string, number>;
  tourPreview?: boolean;
  error?: string | null;
  pageTitle?: string;
  adminReadOnlyPreview?: boolean;
  teethOpenSupplierIds?: string[];
  teethScheduleBySupplierId?: Record<string, TeethSupplierSchedule>;
  teethHistoryEtaLabelBySupplierId?: Record<string, string>;
}) {
  const previewHref = useSalesPreviewHref();
  const previewDla = useSearchParams().get("dla");
  const [query, setQuery] = useState("");

  const teethOpenSet = useMemo(
    () => new Set(teethOpenSupplierIds),
    [teethOpenSupplierIds]
  );

  const searchQuery = query.trim();
  const { searchMatches, searchTotalMatches } = useMemo(() => {
    if (!searchQuery) {
      return { searchMatches: [] as SupplierWithSchedule[], searchTotalMatches: 0 };
    }
    const all = matchSuppliersByQuery(suppliers, searchQuery);
    return {
      searchMatches: all.slice(0, SALES_PLAN_SEARCH_LIMIT),
      searchTotalMatches: all.length,
    };
  }, [suppliers, searchQuery]);

  const prioritySuppliers = useMemo(
    () => orderSalesPrioritySuppliers(suppliers, prioritySupplierIds),
    [suppliers, prioritySupplierIds]
  );

  const searchInsights = useMemo(() => {
    return searchMatches.map((s) =>
      buildSalesSupplierInsight(s, workspace.thisWeekDays, statsBySupplierId[s.id], {
        todayKey: workspace.todayDateKey,
        vacationWindow: workspace.suppliersOnVacationNow[s.id] ?? null,
        teethSchedule: teethScheduleBySupplierId[s.id] ?? null,
        hasOpenTeethRequest: teethOpenSet.has(s.id),
        teethHistoryEtaLabel: teethHistoryEtaLabelBySupplierId[s.id] ?? null,
        useP50: etaUseP50,
        quantiles:
          s.stats_mode === "OSOBNO"
            ? etaQuantilesBySupplierId[s.id]?.Glowne ?? null
            : etaQuantilesBySupplierId[s.id]?.LACZNIE ?? null,
        leadTimeDisplay: leadTimeDisplayFromQuantiles(
          etaQuantilesBySupplierId[s.id],
          etaUseP50
        ),
      })
    );
  }, [
    searchMatches,
    workspace.thisWeekDays,
    workspace.todayDateKey,
    workspace.suppliersOnVacationNow,
    statsBySupplierId,
    teethScheduleBySupplierId,
    teethHistoryEtaLabelBySupplierId,
    teethOpenSet,
    etaUseP50,
    etaQuantilesBySupplierId,
  ]);

  const myInsights = useMemo(() => {
    return prioritySuppliers.map((s) =>
      buildSalesSupplierInsight(s, workspace.thisWeekDays, statsBySupplierId[s.id], {
        todayKey: workspace.todayDateKey,
        vacationWindow: workspace.suppliersOnVacationNow[s.id] ?? null,
        teethSchedule: teethScheduleBySupplierId[s.id] ?? null,
        hasOpenTeethRequest: teethOpenSet.has(s.id),
        teethHistoryEtaLabel: teethHistoryEtaLabelBySupplierId[s.id] ?? null,
        useP50: etaUseP50,
        quantiles:
          s.stats_mode === "OSOBNO"
            ? etaQuantilesBySupplierId[s.id]?.Glowne ?? null
            : etaQuantilesBySupplierId[s.id]?.LACZNIE ?? null,
        leadTimeDisplay: leadTimeDisplayFromQuantiles(
          etaQuantilesBySupplierId[s.id],
          etaUseP50
        ),
      })
    );
  }, [
    prioritySuppliers,
    workspace.thisWeekDays,
    workspace.todayDateKey,
    workspace.suppliersOnVacationNow,
    statsBySupplierId,
    teethScheduleBySupplierId,
    teethHistoryEtaLabelBySupplierId,
    teethOpenSet,
    etaUseP50,
    etaQuantilesBySupplierId,
  ]);

  const openRequestCount = useMemo(
    () =>
      prioritySupplierIds.reduce(
        (sum, id) => sum + (openOrderCountBySupplier[id] ?? 0),
        0
      ),
    [prioritySupplierIds, openOrderCountBySupplier]
  );

  return (
    <div className={salesPageShellClass}>
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName="bg-indigo-100 text-indigo-800">
              <IconCalendar size={20} />
            </SectionHeadingIcon>
          }
          title={pageTitle}
          hint={C.headerHint}
          hintAriaLabel={C.headerHintAria}
          action={<PlanGuide />}
        />

        {error ? (
          <Alert tone="warning" className={cn(salesChromeInsetClass, "mt-0")}>
            {error}
          </Alert>
        ) : null}

        <NotatnikListFilterBar
          visibleLabel={C.searchVisibleLabel}
          value={query}
          onChange={setQuery}
          matchCount={searchQuery ? searchInsights.length : suppliers.length}
          totalCount={searchQuery ? searchTotalMatches : suppliers.length}
          placeholder={salesSearchPlaceholder(C.searchPlaceholder, false)}
          showIdleHint={false}
          showActiveDetail={false}
          emptyMatchHint={C.searchEmptyHint}
          searchLabel={C.searchAriaLabel}
          enableShortcut={false}
        />

        {searchQuery ? (
          <section aria-labelledby="sales-plan-search-results">
            <SectionListLabel
              id="sales-plan-search-results"
              title={C.searchSectionTitle}
              hint={C.searchSectionHint(searchQuery)}
              hintMode="tooltip"
              count={searchInsights.length || undefined}
              icon={<PlanSectionIcon kind="search" size={17} />}
              tileClassName={planSectionIconTileClass("search")}
            />
            {searchTotalMatches > SALES_PLAN_SEARCH_LIMIT ? (
              <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 sm:px-4">
                {C.searchLimitNote(SALES_PLAN_SEARCH_LIMIT, searchTotalMatches)}
              </p>
            ) : null}
            {searchInsights.length ? (
              <>
                <SalesPlanColumnHeader />
                <ul>
                  {searchInsights.map((insight, i) => (
                    <SalesSupplierRow
                      key={insight.supplierId}
                      insight={insight}
                      openOrderCount={openOrderCountBySupplier[insight.supplierId]}
                      defaultOpen={i === 0}
                      previewHref={previewHref}
                      previewDla={previewDla}
                      adminReadOnlyPreview={adminReadOnlyPreview}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <div className={cn("py-10", salesChromeInsetClass)}>
                <EmptyState
                  title={C.searchNotFoundTitle}
                  description={C.searchNotFoundBody}
                  icon={<PlanSectionIcon kind="search" size={28} />}
                />
              </div>
            )}
            <div
              className={cn(
                "border-t border-slate-100 bg-slate-50/80 py-2.5",
                salesChromeInsetClass
              )}
            >
              <button
                type="button"
                onClick={() => setQuery("")}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900"
              >
                <BackChevron className="text-indigo-600" />
                {C.searchBackToList}
              </button>
            </div>
          </section>
        ) : (
          <section aria-labelledby="sales-plan-my-suppliers">
            <SectionListLabel
              id="sales-plan-my-suppliers"
              title={C.openSectionTitle}
              hint={C.openSectionHint}
              hintMode="tooltip"
              count={openRequestCount || undefined}
              accent="indigo"
              icon={<PlanSectionIcon kind="prosby" size={17} />}
              tileClassName={planSectionIconTileClass("prosby")}
            />
            {myInsights.length ? (
              <>
                <SalesPlanColumnHeader />
                <ul>
                  {myInsights.map((insight, i) => (
                    <SalesSupplierRow
                      key={insight.supplierId}
                      insight={insight}
                      openOrderCount={openOrderCountBySupplier[insight.supplierId]}
                      defaultOpen={i === 0 && myInsights.length <= 3}
                      previewHref={previewHref}
                      previewDla={previewDla}
                      adminReadOnlyPreview={adminReadOnlyPreview}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <div className={cn("py-10 text-center", salesChromeInsetClass)}>
                <EmptyState
                  title={C.openEmptyTitle}
                  description={C.openEmptyBody}
                  icon={<IconClipboardList size={28} strokeWidth={1.75} />}
                />
              </div>
            )}
          </section>
        )}

        {!tourPreview ? (
          <SalesPlanWeekStrip
            thisWeekDays={workspace.thisWeekDays}
            nextWeekDays={workspace.nextWeekDays}
            prioritySupplierIds={prioritySupplierIds}
          />
        ) : null}

        <div
          className={cn(
            "flex flex-col gap-2.5 border-t border-slate-100 bg-slate-50/90 py-3 sm:flex-row sm:items-center sm:justify-between",
            salesChromeInsetClass
          )}
        >
          <p className="text-xs leading-relaxed text-slate-500">
            {adminReadOnlyPreview ? (
              C.footerAdmin
            ) : (
              <>
                {C.footerDefaultPrefix}
                <Link
                  href={previewHref("/moje")}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {C.ctaMyOrders}
                </Link>
                {C.footerDefaultSuffix}
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {!adminReadOnlyPreview ? (
              <Link
                href={previewHref("/prosba")}
                className={cn(planLinkButtonClass("primary"), "gap-1.5")}
              >
                <IconPlusCircle size={16} />
                {C.ctaNewRequest}
              </Link>
            ) : null}
            <Link
              href={previewHref("/moje")}
              className={cn(planLinkButtonClass("secondary"), "gap-1.5")}
            >
              <IconClipboardList size={16} />
              {C.ctaMyOrders}
            </Link>
          </div>
        </div>
      </Card>
      <AppBrandContentFooter mobileOnly variant="page" />
    </div>
  );
}
