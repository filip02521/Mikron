import {
  fetchDeliveryStats,
  fetchIndividualOrders,
} from "@/lib/data/queries";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import { summarizeMyOrdersInbox } from "@/lib/orders/my-order-sales-ui";
import type { DeliveryStats } from "@/types/database";

/** Liczba kart wymagających działania handlowca (badge w nawigacji). */
export async function countSalesNavAttention(
  salesPersonId: string
): Promise<number> {
  const [orders, statsRows] = await Promise.all([
    fetchIndividualOrders({ salesPersonId, hideSalesAcknowledged: false }),
    fetchDeliveryStats(),
  ]);
  const { zamowienia, informacje } = presentMyOrders(
    orders,
    statsRows as DeliveryStats[]
  );
  const s = summarizeMyOrdersInbox([...zamowienia, ...informacje]);
  return (
    s.pickupCount +
    s.partialReadyCount +
    s.informacjaReadyCount
  );
}
