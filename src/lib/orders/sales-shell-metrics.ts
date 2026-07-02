import { filterIndividualOrdersForSalesMyOrders } from "@/lib/orders/informacja-stock-out-reorder";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import { summarizeMyOrdersInbox } from "@/lib/orders/my-order-sales-ui";
import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";
import {
  buildSalesInboxSnapshotFromLoadedData,
  inboxNavBadgesFromLoadedData,
  loadSalesInboxData,
} from "@/lib/sales/fetch-sales-inbox";
import type { SalesDayStartSnapshot } from "@/lib/sales/sales-day-start";
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
  /** Badge „Moje” — ten sam licznik co dzwonek (totalActionCount inboxu). */
  dayStartNavCount: number;
  /** Badge „ZK czekające” — zaległe przypomnienia ZK. */
  zkNavBadge: number;
  /** Badge „Notatnik” — zaległe przypomnienia notatek. */
  notesNavBadge: number;
  /** Badge na Komunikacji — nieprzeczytane odpowiedzi. */
  boardNavBadge: number;
  inboxSnapshot: SalesDayStartSnapshot | null;
  boardAttention: SalesBoardAttentionSnapshot | null;
};

/** Jedno pobranie listy + statystyk dla badge, wersji aktywności i inboxu (AppShell). */
export async function fetchSalesShellMetrics(
  salesPersonId: string,
  profileId?: string | null
): Promise<SalesShellMetrics> {
  const [loaded, watchesRes] = await Promise.all([
    loadSalesInboxData(salesPersonId, profileId ?? null),
    createAdminClient()
      .from("sales_zk_watches")
      .select("updated_at, line_checks")
      .eq("sales_person_id", salesPersonId)
      .is("closed_at", null)
      .is("archived_at", null),
  ]);

  const salesVisibleOrders = filterIndividualOrdersForSalesMyOrders(loaded.orders);
  const { zamowienia, informacje } = presentMyOrders(
    salesVisibleOrders,
    loaded.statsRows as DeliveryStats[]
  );
  const inbox = summarizeMyOrdersInbox([...zamowienia, ...informacje]);
  const navBadges = inboxNavBadgesFromLoadedData(loaded);

  const inboxSnapshot = profileId
    ? await buildSalesInboxSnapshotFromLoadedData(loaded)
    : null;

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
    dayStartNavCount: inboxSnapshot?.totalActionCount ?? 0,
    zkNavBadge: navBadges.zkNavBadge,
    notesNavBadge: navBadges.notesNavBadge,
    boardNavBadge: navBadges.boardNavBadge,
    inboxSnapshot,
    boardAttention: loaded.boardAttention,
  };
}
