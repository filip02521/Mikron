import {
  fetchDeliveryStats,
  fetchIndividualOrders,
} from "@/lib/data/queries";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import { filterIndividualOrdersForSalesMyOrders } from "@/lib/orders/informacja-stock-out-reorder";
import { summarizeMyOrdersInbox } from "@/lib/orders/my-order-sales-ui";
import { salesDayStartNavCount } from "@/lib/sales/sales-day-start";
import { countNotepadNavBadge } from "@/lib/data/sales-notepad";
import { countSalesBoardNavBadge } from "@/lib/data/department-board";
import {
  computeSalesActivityVersionFromRows,
  type SalesActivityRow,
} from "@/lib/orders/sales-activity-version";
import type { DeliveryStats } from "@/types/database";

export type SalesShellMetrics = {
  activityVersion: string;
  navAttention: number;
  /** Zsumowany Start dnia — zamówienia + notatnik + tablica. */
  dayStartNavCount: number;
};

/** Jedno pobranie listy + statystyk dla badge i wersji aktywności (AppShell). */
export async function fetchSalesShellMetrics(
  salesPersonId: string,
  profileId?: string | null
): Promise<SalesShellMetrics> {
  const [orders, statsRows] = await Promise.all([
    fetchIndividualOrders({ salesPersonId, hideSalesAcknowledged: false }),
    fetchDeliveryStats(),
  ]);
  const salesVisibleOrders = filterIndividualOrdersForSalesMyOrders(orders);
  const { zamowienia, informacje } = presentMyOrders(
    salesVisibleOrders,
    statsRows as DeliveryStats[]
  );
  const inbox = summarizeMyOrdersInbox([...zamowienia, ...informacje]);

  const [notepadDue, boardNav] = await Promise.all([
    countNotepadNavBadge(salesPersonId).catch(() => 0),
    profileId ? countSalesBoardNavBadge(profileId).catch(() => 0) : Promise.resolve(0),
  ]);

  const activityRows: SalesActivityRow[] = salesVisibleOrders.map((o) => ({
    action_at: o.action_at,
    ordered_at: o.ordered_at,
    delivery_at: o.delivery_at,
    status: o.status,
    sales_acknowledged_at: o.sales_acknowledged_at,
    request_kind: o.request_kind,
    informacja_stock_out_reorder: o.informacja_stock_out_reorder,
  }));

  return {
    activityVersion: computeSalesActivityVersionFromRows(activityRows),
    navAttention:
      inbox.pickupCount + inbox.cancelAckCount + inbox.informacjaReadyCount,
    dayStartNavCount: salesDayStartNavCount(inbox, notepadDue, boardNav),
  };
}
