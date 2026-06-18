"use client";

import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { formatProsbaLineSummary } from "@/lib/orders/prosba-product-line-ui";
import { isProsbaLineStockSufficient } from "@/lib/orders/prosba-stock-check";
import { zkWatchLineUiStateMeta } from "@/lib/sales/zk-watch-line-ui-state";
import type { IndividualRequestKind } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { IconCircleCheck, IconAlertCircle } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

export function ProsbaProductLineCollapsedRow({
  index,
  line,
  requestKind,
  canRemove,
  hasFieldIssues = false,
  onEdit,
  onRemove,
}: {
  index: number;
  line: ProductLineDraft;
  requestKind: IndividualRequestKind;
  canRemove: boolean;
  hasFieldIssues?: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const summary = formatProsbaLineSummary(line, requestKind);
  const inStock =
    requestKind === "zamowienie" && isProsbaLineStockSufficient(line, requestKind);
  const inStockMeta = zkWatchLineUiStateMeta("in_stock");

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 sm:items-center sm:px-4",
        inStock
          ? inStockMeta.rowTintClass
          : summary.fromSubiekt
            ? "bg-emerald-50/70"
            : "bg-white"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full sm:mt-0",
          hasFieldIssues
            ? "bg-amber-100 text-amber-800"
            : inStock
              ? "bg-slate-100 text-slate-600"
              : summary.fromSubiekt
                ? "bg-emerald-100 text-emerald-700"
                : "bg-indigo-100 text-indigo-700"
        )}
        title={
          hasFieldIssues
            ? "Uzupełnij brakujące pola"
            : inStock
              ? inStockMeta.label
              : summary.fromSubiekt
                ? "Powiązano z Subiektem"
                : "Pozycja gotowa"
        }
      >
        {hasFieldIssues ? (
          <IconAlertCircle size={18} strokeWidth={2.25} />
        ) : (
          <IconCircleCheck size={18} strokeWidth={2.25} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {index + 1}.
          </span>
          <p className="min-w-0 font-medium text-slate-900">{summary.title}</p>
          {summary.quantityLabel ? (
            <span className="shrink-0 text-sm font-semibold text-slate-700">
              {summary.quantityLabel}
            </span>
          ) : null}
          {inStock ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                inStockMeta.badgeClass
              )}
            >
              {inStockMeta.shortLabel}
            </span>
          ) : null}
        </div>
        {summary.meta ? (
          <p className="mt-0.5 truncate text-xs text-slate-500">{summary.meta}</p>
        ) : null}
        {summary.clientName ? (
          <p className="mt-0.5 truncate text-xs text-indigo-800/90">
            Klient: {summary.clientName}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Edytuj
        </Button>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-red-700 hover:bg-red-50"
            onClick={onRemove}
          >
            Usuń
          </Button>
        ) : null}
      </div>
    </div>
  );
}
