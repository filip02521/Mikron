"use client";

import { cn } from "@/lib/cn";
import { checkboxBrandClass } from "@/lib/ui/ontime-theme";
import { formatPlDate } from "@/lib/display-labels";
import { TeethPanelEditOrderTrigger } from "@/components/zeby/TeethPanelEditOrderTrigger";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
import { IconAlertCircle, IconCircleCheck } from "@/components/icons/StrokeIcons";
import type { TeethQueueItem } from "@/lib/data/teeth-queue-shared";
import { describeProcurementReadinessGaps } from "@/lib/orders/procurement-readiness";
import {
  formatTeethQueueWaitDays,
  resolveTeethQueueEnteredAt,
  teethQueueWaitCalendarDays,
} from "@/lib/teeth/teeth-queue-wait";
import {
  formatTeethSpecLabel,
  TEETH_ORDER_STATE_LABELS,
  teethOrderSpecLines,
  teethOrderStateNeedsFix,
  type TeethOrderQueueState,
} from "@/lib/teeth/teeth-queue-view-model";

const STATE_BADGE: Record<TeethOrderQueueState, string> = {
  ready: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  missing_list: "bg-amber-50 text-amber-800 ring-amber-300",
  incomplete: "bg-amber-50 text-amber-800 ring-amber-300",
  needs_header: "bg-amber-50 text-amber-800 ring-amber-300",
  informacja: "bg-sky-50 text-sky-700 ring-sky-200",
};

const STATE_FIX_HINT: Partial<Record<TeethOrderQueueState, string>> = {
  missing_list: "Handlowiec nie dodał listy zębów - uzupełnij ją przed zamówieniem.",
  incomplete: "Na liście brakuje koloru, fasonu, szczęki lub typu.",
};

/** Kolor oczekiwania: >5 dni czerwony, >2 bursztynowy. */
function waitToneClass(days: number): string {
  if (days > 5) return "text-red-700 bg-red-50 ring-red-200";
  if (days > 2) return "text-amber-800 bg-amber-50 ring-amber-200";
  return "text-slate-600 bg-slate-50 ring-slate-200";
}

export function TeethQueueOrderRow({
  item,
  state,
  selected,
  onToggleOrder,
  onTogglePositions,
  onEditSaved,
  selectable = true,
}: {
  item: TeethQueueItem;
  /** Prośby bez dostawcy nie da się zamówić — bez zaznaczania. */
  selectable?: boolean;
  state: TeethOrderQueueState;
  /** Zaznaczone pozycje tej prośby. */
  selected: Set<number> | undefined;
  onToggleOrder: () => void;
  onTogglePositions: (positions: number[], select: boolean) => void;
  onEditSaved?: (message?: string) => void;
}) {
  const lines = teethOrderSpecLines(item);
  const unorderedTotal = selectable
    ? lines.reduce((sum, l) => sum + l.unorderedPositions.length, 0)
    : 0;
  const selectedCount = unorderedTotal > 0
    ? lines.reduce(
        (sum, l) => sum + l.unorderedPositions.filter((p) => selected?.has(p)).length,
        0,
      )
    : 0;
  const allSelected = unorderedTotal > 0 && selectedCount === unorderedTotal;
  const someSelected = selectedCount > 0 && !allSelected;
  const needsFix = teethOrderStateNeedsFix(state);
  const headerGaps = state === "informacja" ? [] : describeProcurementReadinessGaps(item);
  const fixHints = [
    STATE_FIX_HINT[state],
    headerGaps.length > 0 ? `Brakuje w prośbie: ${headerGaps.join(", ")}.` : null,
  ].filter((h): h is string => Boolean(h));

  const enteredAt = resolveTeethQueueEnteredAt(item);
  const waitDays = enteredAt ? teethQueueWaitCalendarDays(enteredAt) : null;

  const who = item.sales_person_name ?? "Bez handlowca";
  const context = [item.sales_client_name?.trim(), item.source_zk_number?.trim()]
    .filter(Boolean)
    .join(" · ");
  const product = item.products?.trim();

  return (
    <li
      className={cn(
        "group relative flex gap-3 px-4 py-3 transition-colors sm:px-5",
        allSelected || someSelected ? "bg-indigo-50/50" : "hover:bg-slate-50/70",
        needsFix && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-amber-400",
      )}
    >
      <div className="pt-0.5">
        {unorderedTotal > 0 ? (
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={onToggleOrder}
            className={cn(checkboxBrandClass, "size-[18px]")}
            aria-label={`Zaznacz prośbę: ${who}${context ? `, ${context}` : ""}`}
          />
        ) : (
          <span className="block size-[18px]" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-slate-900">
              {who}
              {context ? (
                <span className="font-normal text-slate-500"> · {context}</span>
              ) : null}
            </p>
            {product ? (
              <p className="truncate text-xs text-slate-500" title={product}>
                {product}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {waitDays != null ? (
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums ring-1 ring-inset",
                  waitToneClass(waitDays),
                )}
                title={enteredAt ? `W kolejce od ${formatPlDate(enteredAt.slice(0, 10))}` : undefined}
              >
                {waitDays <= 0 ? "dziś" : `czeka ${formatTeethQueueWaitDays(waitDays)}`}
              </span>
            ) : null}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                STATE_BADGE[state],
              )}
            >
              {state === "ready" ? <IconCircleCheck size={12} /> : needsFix ? <IconAlertCircle size={12} /> : null}
              {TEETH_ORDER_STATE_LABELS[state]}
            </span>
            {!needsFix && state !== "informacja" && onEditSaved ? (
              <TeethPanelEditOrderTrigger
                orderId={item.id}
                onSaved={onEditSaved}
                label="Edytuj"
                className="min-h-7 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              />
            ) : null}
          </div>
        </div>

        {lines.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Zęby w prośbie">
            {lines.map((line) => {
              const open = selectable ? line.unorderedPositions : [];
              const lineSelected = open.length > 0 && open.every((p) => selected?.has(p));
              const label = formatTeethSpecLabel(line);
              const qty = line.unorderedPositions.length > 0 ? line.unorderedPositions.length : line.total;
              const done = line.unorderedPositions.length === 0;
              const locked = !done && !selectable;
              return (
                <li key={line.key}>
                  <button
                    type="button"
                    disabled={done || locked}
                    aria-pressed={done || locked ? undefined : lineSelected}
                    onClick={() => onTogglePositions(open, !lineSelected)}
                    title={
                      done
                        ? "Już zamówione u dostawcy"
                        : locked
                          ? undefined
                          : lineSelected
                          ? "Odznacz te zęby"
                          : "Zaznacz tylko te zęby"
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                      done
                        ? "cursor-default bg-slate-50 text-slate-400 ring-slate-200 line-through decoration-slate-300"
                        : locked
                          ? "cursor-default bg-white text-slate-700 ring-slate-200"
                        : lineSelected
                          ? "bg-indigo-600 text-white ring-indigo-600"
                          : "bg-white text-slate-800 ring-slate-200 hover:ring-indigo-300",
                    )}
                  >
                    <span>{label}</span>
                    <span
                      className={cn(
                        "rounded px-1 text-[11px] font-bold tabular-nums",
                        lineSelected ? "bg-white/20" : "bg-slate-100 text-slate-700",
                      )}
                    >
                      ×{qty}
                    </span>
                    {line.orderedCount > 0 && !done ? (
                      <span className="text-[10px] font-normal opacity-70">
                        +{line.orderedCount} zam.
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {needsFix || state === "informacja" ? (
          <div className="flex flex-wrap items-center gap-2">
            {fixHints.length > 0 ? (
              <p className="text-xs text-amber-800">{fixHints.join(" ")}</p>
            ) : null}
            {onEditSaved ? (
              <TeethPanelEditOrderTrigger
                orderId={item.id}
                onSaved={onEditSaved}
                label={state === "missing_list" ? "Dodaj listę zębów" : "Uzupełnij"}
                className="min-h-8 border border-amber-300 bg-white px-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-50"
              />
            ) : null}
          </div>
        ) : null}

        {item.sales_request_note?.trim() ? (
          <ProcurementSalesRequestNote note={item.sales_request_note} compact />
        ) : null}
      </div>
    </li>
  );
}
