"use client";

import { Suspense, useMemo, useState, type ComponentProps } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SummaryWorkspaceData, WeekDayPlan } from "@/lib/orders/summary-workspace";
import type { DeliveryStats, SupplierWithSchedule } from "@/types/database";
import { WeekPlanner } from "@/components/summary/WeekPlanner";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackChevron } from "@/components/ui/UiGlyphs";
import { Badge } from "@/components/ui/Badge";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
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
import { salesPageShellClass, salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";
import { Alert } from "@/components/ui/Alert";

const PLAN_INTRO =
  "Otwarte prośby, terminy u dostawców i wyszukiwarka — w jednym miejscu. Kalendarz działu dostaw to kiedy składamy zamówienia, nie kiedy towar jest na magazynie.";

function PlanGuide() {
  return (
    <HelpPopover
      label="Pomoc — harmonogram zakupów"
      title="Harmonogram"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
    >
      <HelpBlock title="Co tu jest">
        <p>{PLAN_INTRO}</p>
      </HelpBlock>

      <HelpBlock title="Z otwartymi prośbami">
        <p>
          Dostawcy z aktywnych wpisów w Moje zamówienia. Rozwiń wiersz po termin i czas
          realizacji.
        </p>
      </HelpBlock>

      <HelpBlock title="Wyszukiwarka">
        <p>Każdy inny dostawca z bazy — poza listą z otwartymi prośbami.</p>
      </HelpBlock>

      <HelpBlock title="Plan działu dostaw">
        <p>
          Harmonogram składania zamówień pon.–pt. — rozwiń u góry karty. To terminy zamówień u
          dostawców, nie daty odbioru towaru z magazynu.
        </p>
      </HelpBlock>
    </HelpPopover>
  );
}

function nextOrderSummary(insight: SalesSupplierInsight): string {
  if (insight.orderOnDemand) return "Na żądanie";
  if (insight.isOverdue) return "Po terminie";
  if (insight.weekDayLabel && insight.weekDateLabel) {
    return `${insight.weekDayLabel} ${insight.weekDateLabel}`;
  }
  if (insight.nextDate) {
    const short = insight.weekDateLabel;
    return short ? `Plan: ${short}` : "Poza tym tygodniem";
  }
  return "Brak terminu";
}

function SalesSupplierRow({
  insight,
  openOrderCount,
  defaultOpen = false,
  variant = "list",
  previewHref,
  previewDla,
}: {
  insight: SalesSupplierInsight;
  openOrderCount?: number;
  defaultOpen?: boolean;
  variant?: "list" | "search";
  previewHref: (href: string) => string;
  previewDla: string | null;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const next = describeNextOrderForSales(insight);
  const summary = nextOrderSummary(insight);
  const hasOpenRequests = Boolean(openOrderCount && openOrderCount > 0);

  return (
    <li
      className={cn(
        "border-b border-slate-100 transition-[background-color,box-shadow] duration-200 last:border-b-0",
        expanded
          ? "z-[1] bg-indigo-50/70 shadow-sm ring-1 ring-inset ring-indigo-200/80"
          : hasOpenRequests && "bg-indigo-50/25"
      )}
    >
      <div className="flex items-stretch gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left transition-colors sm:gap-2.5 sm:px-4",
            expanded ? "hover:bg-indigo-100/40" : "hover:bg-white/80"
          )}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Zwiń" : "Rozwiń"} szczegóły: ${insight.name}`}
        >
          <IconChevronDown
            open={expanded}
            className="shrink-0 text-slate-400"
            size={18}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={cn("truncate", salesTypography.rowTitle, !expanded && "font-medium")}>
                {insight.name}
              </span>
              <span className={salesTypography.rowMeta}>{locationLabel(insight.location)}</span>
            </div>
            <p className={cn("mt-0.5 truncate sm:hidden", salesTypography.rowBody)}>{summary}</p>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <p className={cn("max-w-[11rem] truncate font-medium text-slate-800", salesTypography.rowBody)}>
              {summary}
            </p>
            {hasOpenRequests ? (
              <p className={cn("mt-0.5 font-medium text-indigo-700", salesTypography.rowMeta)}>
                {openOrderCount}{" "}
                {openOrderCount === 1 ? "otwarta prośba" : "otwarte prośby"}
              </p>
            ) : variant === "search" ? (
              <p className={cn("mt-0.5", salesTypography.rowMeta, "text-slate-500")}>Harmonogram</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1 sm:hidden">
            {insight.isOverdue ? <Badge variant="warning">!</Badge> : null}
            {hasOpenRequests ? (
              <Badge variant="info">{openOrderCount}</Badge>
            ) : null}
          </div>
        </button>
        <div className="hidden shrink-0 flex-wrap items-center gap-1 self-center pr-3 sm:flex">
          {insight.isOverdue ? <Badge variant="warning">Po terminie</Badge> : null}
          {insight.orderOnDemand ? <Badge variant="default">Na żądanie</Badge> : null}
          {!insight.isOverdue && !insight.orderOnDemand && insight.weekDayLabel ? (
            <Badge variant="info" className="hidden lg:inline-flex">
              {insight.weekDayLabel}
            </Badge>
          ) : null}
          {hasOpenRequests ? (
            <Badge variant="info" className="tabular-nums">
              {openOrderCount} {openOrderCount === 1 ? "prośba" : "prośby"}
            </Badge>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-indigo-200/50 bg-white/60 px-3 pb-3 pt-2 sm:px-4 sm:pb-3.5">
          <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
            <div className="border-b border-slate-100 pb-2.5">
              <p className={cn(salesTypography.sectionLabel, "normal-case tracking-normal text-slate-500")}>
                Kolejne zamówienie u dostawcy
              </p>
              <p className={cn("mt-0.5 leading-snug", salesTypography.rowTitle)}>{next.primary}</p>
              {next.secondary ? (
                <p className={cn("mt-0.5 leading-snug", salesTypography.rowBody)}>{next.secondary}</p>
              ) : null}
            </div>

            <dl className="mt-2.5 grid gap-2 text-xs sm:grid-cols-2 sm:gap-x-4">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-slate-500">
                  Czas na magazyn
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {insight.leadTimeSummary ?? "—"}
                </dd>
                {insight.leadTimeDetail ? (
                  <dd className="mt-0.5 text-[0.7rem] text-slate-600">{insight.leadTimeDetail}</dd>
                ) : null}
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-slate-500">
                  Interwał
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">{insight.orderIntervalLabel}</dd>
                {insight.vacationNote && !next.secondary?.includes(insight.vacationNote) ? (
                  <dd className="mt-0.5 text-[0.7rem] text-amber-900">{insight.vacationNote}</dd>
                ) : null}
              </div>
            </dl>

            <div className="mt-2.5 flex flex-wrap gap-2 border-t border-slate-100 pt-2.5">
              {hasOpenRequests ? (
                <Link href={previewHref("/moje")}>
                  <Button size="sm" className="gap-1.5">
                    <IconClipboardList size={14} />
                    Moje prośby ({openOrderCount})
                  </Button>
                </Link>
              ) : null}
              <Link
                href={prosbaHref({
                  supplierId: insight.supplierId,
                  salesPersonId: previewDla ?? undefined,
                })}
                title={`Nowa prośba do: ${insight.name}`}
              >
                <Button size="sm" variant="secondary">
                  Zgłoś prośbę do dostawcy
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function ProcurementPlanBlock({
  open,
  onOpenChange,
  days,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: WeekDayPlan[];
}) {
  return (
    <div className={cn("border-b border-slate-100 py-3", salesChromeInsetClass)}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
        aria-expanded={open}
      >
        <SectionHeadingIcon tileClassName={planSectionIconTileClass("calendar")}>
          <IconCalendar size={18} />
        </SectionHeadingIcon>
        <span className="min-w-0 flex-1">
          <span className={cn("block", salesTypography.blockTitle)}>
            Plan zamówień działu dostaw
          </span>
          <span className={cn("mt-0.5 block", salesTypography.sectionHint)}>
            Kalendarz pon.–pt. — kiedy dział składa zamówienia (nie termin towaru na magazynie).
          </span>
        </span>
        <IconChevronDown open={open} className="mt-1 shrink-0 text-slate-400" size={18} />
      </button>
      {open ? (
        <div className="mt-4">
          <WeekPlanner
            embedded
            density="compact"
            title="Ten tydzień"
            days={days}
            readOnly
          />
        </div>
      ) : null}
    </div>
  );
}

export function SalesPlanView(props: {
  workspace: SummaryWorkspaceData;
  suppliers: SupplierWithSchedule[];
  statsBySupplierId: Record<string, DeliveryStats>;
  prioritySupplierIds: string[];
  openOrderCountBySupplier: Record<string, number>;
  tourPreview?: boolean;
  error?: string | null;
}) {
  return (
    <Suspense fallback={<SalesPlanViewFallback {...props} />}>
      <SalesPlanViewContent {...props} />
    </Suspense>
  );
}

function SalesPlanViewFallback({
  error = null,
}: Pick<ComponentProps<typeof SalesPlanViewContent>, "error">) {
  return (
    <div className={salesPageShellClass}>
      {error ? <Alert tone="warning">{error}</Alert> : null}
      <Card padding={false} className="overflow-hidden">
        <CardHeader inset density="compact" title="Harmonogram" description={PLAN_INTRO} />
        <div className="px-4 py-12 text-center text-sm text-slate-500">Ładowanie…</div>
      </Card>
    </div>
  );
}

function SalesPlanViewContent({
  workspace,
  suppliers,
  statsBySupplierId,
  prioritySupplierIds,
  openOrderCountBySupplier,
  tourPreview = false,
  error = null,
}: {
  workspace: SummaryWorkspaceData;
  suppliers: SupplierWithSchedule[];
  statsBySupplierId: Record<string, DeliveryStats>;
  prioritySupplierIds: string[];
  openOrderCountBySupplier: Record<string, number>;
  tourPreview?: boolean;
  error?: string | null;
}) {
  const previewHref = useSalesPreviewHref();
  const previewDla = useSearchParams().get("dla");
  const [query, setQuery] = useState("");
  const [showProcurementPlan, setShowProcurementPlan] = useState(false);

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

  const searchInsights = useMemo(
    () =>
      searchMatches.map((s) =>
        buildSalesSupplierInsight(s, workspace.thisWeekDays, statsBySupplierId[s.id])
      ),
    [searchMatches, workspace.thisWeekDays, statsBySupplierId]
  );

  const myInsights = useMemo(
    () =>
      prioritySuppliers.map((s) =>
        buildSalesSupplierInsight(s, workspace.thisWeekDays, statsBySupplierId[s.id])
      ),
    [prioritySuppliers, workspace.thisWeekDays, statsBySupplierId]
  );

  const openRequestCount = myInsights.length;

  return (
    <div className={salesPageShellClass}>
      {error ? (
        <Alert tone="warning">{error}</Alert>
      ) : null}
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName="bg-indigo-100 text-indigo-800">
              <IconCalendar size={20} />
            </SectionHeadingIcon>
          }
          title="Harmonogram"
          description={PLAN_INTRO}
          action={<PlanGuide />}
        />

        {!tourPreview ? (
          <ProcurementPlanBlock
            open={showProcurementPlan}
            onOpenChange={setShowProcurementPlan}
            days={workspace.thisWeekDays}
          />
        ) : null}

        <div className={cn("border-b border-slate-100", salesChromeInsetClass, "py-3")}>
          <ProsbaFormSection
            title="Szukaj dostawcy"
            hint="Każdy dostawca z bazy — ten sam układ szczegółów po rozwinięciu wiersza."
          >
            <label className="block">
              <span className="sr-only">Szukaj dostawcy</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <PlanSectionIcon kind="search" size={18} />
                </span>
                <Input
                  type="search"
                  placeholder="Wpisz fragment nazwy…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  className="border-slate-200 bg-white pl-10 focus:bg-white"
                />
              </div>
            </label>
          </ProsbaFormSection>
        </div>

        {searchQuery ? (
          <section aria-labelledby="sales-plan-search-results">
            <SectionListLabel
              id="sales-plan-search-results"
              title="Wyniki wyszukiwania"
              hint={`Dla „${searchQuery}”`}
              count={searchInsights.length || undefined}
              icon={<PlanSectionIcon kind="search" size={17} />}
              tileClassName={planSectionIconTileClass("search")}
            />
            {searchTotalMatches > SALES_PLAN_SEARCH_LIMIT ? (
              <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 sm:px-4">
                Pokazano pierwsze {SALES_PLAN_SEARCH_LIMIT} z {searchTotalMatches} dopasowań.
              </p>
            ) : null}
            {searchInsights.length ? (
              <ul>
                {searchInsights.map((insight, i) => (
                  <SalesSupplierRow
                    key={insight.supplierId}
                    insight={insight}
                    openOrderCount={openOrderCountBySupplier[insight.supplierId]}
                    defaultOpen={i === 0}
                    variant="search"
                    previewHref={previewHref}
                    previewDla={previewDla}
                  />
                ))}
              </ul>
            ) : (
              <div className={cn("py-10", salesChromeInsetClass)}>
                <EmptyState
                  title="Nie znaleziono dostawcy"
                  description="Sprawdź pisownię lub wpisz krótszy fragment nazwy."
                  icon={<PlanSectionIcon kind="search" size={28} />}
                />
              </div>
            )}
            <div className={cn("border-t border-slate-100 bg-slate-50/80 py-2.5", salesChromeInsetClass)}>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900"
              >
                <BackChevron className="text-indigo-600" />
                Wróć do listy z prośbami
              </button>
            </div>
          </section>
        ) : (
          <section aria-labelledby="sales-plan-my-suppliers">
            <SectionListLabel
              id="sales-plan-my-suppliers"
              title="Z otwartymi prośbami"
              hint="Te same dostawcy co w „Moje zamówienia” — rozwiń wiersz po szczegóły."
              count={openRequestCount || undefined}
              accent="indigo"
              icon={<PlanSectionIcon kind="prosby" size={17} />}
              tileClassName={planSectionIconTileClass("prosby")}
            />
            {myInsights.length ? (
              <ul>
                {myInsights.map((insight, i) => (
                  <SalesSupplierRow
                    key={insight.supplierId}
                    insight={insight}
                    openOrderCount={openOrderCountBySupplier[insight.supplierId]}
                    defaultOpen={i === 0 && myInsights.length <= 3}
                    previewHref={previewHref}
                    previewDla={previewDla}
                  />
                ))}
              </ul>
            ) : (
              <div className={cn("py-10 text-center", salesChromeInsetClass)}>
                <EmptyState
                  title="Brak otwartych prośb"
                  description="Gdy zgłosisz prośbę, dostawca pojawi się tutaj z terminem planowego zakupu. Innego dostawcę znajdziesz w wyszukiwarce powyżej."
                  icon={<IconClipboardList size={28} strokeWidth={1.75} />}
                />
              </div>
            )}
          </section>
        )}

        <div className={cn("flex flex-col gap-2.5 border-t border-slate-100 bg-slate-50/90 py-3 sm:flex-row sm:items-center sm:justify-between", salesChromeInsetClass)}>
          <p className="text-xs leading-relaxed text-slate-500">
            Zgłoś nową prośbę lub sprawdź status w{" "}
            <Link href={previewHref("/moje")} className="font-medium text-indigo-700 hover:underline">
              Moje zamówienia
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={previewHref("/prosba")}>
              <Button className="gap-1.5">
                <IconPlusCircle size={16} />
                Nowa prośba
              </Button>
            </Link>
            <Link href={previewHref("/moje")}>
              <Button variant="secondary" className="gap-1.5">
                <IconClipboardList size={16} />
                Moje zamówienia
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
