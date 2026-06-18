import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { filterIndividualOrdersForSalesMyOrders } from "@/lib/orders/informacja-stock-out-reorder";
import { computeZkWatchActivityVersion } from "@/lib/sales/zk-watch-warehouse-notify";
import type { IndividualOrder } from "@/types/database";

export type SalesActivityRow = Pick<
  IndividualOrder,
  | "action_at"
  | "ordered_at"
  | "delivery_at"
  | "status"
  | "sales_acknowledged_at"
  | "request_kind"
  | "informacja_stock_out_reorder"
  | "zd_fulfillment_deadline"
  | "zd_fulfillment_source"
  | "zd_fulfillment_synced_at"
>;

type ActivityRow = Pick<
  SalesActivityRow,
  | "action_at"
  | "ordered_at"
  | "delivery_at"
  | "status"
  | "sales_acknowledged_at"
  | "zd_fulfillment_deadline"
  | "zd_fulfillment_source"
  | "zd_fulfillment_synced_at"
>;

/** Wiersze widoczne dla handlowca — bez sygnałów stock_out (tylko zakupy). */
export function filterSalesActivityRows(rows: SalesActivityRow[]): SalesActivityRow[] {
  return filterIndividualOrdersForSalesMyOrders(rows);
}

/** Ten sam skrót co computeSalesActivityVersion — z już pobranych wierszy. */
export function computeSalesActivityVersionFromRows(rows: ActivityRow[]): string {
  let activeCount = 0;
  let maxAction = "";
  let maxOrdered = "";
  let maxDelivery = "";
  let zdWithDeadlineCount = 0;
  let maxZdDeadline = "";
  let maxZdSyncedAt = "";
  const statusCounts: Record<string, number> = {};

  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    if (!row.sales_acknowledged_at) activeCount++;
    if (row.action_at > maxAction) maxAction = row.action_at;
    if (row.ordered_at && row.ordered_at > maxOrdered) maxOrdered = row.ordered_at;
    if (row.delivery_at && row.delivery_at > maxDelivery) maxDelivery = row.delivery_at;
    if (row.zd_fulfillment_source === "zd" && row.zd_fulfillment_deadline?.trim()) {
      zdWithDeadlineCount++;
      const d = row.zd_fulfillment_deadline.trim();
      if (d > maxZdDeadline) maxZdDeadline = d;
    }
    const syncedAt = row.zd_fulfillment_synced_at?.trim();
    if (syncedAt && syncedAt > maxZdSyncedAt) maxZdSyncedAt = syncedAt;
  }

  const statusPart = Object.entries(statusCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([s, n]) => `${s}:${n}`)
    .join(",");

  return `${activeCount}|${maxAction}|${maxOrdered}|${maxDelivery}|${statusPart}|zd:${zdWithDeadlineCount}:${maxZdDeadline}|zds:${maxZdSyncedAt}`;
}

/** Pełna wersja aktywności (prośby + otwarte ZK) — ten sam format co API poll. */
export function composeSalesActivityVersion(
  ordersPart: string,
  watches: Parameters<typeof computeZkWatchActivityVersion>[0]
): string {
  return `${ordersPart}::${computeZkWatchActivityVersion(watches)}`;
}

/**
 * Skrót stanu listy handlowca — zmiana = nowa prośba, status, dostawa lub potwierdzenie.
 */
export async function computeSalesActivityVersion(
  salesPersonId: string
): Promise<string> {
  if (!hasSupabaseConfig()) return "0";

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select(
      "action_at, ordered_at, delivery_at, status, sales_acknowledged_at, request_kind, informacja_stock_out_reorder, zd_fulfillment_deadline, zd_fulfillment_source, zd_fulfillment_synced_at"
    )
    .eq("sales_person_id", salesPersonId);

  if (error) throw new Error(error.message);

  const ordersPart = computeSalesActivityVersionFromRows(
    filterSalesActivityRows((data ?? []) as SalesActivityRow[])
  );

  const { data: watchesRaw, error: watchesError } = await supabase
    .from("sales_zk_watches")
    .select("updated_at, line_checks")
    .eq("sales_person_id", salesPersonId)
    .is("closed_at", null)
    .is("archived_at", null);

  if (watchesError) throw new Error(watchesError.message);

  return composeSalesActivityVersion(ordersPart, watchesRaw ?? []);
}
