import { DeliveryDateMetaValue } from "@/components/orders/DeliveryDateMetaValue";
import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import {
  MY_ORDER_HISTORY_ESTIMATE_CAPTION,
  MY_ORDER_HISTORY_ESTIMATE_ZD_NO_MATCH_OVERDUE_TOOLTIP,
  MY_ORDER_HISTORY_ESTIMATE_ZD_NO_MATCH_TOOLTIP,
  MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_OVERDUE_TOOLTIP,
  MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_TOOLTIP,
} from "@/lib/orders/my-order-history-estimate-copy";
import { resolveMyOrderHistoryDeliveryEstimate } from "@/lib/orders/delivery-date-meta-label";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

/** Szacowany termin (bez ZD lub jako fallback gdy ZD nie ma terminu) — meta na zwiniętej karcie. */
export function MyOrderEstimatedDeliveryMeta({
  row,
  className,
  inline = false,
}: {
  row: Pick<MyOrderRow, "timingLabel" | "zdFulfillment" | "zdEtaPending" | "zdEtaNoMatch">;
  className?: string;
  inline?: boolean;
}) {
  const estimate = resolveMyOrderHistoryDeliveryEstimate(row);
  if (!estimate) return null;

  const { display, parsed } = estimate;

  const title = row.zdEtaNoMatch
    ? parsed.overdue
      ? MY_ORDER_HISTORY_ESTIMATE_ZD_NO_MATCH_OVERDUE_TOOLTIP
      : MY_ORDER_HISTORY_ESTIMATE_ZD_NO_MATCH_TOOLTIP
    : row.zdEtaPending
      ? parsed.overdue
        ? MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_OVERDUE_TOOLTIP
        : MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_TOOLTIP
      : display.title;

  return (
    <DeliveryTimingMeta
      className={className}
      caption={MY_ORDER_HISTORY_ESTIMATE_CAPTION}
      captionTone={parsed.overdue ? "overdue" : "default"}
      title={title}
      inline={inline}
    >
      <DeliveryDateMetaValue display={display} inline={inline} />
    </DeliveryTimingMeta>
  );
}
