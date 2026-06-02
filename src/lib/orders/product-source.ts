import type { IndividualOrder } from "@/types/database";
import { formatOrderQuantityLabel } from "@/lib/orders/individual";
import { isInformacjaQueueViaDailyPanel } from "@/lib/orders/informacja-via-daily-panel";
import { submittedAt } from "@/lib/orders/order-timing";
import type { ForSomeoneLine } from "@/lib/orders/summary-workspace";

/** Pozycja wybrana z kartoteki Subiekt (nie wpis ręczny). */
export function isSubiektVerifiedOrder(
  order: Pick<IndividualOrder, "subiekt_tw_id">
): boolean {
  const id = order.subiekt_tw_id;
  return typeof id === "number" && Number.isFinite(id) && id > 0;
}

export function mapOrderToForSomeoneLine(item: IndividualOrder): ForSomeoneLine {
  return {
    id: item.id,
    products: item.products,
    symbol: item.symbol || "-",
    mikranCode: item.mikran_code?.trim() || null,
    quantity: formatOrderQuantityLabel(item.quantity, item.request_kind),
    fromSubiekt: isSubiektVerifiedOrder(item),
    subiektTwId: item.subiekt_tw_id ?? null,
    informacjaViaPanel: isInformacjaQueueViaDailyPanel(item),
    submittedAt: submittedAt(item),
    procurementSeenAt: item.procurement_seen_at ?? null,
  };
}
