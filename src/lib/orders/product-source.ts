import type { IndividualOrder } from "@/types/database";
import { formatOrderQuantityLabel, parseOrderQuantity } from "@/lib/orders/individual";
import {
  activeOrderQuantity,
  effectiveSalesCancelledQuantity,
} from "@/lib/orders/sales-cancel";
import { normalizeSalesClientName } from "@/lib/orders/sales-client-label";
import { normalizeSalesRequestNote } from "@/lib/orders/sales-request-note";
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

function formatQuantityWithCancellation(item: IndividualOrder): string {
  const ordered = parseOrderQuantity(item.quantity);
  const cancelled = effectiveSalesCancelledQuantity(item);
  if (ordered != null && cancelled > 0 && cancelled < ordered) {
    const active = activeOrderQuantity(item);
    if (active != null && active > 0) {
      return `${active} szt. (z ${ordered} · ${cancelled} wycofane)`;
    }
  }
  const base = formatOrderQuantityLabel(item.quantity, item.request_kind);
  if (!item.sales_cancelled_at) return base;
  if (cancelled <= 0 || ordered == null) return base;
  if (cancelled >= ordered) return `${ordered} szt. · pełna rezygnacja`;
  return `${ordered} szt. · ${cancelled} wycofane`;
}

export function mapOrderToForSomeoneLine(item: IndividualOrder): ForSomeoneLine {
  return {
    id: item.id,
    products: item.products,
    symbol: item.symbol || "-",
    mikranCode: item.mikran_code?.trim() || null,
    quantity: formatQuantityWithCancellation(item),
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
    requestNote: normalizeSalesRequestNote(item.sales_request_note),
  };
}
