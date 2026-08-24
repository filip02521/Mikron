"use client";

import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { InformacjaEmailSentMeta } from "@/components/moje/InformacjaEmailSentMeta";
import { MyOrderEstimatedDeliveryMeta } from "@/components/moje/MyOrderEstimatedDeliveryMeta";
import { MyOrderStatusPill } from "@/components/moje/MyOrderStatusPill";
import { PlannedOrderDateMeta } from "@/components/orders/PlannedOrderDateMeta";
import { ZdEtaPendingMeta } from "@/components/orders/ZdEtaPendingMeta";
import { ZdFulfillmentDateMeta } from "@/components/orders/ZdFulfillmentDateMeta";
import { MyOrderLineCountMeta } from "@/components/moje/MyOrderLineCountMeta";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

export type MyOrderRowMetaRailProps = {
  row: MyOrderRow;
  searchQuery?: string | null;
  showInformacjaTimingMeta: boolean;
  showEstimatedDeliveryMeta: boolean;
  showZdEtaPendingMeta: boolean;
  showZdEtaPendingWithEstimate: boolean;
  showStatusPill: boolean;
  productSummary?: string | null;
  productSummaryExpandHint?: string | null;
  mobileTiming?: string | null;
  isUrgent?: boolean;
  isStock?: boolean;
  className?: string;
};

/** Jeden renderer terminu / statusu / liczby produktów — desktop i mobile. */
export function MyOrderRowMetaRail({
  row,
  searchQuery,
  showInformacjaTimingMeta,
  showEstimatedDeliveryMeta,
  showZdEtaPendingMeta,
  showZdEtaPendingWithEstimate,
  showStatusPill,
  productSummary,
  productSummaryExpandHint,
  mobileTiming,
  isUrgent,
  isStock,
  className,
}: MyOrderRowMetaRailProps) {
  const zdFulfillment = row.zdFulfillment ?? null;
  const plannedOrderDate = row.plannedOrderDate ?? null;

  const hasContent =
    showInformacjaTimingMeta ||
    zdFulfillment ||
    showEstimatedDeliveryMeta ||
    showZdEtaPendingMeta ||
    plannedOrderDate ||
    showStatusPill ||
    productSummary ||
    mobileTiming;

  if (!hasContent) return null;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-end gap-1 sm:max-w-[42%] sm:shrink-0",
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        {mobileTiming ? (
          <SearchHighlightText
            text={mobileTiming}
            searchQuery={searchQuery}
            className={cn(
              "truncate font-medium tabular-nums sm:hidden",
              salesTypography.rowMeta,
              isUrgent && "text-amber-900",
              isStock && "text-sky-800",
              !isUrgent && !isStock && "text-slate-600"
            )}
          />
        ) : null}
        {showInformacjaTimingMeta && row.timingLabel ? (
          <InformacjaEmailSentMeta timingLabel={row.timingLabel} />
        ) : null}
        {!showInformacjaTimingMeta && zdFulfillment ? (
          <ZdFulfillmentDateMeta fulfillment={zdFulfillment} collapsed lines={row.lines} />
        ) : null}
        {!showInformacjaTimingMeta && showEstimatedDeliveryMeta ? (
          <MyOrderEstimatedDeliveryMeta row={row} />
        ) : null}
        {showZdEtaPendingMeta ? (
          <ZdEtaPendingMeta compact={showZdEtaPendingWithEstimate} />
        ) : null}
        {plannedOrderDate ? <PlannedOrderDateMeta display={plannedOrderDate} /> : null}
        {showStatusPill ? (
          <MyOrderStatusPill
            label={row.statusTitle}
            variant={row.badgeVariant}
            searchQuery={searchQuery}
          />
        ) : null}
      </div>
      {productSummary ? (
        <MyOrderLineCountMeta
          label={productSummary}
          expandHint={productSummaryExpandHint ?? undefined}
          searchQuery={searchQuery}
        />
      ) : null}
    </div>
  );
}
