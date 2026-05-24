"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SummaryWorkspaceData, WeekDayPlan } from "@/lib/orders/summary-workspace";
import type { DeliveryStats, SupplierWithSchedule } from "@/types/database";
import { WeekPlanner } from "@/components/summary/WeekPlanner";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { HelpPopover } from "@/components/ui/HelpPopover";
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
import { cn } from "@/lib/cn";

function PlanGuide() {
  return (
    <HelpPopover label="Jak korzystać" title="Harmonogram zakupów" shortLabel="Pomoc">
      <p className="mb-2">
        Na liście widać dostawców z <strong className="font-medium text-slate-800">otwartych prośb</strong>{" "}
        w „Moje zamówienia”. Rozwiń wiersz po szczegóły terminu i czasu realizacji.
      </p>
      <p className="mb-2">
        <strong className="font-medium text-slate-800">Wyszukiwarka</strong> w tej samej sekcji służy do
        każdego innego dostawcy w bazie.
      </p>
      <p>
        U góry strony możesz rozwinąć kalendarz działu dostaw (pon.–pt.) — to kiedy dział składa
        zamówienia, nie kiedy towar trafi na magazyn.
      </p>
    </HelpPopover>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg
      className={cn(
        "h-4 w-4 shrink-0 text-slate-400 transition-transform",
        open && "rotate-180"
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PROCUREMENT_PLAN_SECTION_ID = "plan-zamowien-dzialu";

function ProcurementPlanCollapsible({
  open,
  onOpenChange,
  days,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: WeekDayPlan[];
}) {
  return (
    <section id={PROCUREMENT_PLAN_SECTION_ID}>
      <Card padding={false}>
        <CardHeader
          inset
          title="Plan zamówień działu dostaw"
          description="Kalendarz pon.–pt. — kiedy dział składa zamówienia (nie termin towaru na magazynie)."
        />
        {open ? (
          <div className="space-y-3 border-t border-slate-100 px-4 pb-5 sm:px-6">
            <WeekPlanner
              title="Ten tydzień"
              description="Poniedziałek–piątek · podgląd harmonogramu zakupów"
              days={days}
              readOnly
            />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
            >
              Ukryj kalendarz
            </button>
          </div>
        ) : (
          <div className="border-t border-slate-100 px-4 pb-5 sm:px-6">
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              Pokaż kalendarz tygodnia działu dostaw
            </button>
          </div>
        )}
      </Card>
    </section>
  );
}

function ListSectionLabel({
  id,
  title,
  hint,
  count,
}: {
  id: string;
  title: string;
  hint?: string;
  count?: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 sm:px-5">
      <div className="min-w-0">
        <h3
          id={id}
          className="text-xs font-semibold uppercase tracking-wide text-slate-700"
        >
          {title}
        </h3>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
      {count !== undefined && count > 0 ? (
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200/80">
          {count}
        </span>
      ) : null}
    </div>
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
}: {
  insight: SalesSupplierInsight;
  openOrderCount?: number;
  defaultOpen?: boolean;
  variant?: "list" | "search";
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const next = describeNextOrderForSales(insight);
  const summary = nextOrderSummary(insight);
  const hasOpenRequests = Boolean(openOrderCount && openOrderCount > 0);

  return (
    <li
      className={cn(
        "border-b border-slate-200/70 transition-[background-color,box-shadow,margin] duration-200 last:border-b-0",
        expanded
          ? "z-[1] mx-1.5 my-2 rounded-xl border border-indigo-200/90 bg-indigo-50/80 shadow-md shadow-indigo-100/50 ring-1 ring-indigo-100 last:border-b"
          : hasOpenRequests && "bg-indigo-50/30"
      )}
    >
      <div
        className={cn(
          "flex items-stretch gap-1 sm:gap-2",
          expanded && "rounded-t-xl border-b border-indigo-200/50 bg-indigo-100/40"
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors sm:gap-3 sm:px-4 sm:py-3",
            expanded ? "hover:bg-indigo-100/50" : "hover:bg-white/80"
          )}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Zwiń" : "Rozwiń"} szczegóły: ${insight.name}`}
        >
          <ChevronIcon open={expanded} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "truncate text-slate-900",
                  expanded ? "font-semibold" : "font-medium"
                )}
              >
                {insight.name}
              </span>
              <span className="text-xs text-slate-500">{locationLabel(insight.location)}</span>
            </div>
            <p className="mt-0.5 truncate text-sm text-slate-600 sm:hidden">{summary}</p>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <p className="max-w-[11rem] truncate text-sm font-medium text-slate-800">{summary}</p>
            {hasOpenRequests ? (
              <p className="mt-0.5 text-xs font-medium text-indigo-700">
                {openOrderCount}{" "}
                {openOrderCount === 1 ? "otwarta pozycja" : "otwarte pozycje"}
              </p>
            ) : variant === "search" ? (
              <p className="mt-0.5 text-xs text-slate-500">Harmonogram</p>
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
              {openOrderCount} {openOrderCount === 1 ? "poz." : "poz."}
            </Badge>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="rounded-b-xl border-t border-indigo-200/40 bg-indigo-100/25 px-3 pb-3 pt-2 sm:px-4 sm:pb-3.5">
          <div className="rounded-lg border border-indigo-200/70 bg-white/95 p-3 shadow-sm">
            <div className="border-b border-indigo-100 pb-2.5">
              <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-indigo-700">
                Kolejne zamówienie u dostawcy
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">
                {next.primary}
              </p>
              {next.secondary ? (
                <p className="mt-0.5 text-xs leading-snug text-slate-600">{next.secondary}</p>
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
                <Link
                  href="/moje"
                  className="inline-flex min-h-8 items-center rounded-md bg-indigo-600 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Moje prośby ({openOrderCount})
                </Link>
              ) : null}
              <Link
                href={prosbaHref({ supplierId: insight.supplierId })}
                className="inline-flex min-h-8 items-center rounded-md px-2.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                Zgłoś prośbę
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function SalesPlanView({
  workspace,
  suppliers,
  statsBySupplierId,
  prioritySupplierIds,
  openOrderCountBySupplier,
}: {
  workspace: SummaryWorkspaceData;
  suppliers: SupplierWithSchedule[];
  statsBySupplierId: Record<string, DeliveryStats>;
  prioritySupplierIds: string[];
  openOrderCountBySupplier: Record<string, number>;
}) {
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
    <div className="space-y-6">
      <ProcurementPlanCollapsible
        open={showProcurementPlan}
        onOpenChange={setShowProcurementPlan}
        days={workspace.thisWeekDays}
      />

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          title="Dostawcy i terminy"
          description="Twoje otwarte prośby poniżej — każdy inny dostawca wyszukaj w polu."
          action={<PlanGuide />}
        />

        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <label className="block">
            <span className="sr-only">Szukaj dostawcy</span>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <SearchIcon />
              </span>
              <Input
                type="search"
                placeholder="Inny dostawca — wpisz fragment nazwy…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                className="border-slate-200 bg-slate-50/60 pl-9 focus:bg-white"
              />
            </div>
          </label>
        </div>

        {searchQuery ? (
          <section aria-labelledby="sales-plan-search-results">
            <ListSectionLabel
              id="sales-plan-search-results"
              title="Wyniki wyszukiwania"
              hint={`Dla „${searchQuery}”`}
              count={searchInsights.length || undefined}
            />
            {searchTotalMatches > SALES_PLAN_SEARCH_LIMIT ? (
              <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 sm:px-5">
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
                  />
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 sm:px-5">
                <EmptyState
                  title="Nie znaleziono dostawcy"
                  description="Sprawdź pisownię lub wpisz krótszy fragment nazwy."
                />
              </div>
            )}
            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-5">
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
              >
                ← Wróć do listy z prośbami
              </button>
            </div>
          </section>
        ) : (
          <section aria-labelledby="sales-plan-my-suppliers">
            <ListSectionLabel
              id="sales-plan-my-suppliers"
              title="Z otwartymi prośbami"
              hint="Te same karty co w „Moje zamówienia” (bez potwierdzenia odbioru)"
              count={openRequestCount || undefined}
            />
            {myInsights.length ? (
              <ul>
                {myInsights.map((insight, i) => (
                  <SalesSupplierRow
                    key={insight.supplierId}
                    insight={insight}
                    openOrderCount={openOrderCountBySupplier[insight.supplierId]}
                    defaultOpen={i === 0 && myInsights.length <= 3}
                  />
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center sm:px-5">
                <p className="text-sm font-medium text-slate-800">Brak otwartych prośb</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
                  Gdy zgłosisz zamówienie, dostawca pojawi się tutaj z terminem planowego zakupu.
                  Innego dostawcę znajdziesz w wyszukiwarce powyżej.
                </p>
              </div>
            )}
            {!searchQuery && myInsights.length > 0 ? (
              <div className="border-t border-dashed border-slate-200 bg-slate-50/40 px-4 py-3 sm:px-5">
                <p className="text-xs leading-relaxed text-slate-600">
                  Potrzebujesz innego dostawcy? Użyj{" "}
                  <span className="font-medium text-slate-700">wyszukiwarki na górze tej karty</span>{" "}
                  — zobaczysz ten sam układ szczegółów po rozwinięciu wiersza.
                </p>
              </div>
            ) : null}
          </section>
        )}
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
        <Link
          href="/prosba"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50/60 px-5 text-sm font-semibold text-indigo-800 transition hover:border-indigo-300 hover:bg-indigo-50"
        >
          Zgłoś nową prośbę
        </Link>
        <Link
          href="/moje"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          Moje zamówienia
        </Link>
      </div>
    </div>
  );
}
