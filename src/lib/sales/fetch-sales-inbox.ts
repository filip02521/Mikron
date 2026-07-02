import {
  fetchDeliveryStats,
  fetchIndividualOrders,
} from "@/lib/data/queries";
import { fetchSalesBoardAttentionSnapshot } from "@/lib/data/department-board";
import { fetchSalesDayStartNotepadSlice } from "@/lib/data/sales-notepad";
import { filterIndividualOrdersForSalesMyOrders } from "@/lib/orders/informacja-stock-out-reorder";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import {
  buildSalesDayStartSnapshot,
  type SalesDayStartSnapshot,
} from "@/lib/sales/sales-day-start";
import type { DeliveryStats } from "@/types/database";

/** Globalny inbox handlowca — ta sama logika co panel Start dnia na /moje. */
export async function fetchSalesInboxSnapshot(
  salesPersonId: string,
  profileId: string
): Promise<SalesDayStartSnapshot> {
  const [orders, statsRows, notepadSlice, boardAttention] = await Promise.all([
    fetchIndividualOrders({ salesPersonId, hideSalesAcknowledged: false }),
    fetchDeliveryStats(),
    fetchSalesDayStartNotepadSlice(salesPersonId).catch(() => ({
      zkWatches: [],
      notes: [],
    })),
    fetchSalesBoardAttentionSnapshot(profileId).catch(() => null),
  ]);

  let salesVisibleOrders = filterIndividualOrdersForSalesMyOrders(orders);
  if (salesVisibleOrders.some((o) => o.is_teeth)) {
    const { attachTeethDetailsToIndividualOrders } = await import("@/lib/data/teeth-queue");
    salesVisibleOrders = await attachTeethDetailsToIndividualOrders(salesVisibleOrders);
  }

  const { zamowienia, informacje } = presentMyOrders(
    salesVisibleOrders,
    statsRows as DeliveryStats[]
  );

  return buildSalesDayStartSnapshot({
    rows: [...zamowienia, ...informacje],
    watches: notepadSlice.zkWatches,
    notes: notepadSlice.notes,
    boardAttention,
  });
}
