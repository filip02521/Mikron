import { filterIndividualOrdersForSalesMyOrders } from "@/lib/orders/informacja-stock-out-reorder";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import { summarizeMyOrdersInbox } from "@/lib/orders/my-order-sales-ui";
import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board-shared";
import {
  buildSalesInboxSnapshotFromLoadedData,
  inboxNavBadgesFromLoadedData,
  loadSalesInboxData,
} from "@/lib/sales/fetch-sales-inbox";
import type { SalesDayStartSnapshot } from "@/lib/sales/sales-day-start";
import {
  composeSalesActivityVersion,
  computeSalesActivityVersionFromRows,
} from "@/lib/orders/sales-activity-version";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryStats } from "@/types/database";

export type SalesShellMetrics = {
  activityVersion: string;
  navAttention: number;
  /** Badge „Moje” — tylko sprawy z /moje (mojeActionCount inboxu), bez ZK/notatek/Tablicy. */
  dayStartNavCount: number;
  /** Badge „ZK czekające” — zaległe przypomnienia ZK. */
  zkNavBadge: number;
  /** Badge „Notatnik” — zaległe przypomnienia notatek. */
  notesNavBadge: number;
  /** Badge Tablica — własne aktywne pytania z nieprzeczytaną odpowiedzią. */
  boardNavBadge: number;
  inboxSnapshot: SalesDayStartSnapshot;
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

  // Także w podglądzie admina (bez profileId) — inaczej badge „Moje” i dzwonek pokazują 0.
  const inboxSnapshot = await buildSalesInboxSnapshotFromLoadedData(loaded);

  const ordersPart = computeSalesActivityVersionFromRows(salesVisibleOrders);

  return {
    activityVersion: composeSalesActivityVersion(ordersPart, watchesRes.data ?? []),
    navAttention:
      inbox.pickupCount + inbox.cancelAckCount + inbox.informacjaReadyCount,
    dayStartNavCount: inboxSnapshot.mojeActionCount,
    zkNavBadge: navBadges.zkNavBadge,
    notesNavBadge: navBadges.notesNavBadge,
    boardNavBadge: navBadges.boardNavBadge,
    inboxSnapshot,
    boardAttention: loaded.boardAttention,
  };
}
