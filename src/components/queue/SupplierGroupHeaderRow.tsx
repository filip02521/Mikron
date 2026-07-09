"use client";

import { cn } from "@/lib/cn";
import {
  queueSupplierLeadingCellClass,
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

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path strokeLinecap="round" d="M2.5 6.5h11M5.5 2v2M10.5 2v2" />
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
        isFirstInSupplierGroup: true,
      })}
    >
      <td
        colSpan={colSpan}
        className={cn(
          queueSupplierLeadingCellClass(groupIndex, { variant }),
          "!py-2 !pl-3 sm:!pl-4",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left transition hover:bg-black/[0.02]"
            aria-expanded={isOpen}
          >
            <Chevron open={isOpen} />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-bold leading-tight text-slate-900">
                  {group.supplierKey}
                </span>
                {scheduleDate ? (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
                      scheduleOverdue
                        ? "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200/60"
                        : "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200/50",
                    )}
                    title={scheduleOverdue ? "Planowany dzień zamówienia minął — sprawdź opóźnienie" : "Najbliższy planowany dzień zamówienia"}
                  >
                    <CalendarIcon className="size-3 shrink-0" />
                    {scheduleOverdue ? "po planie" : "plan"}
                    {" "}
                    {formatPlDate(scheduleDate)}
                  </span>
                ) : null}
                {maxWaitingDays != null && maxWaitingDays > 0 ? (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums transition",
                      isStale
                        ? "bg-rose-100/90 text-rose-700 ring-1 ring-inset ring-rose-200/50"
                        : "bg-slate-100/80 text-slate-600 ring-1 ring-inset ring-slate-200/40",
                    )}
                    title={`Najstarsze zamówienie czeka ${waitingLabel} w przyjęciu`}
                  >
                    <ClockIcon className="size-3 shrink-0" />
                    czeka {waitingLabel}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[10px] font-medium leading-snug text-slate-500">
                {summary}
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
