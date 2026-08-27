"use client";

import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { MyOrderDeliveryTimingDisplay } from "@/lib/orders/my-order-delivery-timing-display";
import { MyOrderExpandedDeliveryTiming } from "@/components/moje/MyOrderExpandedDeliveryTiming";
import { InformacjaEmailSentMeta } from "@/components/moje/InformacjaEmailSentMeta";
import { MyOrderEstimatedDeliveryMeta } from "@/components/moje/MyOrderEstimatedDeliveryMeta";
import { PlannedOrderDateMeta } from "@/components/orders/PlannedOrderDateMeta";
import { ZdEtaPendingMeta } from "@/components/orders/ZdEtaPendingMeta";
import { ZdFulfillmentDateMeta } from "@/components/orders/ZdFulfillmentDateMeta";
import { cn } from "@/lib/cn";

export type MyOrderExpandedDeliveryPanelProps = {
  row: MyOrderRow;
  searchQuery?: string | null;
  showInformacjaTimingMeta: boolean;
  showEstimatedDeliveryMeta: boolean;
  showExpandedDeliveryTiming: boolean;
  showZdEtaPendingMeta?: boolean;
  expandedDeliveryTiming?: MyOrderDeliveryTimingDisplay | null;
  className?: string;
};

const fallbackShellClass = "rounded-md border border-slate-200/70 bg-slate-50/45 px-2.5 py-1.5";
const fallbackZdShellClass =
  "rounded-md border border-indigo-200/55 bg-indigo-50/30 px-2.5 py-1.5";

/**
 * Termin dostawy w rozwiniętej prośbie — osobny pasek tuż nad listą produktów.
 */
export function MyOrderExpandedDeliveryPanel({
  row,
  searchQuery,
  showInformacjaTimingMeta,
  showEstimatedDeliveryMeta,
  showExpandedDeliveryTiming,
  showZdEtaPendingMeta = false,
  expandedDeliveryTiming = null,
  className,
}: MyOrderExpandedDeliveryPanelProps) {
  const zdFulfillment = row.zdFulfillment ?? null;
  const plannedOrderDate = row.plannedOrderDate ?? null;

  const hasDeliveryTiming =
    showExpandedDeliveryTiming &&
    (expandedDeliveryTiming ||
      showInformacjaTimingMeta ||
      zdFulfillment ||
      showEstimatedDeliveryMeta ||
      showZdEtaPendingMeta);

  const hasTiming = hasDeliveryTiming || Boolean(plannedOrderDate);
  if (!hasTiming) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {hasDeliveryTiming ? (
        expandedDeliveryTiming ? (
          <MyOrderExpandedDeliveryTiming
            display={expandedDeliveryTiming}
            searchQuery={searchQuery}
          />
        ) : (
          <div className={zdFulfillment ? fallbackZdShellClass : fallbackShellClass}>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {showInformacjaTimingMeta && row.timingLabel ? (
                  <InformacjaEmailSentMeta timingLabel={row.timingLabel} />
                ) : null}
                {!showInformacjaTimingMeta && zdFulfillment ? (
                  <ZdFulfillmentDateMeta
                    fulfillment={zdFulfillment}
                    inline
                    lines={row.lines}
                    className="items-center text-left"
                  />
                ) : null}
                {!showInformacjaTimingMeta && showEstimatedDeliveryMeta ? (
                  <MyOrderEstimatedDeliveryMeta row={row} inline />
                ) : null}
              </div>
              {showZdEtaPendingMeta ? <ZdEtaPendingMeta compact /> : null}
            </div>
          </div>
        )
      ) : null}
      {plannedOrderDate ? (
        <div className={fallbackShellClass}>
          <PlannedOrderDateMeta display={plannedOrderDate} inline />
        </div>
      ) : null}
    </div>
  );
}
