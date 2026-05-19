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
        "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-shadow",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
        tone === "action" && "bg-emerald-600 text-white",
        tone === "success" && "bg-sky-100 text-sky-900",
        tone === "warning" && "bg-amber-100 text-amber-900",
        tone === "info" && "bg-indigo-100 text-indigo-900",
        tone === "neutral" && "bg-slate-100 text-slate-700",
        tone === "purple" && "bg-violet-100 text-violet-900",
        active && "ring-2 ring-indigo-400 ring-offset-1",
        !active && tone === "success" && "ring-1 ring-sky-200",
        !active && tone === "warning" && "ring-1 ring-amber-200",
        !active && tone === "info" && "ring-1 ring-indigo-200",
        !active && tone === "neutral" && "ring-1 ring-slate-200",
        !active && tone === "purple" && "ring-1 ring-violet-200"
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
    <div className="space-y-2 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      {hasAction ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Zrób teraz
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip
              count={summary.pickupCount}
              label="Odbiór z magazynu"
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
              label="Dostępne (informacja)"
              tone="success"
              filter="informacja_ready"
              {...chipProps}
            />
          </div>
        </div>
      ) : null}
      {hasWatch ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Na bieżąco
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip
              count={summary.overdueCount}
              label="Po terminie"
              tone="warning"
              filter="overdue"
              {...chipProps}
            />
            <Chip
              count={summary.verificationCount}
              label="Uzupełniamy dane"
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
              label="Czeka na towar"
              tone="purple"
              filter="availability_pending"
              {...chipProps}
            />
          </div>
        </div>
      ) : null}
      <p className="text-[11px] leading-snug text-slate-500">
        {activeFilter
          ? "Filtr włączony — kliknij ten sam chip ponownie, aby wrócić do pełnej listy."
          : "Opcjonalny filtr — bez wyboru widać wszystkie aktywne karty."}
      </p>
    </div>
  );
}
