"use client";

import { useMemo } from "react";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  allTeethDetailsComplete,
  expandTeethDetails,
  isTeethDetailComplete,
  TEETH_KIND_LABELS,
  teethManufacturerLabel,
  type TeethManufacturer,
} from "@/lib/teeth/teeth-catalog";
import { cn } from "@/lib/cn";

export type TeethLineStatus = {
  lineId: string;
  index: number;
  productName: string;
  manufacturer: TeethManufacturer;
  quantity: number;
  completed: number;
  total: number;
  isComplete: boolean;
};

export function useTeethLinesStatus(lines: ProductLineDraft[]): {
  teethLines: TeethLineStatus[];
  completedCount: number;
  totalCount: number;
} {
  return useMemo(() => {
    const teethLines: TeethLineStatus[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.teethManufacturer) continue;
      const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
      const expanded = expandTeethDetails(line.teethDetails, qty);
      const completed = expanded.filter((d) =>
        isTeethDetailComplete(d, line.teethManufacturer!),
      ).length;
      teethLines.push({
        lineId: line.id,
        index: i,
        productName: line.product?.trim() || line.symbol?.trim() || line.mikranCode?.trim() || "Produkt",
        manufacturer: line.teethManufacturer,
        quantity: qty,
        completed,
        total: qty,
        isComplete: completed === qty,
      });
    }
    return {
      teethLines,
      completedCount: teethLines.filter((l) => l.isComplete).length,
      totalCount: teethLines.length,
    };
  }, [lines]);
}

export function TeethProgressBadge({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  if (total === 0) return null;
  const allDone = completed === total;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums",
            allDone
              ? "bg-violet-600 text-white"
              : "bg-violet-100 text-violet-700",
          )}
        >
          {completed}/{total}
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-violet-900">
            {allDone ? "Wszystkie zęby uzupełnione" : "Uzupełnij dane zębów"}
          </span>
          {!allDone && (
            <span className="text-[11px] text-violet-600">
              {total - completed} {total - completed === 1 ? "pozycja" : "pozycji"} do uzupełnienia
            </span>
          )}
        </div>
      </div>
      <div className="ml-auto h-2 w-24 overflow-hidden rounded-full bg-violet-100">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            allDone ? "bg-violet-600" : "bg-violet-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function TeethReviewSummary({
  lines,
}: {
  lines: ProductLineDraft[];
}) {
  const { teethLines, completedCount, totalCount } = useTeethLinesStatus(lines);

  if (totalCount === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
            {completedCount}/{totalCount}
          </span>
          <h3 className="text-sm font-semibold text-slate-900">
            Podsumowanie zębów
          </h3>
        </div>
        <span
          className={cn(
            "text-xs font-medium",
            completedCount === totalCount
              ? "text-violet-700"
              : "text-amber-600",
          )}
        >
          {completedCount === totalCount
            ? "Wszystkie gotowe"
            : `${totalCount - completedCount} do uzupełnienia`}
        </span>
      </div>
      <ul className="divide-y divide-slate-50">
        {teethLines.map((tl) => {
          const label = teethManufacturerLabel(tl.manufacturer);
          return (
            <li
              key={tl.lineId}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5",
                tl.isComplete ? "bg-violet-50/30" : "bg-amber-50/30",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                  tl.isComplete
                    ? "bg-violet-600 text-white"
                    : "bg-amber-100 text-amber-700",
                )}
              >
                {tl.completed}/{tl.total}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {tl.productName}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {label} · {tl.total} {tl.total === 1 ? "klapka" : "klapki"}
                </p>
              </div>
              {tl.isComplete ? (
                <svg
                  className="h-4 w-4 shrink-0 text-violet-500"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  Uzupełnij
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
