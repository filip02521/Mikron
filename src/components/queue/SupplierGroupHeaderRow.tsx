"use client";

import { cn } from "@/lib/cn";
import {
  queueSupplierRowClass,
  type SupplierOrderGroup,
} from "@/lib/orders/queue-supplier-groups";
import { formatPlDate } from "@/lib/display-labels";
import { parseDateOnly } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={cn(
        "size-4 shrink-0 text-slate-400 transition-transform duration-200",
        open && "rotate-90",
      )}
      fill="currentColor"
    >
      <path d="M7.2 4.2a1 1 0 0 1 1.4 0l4.8 4.8a1 1 0 0 1 0 1.4l-4.8 4.8a1 1 0 1 1-1.4-1.4L11.58 10 7.2 5.6a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <circle cx="8" cy="8" r="5.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5v3l2 1.5" />
    </svg>
  );
}

export function SupplierGroupHeaderRow({
  colSpan,
  groupIndex,
  group,
  summary,
  isOpen,
  onToggle,
  variant = "delivery",
  actions,
  scheduleDate,
  maxWaitingDays,
  rowRef,
  dataIndex,
}: {
  colSpan: number;
  groupIndex: number;
  group: SupplierOrderGroup;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  variant?: "delivery" | "informacja";
  actions?: React.ReactNode;
  scheduleDate?: string | null;
  maxWaitingDays?: number | null;
  rowRef?: (element: Element | null) => void;
  dataIndex?: number;
}) {
  const scheduleOverdue = (() => {
    if (!scheduleDate) return false;
    const date = parseDateOnly(scheduleDate);
    if (!date) return false;
    return date < todayInWarsaw();
  })();
  const isStale = maxWaitingDays != null && maxWaitingDays >= 3;
  const waitingLabel = maxWaitingDays === 1 ? "1 dzień" : `${maxWaitingDays} dni`;

  return (
    <tr
      ref={rowRef}
      data-index={dataIndex}
      className={queueSupplierRowClass(groupIndex, {
        variant,
        isHeader: true,
        isFirstInSupplierGroup: true,
      })}
    >
      <td
        colSpan={colSpan}
        className="!py-3 !pl-3 sm:!pl-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md text-left sm:min-h-0"
            aria-expanded={isOpen}
          >
            <Chevron open={isOpen} />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-base font-semibold leading-snug text-slate-900">{group.supplierKey}</span>
                {isStale ? (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-medium tabular-nums text-rose-700"
                    title={`Najstarsze zamówienie czeka ${waitingLabel} w przyjęciu`}
                  >
                    <ClockIcon className="size-3 shrink-0" />
                    czeka {waitingLabel}
                  </span>
                ) : null}
              </span>
              {/* Jeden czerwony sygnał (czeka ≥ 3 dni); plan i krótsze czekanie to zwykłe metadane. */}
              <span className="mt-0.5 block text-sm leading-snug text-slate-500">
                {summary}
                {scheduleDate ? (
                  <span title={scheduleOverdue ? "Planowany dzień zamówienia minął - sprawdź opóźnienie" : "Najbliższy planowany dzień zamówienia"}>
                    {" · "}
                    {scheduleOverdue ? "po planie" : "plan"} {formatPlDate(scheduleDate)}
                  </span>
                ) : null}
                {!isStale && maxWaitingDays != null && maxWaitingDays > 0 ? (
                  <span className="tabular-nums">{" · "}czeka {waitingLabel}</span>
                ) : null}
              </span>
            </span>
          </button>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
