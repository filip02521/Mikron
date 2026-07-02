import {
  fetchDeliveryStats,
  fetchIndividualOrders,
} from "@/lib/data/queries";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import { filterIndividualOrdersForSalesMyOrders } from "@/lib/orders/informacja-stock-out-reorder";
import { summarizeMyOrdersInbox } from "@/lib/orders/my-order-sales-ui";
import { salesDayStartNavCount } from "@/lib/sales/sales-day-start";
import {
  countNotesDueNavBadge,
  countZkDueNavBadge,
} from "@/lib/data/sales-notepad";
import {
  fetchSalesBoardAttentionSnapshot,
} from "@/lib/data/department-board";
import {
  composeSalesActivityVersion,
  computeSalesActivityVersionFromRows,
  type SalesActivityRow,
} from "@/lib/orders/sales-activity-version";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryStats } from "@/types/database";

export type SalesShellMetrics = {
  activityVersion: string;
  navAttention: number;
  /** Badge „Moje zamówienia”: Start dnia + własne odpowiedzi na tablicy (bez ogłoszeń). */
  dayStartNavCount: number;
  /** Badge „ZK czekające” — zaległe przypomnienia ZK. */
  zkNavBadge: number;
  /** Badge „Notatnik” — zaległe przypomnienia notatek. */
  notesNavBadge: number;
  /** Badge na Komunikacji — nieprzeczytane ogłoszenia + nowe odpowiedzi. */
  boardNavBadge: number;
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

  const [zkDue, notesDue, boardSnapshot, watchesRes] = await Promise.all([
    countZkDueNavBadge(salesPersonId).catch(() => 0),
    countNotesDueNavBadge(salesPersonId).catch(() => 0),
    profileId
      ? fetchSalesBoardAttentionSnapshot(profileId).catch(() => null)
      : Promise.resolve(null),
    createAdminClient()
      .from("sales_zk_watches")
      .select("updated_at, line_checks")
      .eq("sales_person_id", salesPersonId)
      .is("closed_at", null)
      .is("archived_at", null),
  ]);

  const boardNavForMoje = boardSnapshot?.navBadgeCount ?? 0;
  const boardNavForTablica = boardSnapshot?.unseenAnswerCount ?? 0;

  const activityRows: SalesActivityRow[] = salesVisibleOrders.map((o) => ({
    action_at: o.action_at,
    ordered_at: o.ordered_at,
    delivery_at: o.delivery_at,
    status: o.status,
    sales_acknowledged_at: o.sales_acknowledged_at,
    request_kind: o.request_kind,
    informacja_stock_out_reorder: o.informacja_stock_out_reorder,
    zd_fulfillment_deadline: o.zd_fulfillment_deadline,
    zd_fulfillment_source: o.zd_fulfillment_source,
    zd_fulfillment_synced_at: o.zd_fulfillment_synced_at,
    zd_fulfillment_dok_id: o.zd_fulfillment_dok_id,
    zd_fulfillment_dok_nr: o.zd_fulfillment_dok_nr,
  }));

  const ordersPart = computeSalesActivityVersionFromRows(activityRows);

  return {
    activityVersion: composeSalesActivityVersion(ordersPart, watchesRes.data ?? []),
    navAttention:
      inbox.pickupCount + inbox.cancelAckCount + inbox.informacjaReadyCount,
    dayStartNavCount: salesDayStartNavCount(inbox, zkDue + notesDue, boardNavForMoje),
    zkNavBadge: zkDue,
    notesNavBadge: notesDue,
    boardNavBadge: boardNavForTablica,
  };
}
