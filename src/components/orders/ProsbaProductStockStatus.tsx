"use client";

import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  buildProsbaLineStockStatusView,
  buildProsbaSufficientStockSummary,
  prosbaLineStockDetailClass,
  prosbaLineStockIconClass,
  prosbaLineStockShellClass,
  prosbaLineStockTitleClass,
} from "@/lib/orders/prosba-line-stock-ui";
import { cn } from "@/lib/cn";
import { IconAlertCircle, IconPackage, IconWarehouse } from "@/components/icons/StrokeIcons";
import type { IndividualRequestKind } from "@/types/database";

function StockStatusIcon({
  tone,
  assessment,
}: {
  tone: "amber" | "sky" | "slate";
  assessment: string;
}) {
  const className = cn("mt-0.5 size-[18px] shrink-0", prosbaLineStockIconClass(tone));
  if (assessment === "sufficient") {
    return <IconAlertCircle className={className} strokeWidth={2.25} aria-hidden />;
  }
  if (assessment === "insufficient") {
    return <IconPackage className={className} strokeWidth={2.25} aria-hidden />;
  }
  return <IconWarehouse className={className} strokeWidth={2.25} aria-hidden />;
}

/** Kompaktowy status stanu magazynowego — spójny z banerem Subiekta w formularzu prośby. */
export function ProsbaProductStockStatus({
  line,
  requestKind,
  className,
}: {
  line: ProductLineDraft;
  requestKind: IndividualRequestKind;
  className?: string;
}) {
  const view = buildProsbaLineStockStatusView(line, requestKind);
  if (!view) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5",
        prosbaLineStockShellClass(view.tone),
        className
      )}
    >
      <StockStatusIcon tone={view.tone} assessment={view.assessment} />
      <div className="min-w-0">
        <p className={cn("text-xs font-semibold leading-snug", prosbaLineStockTitleClass(view.tone))}>
          {view.title}
        </p>
        <p className={cn("mt-0.5 text-xs leading-relaxed", prosbaLineStockDetailClass(view.tone))}>
          {view.detail}
        </p>
      </div>
    </div>
  );
}

/** Podsumowanie wielu pozycji z wystarczającym stanem (nad listą produktów). */
export function ProsbaProductStockSummary({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  const summary = buildProsbaSufficientStockSummary(count);
  if (!summary) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5",
        prosbaLineStockShellClass("amber"),
        className
      )}
    >
      <IconAlertCircle
        size={18}
        strokeWidth={2.25}
        className={cn("mt-0.5 shrink-0", prosbaLineStockIconClass("amber"))}
        aria-hidden
      />
      <div className="min-w-0">
        <p className={cn("text-xs font-semibold leading-snug", prosbaLineStockTitleClass("amber"))}>
          {summary.title}
        </p>
        <p className={cn("mt-0.5 text-xs leading-relaxed", prosbaLineStockDetailClass("amber"))}>
          {summary.detail}
        </p>
      </div>
    </div>
  );
}
