"use client";

import type { MyOrdersInboxSummary } from "@/lib/orders/my-order-sales-ui";
import type { MyOrderInboxFilter } from "@/lib/orders/my-order-inbox-filter";
import { cn } from "@/lib/cn";

function Chip({
  count,
  label,
  tone,
  filter,
  activeFilter,
  onSelect,
}: {
  count: number;
  label: string;
  tone: "action" | "warning" | "info" | "neutral" | "success" | "purple";
  filter: MyOrderInboxFilter;
  activeFilter: MyOrderInboxFilter | null;
  onSelect: (filter: MyOrderInboxFilter | null) => void;
}) {
  if (count <= 0) return null;
  const active = activeFilter === filter;
  return (
    <button
      type="button"
      onClick={() => onSelect(active ? null : filter)}
      className={cn(
        "inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold transition-shadow",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
        tone === "action" && "bg-emerald-600 text-white",
        tone === "success" && "bg-indigo-50 text-indigo-900",
        tone === "warning" && "bg-amber-100 text-amber-900",
        tone === "info" && "bg-indigo-100 text-indigo-900",
        tone === "neutral" && "bg-slate-100 text-slate-700",
        tone === "purple" && "bg-violet-100 text-violet-900",
        active && "ring-2 ring-indigo-400 ring-offset-1"
      )}
    >
      <span className="tabular-nums">{count}</span>
      {label}
    </button>
  );
}

export function MyOrdersInboxSummary({
  summary,
  activeFilter,
  onFilterChange,
}: {
  summary: MyOrdersInboxSummary;
  activeFilter: MyOrderInboxFilter | null;
  onFilterChange: (filter: MyOrderInboxFilter | null) => void;
}) {
  const hasAction =
    summary.pickupCount > 0 ||
    summary.partialReadyCount > 0 ||
    summary.informacjaReadyCount > 0;

  const hasWatch =
    summary.overdueCount > 0 ||
    summary.verificationCount > 0 ||
    summary.przedZamowieniemCount > 0 ||
    summary.zamowioneCount > 0 ||
    summary.availabilityPendingCount > 0;

  if (!hasAction && !hasWatch) return null;

  const chipProps = {
    activeFilter,
    onSelect: onFilterChange,
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 sm:px-4">
      {hasAction ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-800">
            Teraz
          </span>
          <Chip
            count={summary.pickupCount}
            label="Odbiór"
            tone="action"
            filter="pickup"
            {...chipProps}
          />
          <Chip
            count={summary.partialReadyCount}
            label="Część na magazynie"
            tone="warning"
            filter="partial"
            {...chipProps}
          />
          <Chip
            count={summary.informacjaReadyCount}
            label="Informacja"
            tone="success"
            filter="informacja_ready"
            {...chipProps}
          />
        </div>
      ) : null}
      {hasWatch ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
            Status
          </span>
          <Chip
            count={summary.overdueCount}
            label="Po terminie"
            tone="warning"
            filter="overdue"
            {...chipProps}
          />
          <Chip
            count={summary.verificationCount}
            label="Uzupełniamy"
            tone="info"
            filter="verification"
            {...chipProps}
          />
          <Chip
            count={summary.przedZamowieniemCount}
            label="Przed zamówieniem"
            tone="purple"
            filter="przed_zamowieniem"
            {...chipProps}
          />
          <Chip
            count={summary.zamowioneCount}
            label="Zamówione"
            tone="info"
            filter="zamowione"
            {...chipProps}
          />
          <Chip
            count={summary.availabilityPendingCount}
            label="Czeka"
            tone="purple"
            filter="availability_pending"
            {...chipProps}
          />
        </div>
      ) : null}
      {activeFilter ? (
        <button
          type="button"
          onClick={() => onFilterChange(null)}
          className="ml-auto text-xs font-medium text-indigo-700 hover:text-indigo-900"
        >
          Wyczyść filtr
        </button>
      ) : null}
    </div>
  );
}
