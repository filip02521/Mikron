"use client";

import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { formatProsbaLineSummary } from "@/lib/orders/prosba-product-line-ui";
import {
  buildProsbaLineStockStatusView,
  prosbaLineStockBadgeClass,
  prosbaLineStockRowTintClass,
} from "@/lib/orders/prosba-line-stock-ui";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import { isStockExemptTwId } from "@/lib/orders/teeth-stock-exempt";
import {
  allTeethDetailsComplete,
  expandTeethDetails,
  isTeethDetailComplete,
} from "@/lib/teeth/teeth-catalog";
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
  const teethExemptTwIds = useTeethExemptTwIds();
  const isTeethProduct = isStockExemptTwId(line.subiektTwId, teethExemptTwIds);
  const summary = formatProsbaLineSummary(line, requestKind);
  const stockView = isTeethProduct
    ? null
    : buildProsbaLineStockStatusView(line, requestKind, teethExemptTwIds);

  const teethComplete = isTeethProduct && line.teethManufacturer
    ? allTeethDetailsComplete(
        line.teethDetails,
        line.teethManufacturer,
        Math.max(1, parseInt(line.quantity, 10) || 1),
      )
    : null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 sm:items-center sm:px-4",
        hasFieldIssues
          ? "bg-white"
          : isTeethProduct
            ? "bg-violet-50/55"
            : stockView
              ? prosbaLineStockRowTintClass(stockView.tone)
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
            : isTeethProduct
              ? "bg-violet-100 text-violet-700"
              : stockView
                ? "bg-slate-100 text-slate-600"
                : summary.fromSubiekt
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-indigo-100 text-indigo-700"
        )}
        title={
          hasFieldIssues
            ? "Uzupełnij brakujące pola"
            : isTeethProduct
              ? "Produkt z listy zębów — bez kontroli stanu"
              : stockView
                ? stockView.title
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
          {isTeethProduct ? (
            <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-900 ring-1 ring-violet-200/80">
              Zęby · bez kontroli stanu
            </span>
          ) : stockView ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                prosbaLineStockBadgeClass(stockView.tone)
              )}
            >
              {stockView.shortLabel}
            </span>
          ) : null}
          {teethComplete === false ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
              Zęby do uzupełnienia
            </span>
          ) : teethComplete === true ? (
            <span className="shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              Zęby gotowe
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
        {line.requestNote?.trim() ? (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            Notatka: {line.requestNote.trim()}
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
