"use client";

import type { MyOrdersInboxSummary } from "@/lib/orders/my-order-sales-ui";
import {
  inboxFilterGroup,
  inboxFilterLabel,
  type MyOrderInboxFilter,
} from "@/lib/orders/my-order-inbox-filter";
import { cn } from "@/lib/cn";
import {
  brandLinkClass,
  mojeFilterChipActiveClass,
  mojeFilterChipInfoClass,
  mojeFilterChipSuccessClass,
} from "@/lib/ui/ontime-theme";
import { IconCircleCheck, IconClock } from "@/components/icons/StrokeIcons";
import { INFORMACJA_FLOW_MY_ORDERS_HINT } from "@/lib/orders/informacja-flow-copy";

function GroupChip({
  count,
  label,
  active,
  onClick,
}: {
  count: number;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-shadow",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
        active
          ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300/80"
          : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
      )}
    >
      <span className="tabular-nums">{count}</span>
      {label}
    </button>
  );
}

function SubChip({
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
  const groupFilter = inboxFilterGroup(filter) === "action" ? "action_group" : "watch_group";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(active ? groupFilter : filter)}
      className={cn(
        "inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-shadow",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
        tone === "action" && "bg-emerald-600 text-white",
        tone === "success" && mojeFilterChipSuccessClass,
        tone === "warning" && "bg-amber-100 text-amber-900",
        tone === "info" && mojeFilterChipInfoClass,
        tone === "neutral" && "bg-slate-100 text-slate-700",
        tone === "purple" && "bg-violet-100 text-violet-900",
        active && mojeFilterChipActiveClass
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
  const actionCount =
    summary.pickupCount +
    summary.partialReadyCount +
    summary.cancelAckCount +
    summary.informacjaReadyCount;

  const watchCount =
    summary.overdueCount +
    summary.verificationCount +
    summary.przedZamowieniemCount +
    summary.zamowioneCount +
    summary.availabilityPendingCount;

  if (actionCount <= 0 && watchCount <= 0) return null;

  const activeGroup = inboxFilterGroup(activeFilter);
  const showActionSub = activeGroup === "action";
  const showWatchSub = activeGroup === "watch";

  const chipProps = {
    activeFilter,
    onSelect: onFilterChange,
  };

  return (
    <div className="space-y-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <GroupChip
          count={actionCount}
          label="Wymaga reakcji"
          active={activeFilter === "action_group" || showActionSub}
          onClick={() =>
            onFilterChange(
              activeFilter === "action_group" || showActionSub ? null : "action_group"
            )
          }
        />
        <GroupChip
          count={watchCount}
          label="W toku"
          active={activeFilter === "watch_group" || showWatchSub}
          onClick={() =>
            onFilterChange(
              activeFilter === "watch_group" || showWatchSub ? null : "watch_group"
            )
          }
        />
        {activeFilter ? (
          <button
            type="button"
            onClick={() => onFilterChange(null)}
            className={cn("ml-auto text-xs", brandLinkClass)}
          >
            Wyczyść filtr
          </button>
        ) : null}
      </div>

      {showActionSub ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
            <IconCircleCheck size={13} strokeWidth={2.25} aria-hidden />
            Do potwierdzenia
          </span>
          <SubChip count={summary.pickupCount} label="Odbiór" tone="action" filter="pickup" {...chipProps} />
          <SubChip count={summary.partialReadyCount} label="Część na magazynie" tone="warning" filter="partial" {...chipProps} />
          <SubChip count={summary.cancelAckCount} label="Anulowanie" tone="neutral" filter="cancel_ack" {...chipProps} />
          <SubChip count={summary.informacjaReadyCount} label="Info gotowa" tone="success" filter="informacja_ready" {...chipProps} />
        </div>
      ) : null}

      {showWatchSub ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
            <IconClock size={13} strokeWidth={2.25} aria-hidden />
            Doprecyzuj status
          </span>
          <SubChip count={summary.overdueCount} label="Po terminie" tone="warning" filter="overdue" {...chipProps} />
          <SubChip count={summary.verificationCount} label="Sprawdzamy dane" tone="info" filter="verification" {...chipProps} />
          <SubChip count={summary.przedZamowieniemCount} label="Czeka na zamówienie" tone="purple" filter="przed_zamowieniem" {...chipProps} />
          <SubChip count={summary.zamowioneCount} label="Zamówione" tone="info" filter="zamowione" {...chipProps} />
          <SubChip count={summary.availabilityPendingCount} label="Czeka na magazyn" tone="purple" filter="availability_pending" {...chipProps} />
        </div>
      ) : null}

      {!showActionSub && !showWatchSub && actionCount > 0 ? (
        <p className="text-xs leading-relaxed text-slate-600">
          <strong className="font-semibold text-emerald-900">Wymaga reakcji</strong> — prośby z
          zielonym przyciskiem: odbiór towaru, potwierdzenie dostępności lub anulowania.
        </p>
      ) : null}

      {summary.availabilityPendingCount > 0 ? (
        <p className="text-xs leading-snug text-slate-500">{INFORMACJA_FLOW_MY_ORDERS_HINT}</p>
      ) : null}

      {activeFilter ? (
        <p className="sr-only" role="status" aria-live="polite">
          Aktywny filtr: {inboxFilterLabel(activeFilter)}
        </p>
      ) : null}
    </div>
  );
}
