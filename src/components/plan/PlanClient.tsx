"use client";

import { useMemo, useState } from "react";
import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";
import type { SupplierWithSchedule } from "@/types/database";
import { WeekPlanner } from "@/components/summary/WeekPlanner";
import { formatPlDate, locationLabel } from "@/lib/display-labels";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import {
  buildSupplierPlanInsight,
  matchSuppliersByQuery,
  type SupplierPlanInsight,
} from "@/lib/orders/plan-preview";
import { SalesPlanView } from "@/components/plan/SalesPlanView";
import type { DeliveryStats } from "@/types/database";
import { cn } from "@/lib/cn";
import { useSalesOnboardingDemo } from "@/components/sales/SalesOnboardingContext";
import { buildOnboardingPlanDemo } from "@/lib/sales/sales-onboarding-demo-data";

const SEARCH_TABLE_LIMIT = 25;

export function PlanClient(props: {
  workspace: SummaryWorkspaceData;
  suppliers: SupplierWithSchedule[];
  mode?: "sales" | "full";
  prioritySupplierIds?: string[];
  openOrderCountBySupplier?: Record<string, number>;
  statsBySupplierId?: Record<string, DeliveryStats>;
}) {
  const tourDemo = useSalesOnboardingDemo("plan");
  const demo = useMemo(() => buildOnboardingPlanDemo(), []);
  const resolved = tourDemo
    ? {
        workspace: demo.workspace,
        suppliers: demo.suppliers,
        mode: "sales" as const,
        prioritySupplierIds: demo.prioritySupplierIds,
        openOrderCountBySupplier: demo.openOrderCountBySupplier,
        statsBySupplierId: demo.statsBySupplierId,
      }
    : props;

  if (resolved.mode === "sales") {
    return (
      <SalesPlanView
        workspace={resolved.workspace}
        suppliers={resolved.suppliers}
        statsBySupplierId={resolved.statsBySupplierId ?? {}}
        prioritySupplierIds={resolved.prioritySupplierIds ?? []}
        openOrderCountBySupplier={resolved.openOrderCountBySupplier ?? {}}
        tourPreview={tourDemo}
      />
    );
  }
  return <PlanPreviewClient {...resolved} />;
}

function PlanPreviewClient({
  workspace,
  suppliers,
  openOrderCountBySupplier = {},
}: {
  workspace: SummaryWorkspaceData;
  suppliers: SupplierWithSchedule[];
  openOrderCountBySupplier?: Record<string, number>;
}) {
  const [query, setQuery] = useState("");
  const searchQuery = query.trim();
  const searchMatches = useMemo(
    () => (searchQuery ? matchSuppliersByQuery(suppliers, searchQuery) : []),
    [suppliers, searchQuery]
  );

  const searchInsights = useMemo(
    () =>
      searchMatches.map((s) =>
        buildSupplierPlanInsight(s, workspace.thisWeekDays)
      ),
    [searchMatches, workspace.thisWeekDays]
  );

  const scheduleRows = useMemo(() => {
    const base = suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      location: s.location,
      nextDate: s.schedule?.computed_next_date ?? null,
      orderDate: s.schedule?.order_date ?? null,
    }));

    let rows = base;
    if (searchQuery) {
      const ids = new Set(searchMatches.map((s) => s.id));
      rows = base.filter((r) => ids.has(r.id));
    }

    const sorted = [...rows].sort((a, b) => {
      if (!a.nextDate && !b.nextDate) return a.name.localeCompare(b.name, "pl");
      if (!a.nextDate) return 1;
      if (!b.nextDate) return -1;
      return a.nextDate.localeCompare(b.nextDate);
    });

    if (searchQuery && sorted.length > SEARCH_TABLE_LIMIT) {
      return sorted.slice(0, SEARCH_TABLE_LIMIT);
    }
    return sorted;
  }, [suppliers, searchQuery, searchMatches]);

  const weekTitle = "Plan na ten tydzień";
  const weekDescription =
    "Pełny harmonogram zakupów — poniedziałek–piątek (tylko podgląd)";

  return (
    <div className="space-y-8">
      <WeekPlanner
        title={weekTitle}
        description={weekDescription}
        days={workspace.thisWeekDays}
        readOnly
      />

      <Card padding={false}>
        <CardHeader
          inset
          title="Harmonogram dostawców"
          description="Wyszukaj dostawcę i zobacz planowaną datę zamówienia"
        />
        <div className="space-y-4 border-b border-slate-100 px-4 pb-4 sm:px-6">
          <label className="block max-w-md">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Szukaj dostawcy
            </span>
            <Input
              type="search"
              placeholder="Wpisz nazwę dostawcy…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>

        {searchQuery && searchInsights.length > 0 ? (
          <ul className="space-y-3 border-b border-slate-100 px-6 py-4">
            {searchInsights.map((insight) => (
              <SupplierPlanSearchCard
                key={insight.supplierId}
                insight={insight}
                openOrderCount={openOrderCountBySupplier[insight.supplierId]}
              />
            ))}
          </ul>
        ) : null}

        {searchQuery && !searchInsights.length ? (
          <div className="mx-6 my-4">
            <EmptyState
              title="Nie znaleziono dostawcy"
              description="Sprawdź pisownię lub wpisz krótszy fragment nazwy."
            />
          </div>
        ) : null}

        {!searchQuery && !scheduleRows.length ? (
          <EmptyState title="Brak dostawców" />
        ) : null}

        {scheduleRows.length > 0 ? (
          <>
            {searchQuery && searchMatches.length > SEARCH_TABLE_LIMIT ? (
              <p className="px-6 pt-4 text-xs text-slate-500">
                Tabela: pierwsze {SEARCH_TABLE_LIMIT} z {searchMatches.length} dopasowań.
              </p>
            ) : null}
            <TableScroll>
              <DataTable>
                <thead>
                  <tr>
                    <th>Dostawca</th>
                    <th>Lokalizacja</th>
                    <th>Planowane zamówienie</th>
                    <th>Ostatnie zamówienie</th>
                    <th>W planie tygodnia</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleRows.map((row) => {
                    const supplier = suppliers.find((s) => s.id === row.id);
                    const insight = supplier
                      ? buildSupplierPlanInsight(supplier, workspace.thisWeekDays)
                      : null;
                    return (
                      <tr key={row.id}>
                        <td className="font-medium text-slate-900">{row.name}</td>
                        <td>{locationLabel(row.location)}</td>
                        <td className="tabular-nums">
                          {row.nextDate ? (
                            <span
                              className={
                                insight?.isOverdue ? "font-medium text-amber-800" : undefined
                              }
                            >
                              {formatPlDate(row.nextDate)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="tabular-nums">{formatPlDate(row.orderDate)}</td>
                        <td className="text-sm text-slate-600">
                          {insight?.weekDayLabel && insight.weekDateLabel
                            ? `${insight.weekDayLabel} · ${insight.weekDateLabel}`
                            : row.nextDate
                              ? "Poza tym tygodniem"
                              : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </TableScroll>
          </>
        ) : null}
      </Card>
    </div>
  );
}

function SupplierPlanSearchCard({
  insight,
  compact = false,
  openOrderCount,
}: {
  insight: SupplierPlanInsight;
  compact?: boolean;
  openOrderCount?: number;
}) {
  return (
    <li
      className={cn(
        "rounded-md border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 to-white shadow-sm",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3
            className={cn(
              "font-semibold text-slate-900",
              compact ? "text-sm" : "text-base"
            )}
          >
            {insight.name}
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">{locationLabel(insight.location)}</p>
          {openOrderCount && openOrderCount > 0 ? (
            <Link
              href="/moje"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 underline"
            >
              <span>
                Masz {openOrderCount}{" "}
                {openOrderCount === 1 ? "otwartą prośbę" : "otwarte prośby"}
              </span>
              <LinkChevron size={13} tone="brand" />
              <span>Moje zamówienia</span>
            </Link>
          ) : null}
        </div>
        {insight.isOverdue ? (
          <Badge variant="warning">Po terminie</Badge>
        ) : insight.weekDayLabel ? (
          <Badge variant="info">
            {insight.weekDayLabel} · {insight.weekDateLabel}
          </Badge>
        ) : null}
      </div>

      <dl
        className={cn(
          "mt-3 grid gap-3",
          compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"
        )}
      >
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Planowane zamówienie
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {formatPlDate(insight.nextDate) ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ostatnie zamówienie
          </dt>
          <dd className="mt-0.5 text-sm tabular-nums text-slate-800">
            {formatPlDate(insight.orderDate) ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            W kalendarzu tygodnia
          </dt>
          <dd className="mt-0.5 text-sm text-slate-800">
            {insight.weekDayLabel && insight.weekDateLabel
              ? `${insight.weekDayLabel} (${insight.weekDateLabel})`
              : insight.nextDate
                ? "Termin poza bieżącym tygodniem"
                : "Brak terminu"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Uwagi harmonogramu
          </dt>
          <dd className="mt-0.5 text-sm text-slate-800">
            {insight.vacationNote ?? "—"}
          </dd>
        </div>
      </dl>
    </li>
  );
}
