"use client";

import { cn } from "@/lib/cn";
import { checkboxBrandClass } from "@/lib/ui/ontime-theme";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
import type { TeethQueueItem } from "@/lib/data/teeth-queue-shared";
import { formatPlDate } from "@/lib/display-labels";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { IconCalendar, IconUndoLeft } from "@/components/icons/StrokeIcons";
import { formatTeethSpecLabel, teethOrderSpecLines } from "@/lib/teeth/teeth-queue-view-model";

export type TeethHistoryState = "in_transit" | "late" | "partial" | "done" | "cancelled";

export function teethHistoryState(item: TeethQueueItem, today = formatDateString(todayInWarsaw())): TeethHistoryState {
  if (item.status === "Anulowane" || item.sales_cancelled_at) return "cancelled";
  if (item.status === "Zrealizowane") return "done";
  if (item.teeth_delivery_date && item.teeth_delivery_date < today) return "late";
  if (item.status === "Czesciowo_zrealizowane") return "partial";
  return "in_transit";
}

const STATE_META: Record<TeethHistoryState, { label: string; badge: string; bar: string }> = {
  in_transit: { label: "W drodze", badge: "bg-sky-50 text-sky-800 ring-sky-200", bar: "bg-sky-500" },
  late: { label: "Opóźnione", badge: "bg-red-50 text-red-700 ring-red-200", bar: "bg-red-500" },
  partial: { label: "Częściowo", badge: "bg-amber-50 text-amber-800 ring-amber-200", bar: "bg-amber-400" },
  done: { label: "Dostarczone", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", bar: "bg-indigo-300" },
  cancelled: { label: "Anulowane", badge: "bg-slate-50 text-slate-400 ring-slate-200", bar: "bg-slate-200" },
};

/** Jedno zamówienie w historii — wiersz listy z czytelnym stanem i akcjami tekstowymi. */
export function TeethPanelHistoryOrderEntry({
  item,
  onEditDate,
  onUnmark,
  selectable = false,
  selected = false,
  onToggleSelected,
}: {
  item: TeethQueueItem;
  onEditDate?: () => void;
  onUnmark?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
}) {
  const state = teethHistoryState(item);
  const meta = STATE_META[state];
  const lines = teethOrderSpecLines(item);
  const who = item.sales_person_name?.trim() || "Bez handlowca";
  const context = [item.sales_client_name?.trim(), item.source_zk_number?.trim()]
    .filter(Boolean)
    .join(" · ");
  const muted = state === "done" || state === "cancelled";

  return (
    <li
      className={cn(
        "relative flex gap-3 px-4 py-3 sm:px-5",
        selected ? "bg-indigo-50/60" : "hover:bg-slate-50/60",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r", meta.bar)} />
      {selectable ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className={cn(checkboxBrandClass, "mt-0.5 size-[18px]")}
          aria-label={`Zaznacz: ${who}${context ? `, ${context}` : ""}`}
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className={cn("text-sm font-semibold leading-snug", muted ? "text-slate-600" : "text-slate-900")}>
              {who}
              {context ? <span className="font-normal text-slate-500"> · {context}</span> : null}
            </p>
            {item.products?.trim() ? (
              <p className="truncate text-xs text-slate-500">{item.products}</p>
            ) : null}
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
              meta.badge,
            )}
          >
            {meta.label}
          </span>
        </div>

        {lines.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Zęby">
            {lines.map((line) => (
              <li
                key={line.key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                  muted ? "bg-slate-50 text-slate-500 ring-slate-200" : "bg-white text-slate-800 ring-slate-200",
                )}
              >
                {formatTeethSpecLabel(line)}
                <span className="rounded bg-slate-100 px-1 text-[11px] font-bold tabular-nums text-slate-700">
                  ×{line.total}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {item.teeth_ordered_at ? (
            <span>
              Zamówiono <span className="font-medium text-slate-700">{formatPlDate(item.teeth_ordered_at.slice(0, 10))}</span>
            </span>
          ) : null}
          <span>
            Dostawa{" "}
            <span className={cn("font-medium", state === "late" ? "text-red-700" : "text-slate-700")}>
              {item.teeth_delivery_date ? formatPlDate(item.teeth_delivery_date) : "nie ustalono"}
            </span>
          </span>
          {onEditDate || onUnmark ? (
            <span className="flex items-center gap-1 sm:ml-auto">
              {onEditDate ? (
                <button
                  type="button"
                  onClick={onEditDate}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <IconCalendar size={13} />
                  Zmień datę
                </button>
              ) : null}
              {onUnmark ? (
                <button
                  type="button"
                  onClick={onUnmark}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 font-medium text-slate-600 hover:bg-amber-50 hover:text-amber-900"
                >
                  <IconUndoLeft size={13} />
                  Cofnij do kolejki
                </button>
              ) : null}
            </span>
          ) : null}
        </div>

        {item.sales_request_note?.trim() ? (
          <ProcurementSalesRequestNote note={item.sales_request_note} compact />
        ) : null}
      </div>
    </li>
  );
}
