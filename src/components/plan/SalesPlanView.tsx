"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SummaryWorkspaceData, WeekDayPlan } from "@/lib/orders/summary-workspace";
import type { DeliveryStats, SupplierWithSchedule } from "@/types/database";
import { WeekPlanner } from "@/components/summary/WeekPlanner";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { locationLabel } from "@/lib/display-labels";
import {
  matchSuppliersByQuery,
  pickSalesPlanSupplierIds,
} from "@/lib/orders/plan-preview";
import {
  buildSalesSupplierInsight,
  describeNextOrderForSales,
  type SalesSupplierInsight,
} from "@/lib/orders/sales-supplier-insight";
import { cn } from "@/lib/cn";

function PlanGuide() {
  return (
    <HelpPopover label="Jak korzystać" title="Harmonogram zakupów" shortLabel="Pomoc">
      <p className="mb-2">
        <strong className="font-medium text-slate-800">Wyszukaj dostawcę</strong>, aby zobaczyć
        termin kolejnego zamówienia i średni czas dostawy na magazyn.
      </p>
      <p className="mb-2">
        U góry strony możesz rozwinąć{" "}
        <strong className="font-medium text-slate-800">plan zamówień działu dostaw</strong> (pon.–pt.)
        — to nie jest termin dotarcia Twojego towaru.
      </p>
      <p>
        Średni czas pochodzi z historii realizacji (dni robocze od zamówienia u dostawcy do
        magazynu).
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
          description="Kalendarz pon.–pt. — kiedy dział składa zamówienia u dostawców (nie termin Twojego towaru na magazynie)."
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
              className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              Pokaż kalendarz tygodnia
            </button>
          </div>
        )}
      </Card>
    </section>
  );
}

function SectionHeading({
  title,
  description,
  count,
}: {
  title: string;
  description?: string;
  count?: number;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{description}</p>
        ) : null}
      </div>
      {count !== undefined && count > 0 ? (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
          {count}
        </span>
      ) : null}
    </div>
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
  const searchMatches = useMemo(
    () => (searchQuery ? matchSuppliersByQuery(suppliers, searchQuery) : []),
    [suppliers, searchQuery]
  );

  const mySupplierIds = useMemo(
    () => pickSalesPlanSupplierIds(suppliers, prioritySupplierIds, 12),
    [suppliers, prioritySupplierIds]
  );

  const searchInsights = useMemo(
    () =>
      searchMatches.map((s) =>
        buildSalesSupplierInsight(s, workspace.thisWeekDays, statsBySupplierId[s.id])
      ),
    [searchMatches, workspace.thisWeekDays, statsBySupplierId]
  );

  const myInsights = useMemo(() => {
    return [...mySupplierIds]
      .map((id) => suppliers.find((s) => s.id === id))
      .filter((s): s is SupplierWithSchedule => Boolean(s))
      .map((s) =>
        buildSalesSupplierInsight(s, workspace.thisWeekDays, statsBySupplierId[s.id])
      );
  }, [mySupplierIds, suppliers, workspace.thisWeekDays, statsBySupplierId]);

  const showMySuppliers = !searchQuery && myInsights.length > 0;

  return (
    <div className="space-y-8">
      <ProcurementPlanCollapsible
        open={showProcurementPlan}
        onOpenChange={setShowProcurementPlan}
        days={workspace.thisWeekDays}
      />

      <Card padding={false} className="overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50/90 via-white to-white px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600/90">
                Wyszukiwanie
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                Znajdź dostawcę
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
                Termin kolejnego zamówienia u dostawcy i średni czas dostawy na magazyn.
              </p>
            </div>
            <PlanGuide />
          </div>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <Field label="Nazwa dostawcy" className="max-w-xl">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <SearchIcon />
              </span>
              <Input
                type="search"
                placeholder="Wpisz nazwę dostawcy…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                className="border-indigo-200/80 bg-indigo-50/40 pl-10 focus:bg-white"
              />
            </div>
          </Field>
        </div>
      </Card>

      {searchQuery ? (
        <section className="space-y-4">
          <SectionHeading
            title="Wyniki wyszukiwania"
            description={
              searchInsights.length
                ? `Dla „${searchQuery}”`
                : undefined
            }
            count={searchInsights.length || undefined}
          />
          {searchInsights.length ? (
            <ul className="space-y-3">
              {searchInsights.map((insight) => (
                <SupplierInsightCard
                  key={insight.supplierId}
                  insight={insight}
                  openOrderCount={openOrderCountBySupplier[insight.supplierId]}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Nie znaleziono dostawcy"
              description="Sprawdź pisownię lub wpisz krótszy fragment nazwy."
            />
          )}
        </section>
      ) : showMySuppliers ? (
        <section className="space-y-4">
          <SectionHeading
            title="Twoi dostawcy"
            description="Z aktywnych prośb w „Moje zamówienia” — lub wyszukaj innego powyżej."
            count={myInsights.length}
          />
          <ul className="space-y-3">
            {myInsights.map((insight) => (
              <SupplierInsightCard
                key={insight.supplierId}
                insight={insight}
                openOrderCount={openOrderCountBySupplier[insight.supplierId]}
                highlight
              />
            ))}
          </ul>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center sm:py-10">
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-600">
            Wpisz nazwę dostawcy w polu powyżej, aby zobaczyć terminy zamówień i orientacyjny czas
            realizacji na magazyn.
          </p>
        </div>
      )}

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

function StatTile({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl bg-slate-50/90 p-3 ring-1 ring-slate-200/70", className)}>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1.5 space-y-0.5">{children}</div>
    </div>
  );
}

function SupplierInsightCard({
  insight,
  openOrderCount,
  highlight = false,
}: {
  insight: SalesSupplierInsight;
  openOrderCount?: number;
  highlight?: boolean;
}) {
  const next = describeNextOrderForSales(insight);

  return (
    <li>
      <article
        className={cn(
          "overflow-hidden rounded-2xl border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
          highlight
            ? "border-indigo-200/90 ring-1 ring-indigo-100/80"
            : "border-slate-200/90"
        )}
      >
        <div
          className={cn(
            "border-b border-slate-100 px-4 py-4 sm:px-5",
            highlight && "bg-gradient-to-r from-indigo-50/50 to-white"
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                {insight.name}
              </h3>
              <p className="mt-0.5 text-sm text-slate-600">{locationLabel(insight.location)}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {insight.isOverdue ? <Badge variant="warning">Po terminie</Badge> : null}
              {insight.orderOnDemand ? (
                <Badge variant="default">Na żądanie</Badge>
              ) : insight.weekDayLabel ? (
                <Badge variant="info">
                  {insight.weekDayLabel} · {insight.weekDateLabel}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 sm:px-5">
          <div className="rounded-xl border border-indigo-100/80 bg-indigo-50/50 px-3.5 py-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-700/80">
              Kolejne zamówienie u dostawcy
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{next.primary}</p>
            {next.secondary ? (
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{next.secondary}</p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <StatTile label="Średni czas na magazyn">
              <p className="text-sm font-semibold text-slate-900">
                {insight.leadTimeSummary ?? "—"}
              </p>
              {insight.leadTimeDetail ? (
                <p className="text-xs text-slate-600">{insight.leadTimeDetail}</p>
              ) : null}
              {insight.leadTimeLowConfidence && insight.sampleCount > 0 ? (
                <p className="text-xs font-medium text-amber-800">
                  Mało historii — szacunek orientacyjny
                </p>
              ) : null}
            </StatTile>
            <StatTile label="Interwał zamówień">
              <p className="text-sm font-medium text-slate-900">{insight.orderIntervalLabel}</p>
              {insight.vacationNote && !next.secondary?.includes(insight.vacationNote) ? (
                <p className="text-xs text-amber-900">{insight.vacationNote}</p>
              ) : null}
            </StatTile>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:px-5">
          {openOrderCount && openOrderCount > 0 ? (
            <Link
              href="/moje"
              className="inline-flex min-h-9 items-center rounded-lg bg-white px-3 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-200/80 transition hover:bg-indigo-50"
            >
              {openOrderCount}{" "}
              {openOrderCount === 1 ? "otwarta prośba" : "otwarte prośby"}
            </Link>
          ) : null}
          <Link
            href="/prosba"
            className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-900"
          >
            Zgłoś prośbę u tego dostawcy
          </Link>
        </div>
      </article>
    </li>
  );
}
