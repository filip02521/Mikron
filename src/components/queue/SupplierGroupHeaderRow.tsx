"use client";

import { cn } from "@/lib/cn";
import {
  queueSupplierLeadingCellClass,
  queueSupplierRowClass,
  type SupplierOrderGroup,
} from "@/lib/orders/queue-supplier-groups";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={cn("size-4 shrink-0 text-slate-600 transition-transform", open && "rotate-90")}
      fill="currentColor"
    >
      <path d="M7.2 4.2a1 1 0 0 1 1.4 0l4.8 4.8a1 1 0 0 1 0 1.4l-4.8 4.8a1 1 0 1 1-1.4-1.4L11.58 10 7.2 5.6a1 1 0 0 1 0-1.4Z" />
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
}: {
  colSpan: number;
  groupIndex: number;
  group: SupplierOrderGroup;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  variant?: "delivery" | "informacja";
  actions?: React.ReactNode;
}) {
  return (
    <tr
      className={queueSupplierRowClass(groupIndex, {
        variant,
        isFirstInSupplierGroup: true,
      })}
    >
      <td
        colSpan={colSpan}
        className={cn(
          queueSupplierLeadingCellClass(groupIndex, { variant }),
          "!py-1.5 !pl-2.5"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-start gap-2 text-left rounded-md hover:bg-black/[0.03]"
            aria-expanded={isOpen}
          >
            <Chevron open={isOpen} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight text-slate-900">
                {group.supplierKey}
              </span>
              <span className="block text-[10px] font-medium leading-snug text-slate-600">
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
