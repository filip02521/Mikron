import type { IndividualOrder } from "@/types/database";
import { formatOrderQuantityLabel } from "@/lib/orders/individual";
import { normalizeSalesClientName } from "@/lib/orders/sales-client-label";
import { isInformacjaStockOutReorder } from "@/lib/orders/informacja-stock-out-reorder";
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
    informacjaStockOut: isInformacjaStockOutReorder(item),
    submittedAt: submittedAt(item),
    procurementSeenAt: item.procurement_seen_at ?? null,
    clientName: normalizeSalesClientName(item.sales_client_name),
    clientKhId:
      item.sales_client_kh_id != null && item.sales_client_kh_id > 0
        ? item.sales_client_kh_id
        : null,
  };
}
