import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { filterIndividualOrdersForSalesMyOrders } from "@/lib/orders/informacja-stock-out-reorder";
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
>;

type ActivityRow = Pick<
  SalesActivityRow,
  "action_at" | "ordered_at" | "delivery_at" | "status" | "sales_acknowledged_at"
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
  const statusCounts: Record<string, number> = {};

  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    if (!row.sales_acknowledged_at) activeCount++;
    if (row.action_at > maxAction) maxAction = row.action_at;
    if (row.ordered_at && row.ordered_at > maxOrdered) maxOrdered = row.ordered_at;
    if (row.delivery_at && row.delivery_at > maxDelivery) maxDelivery = row.delivery_at;
  }

  const statusPart = Object.entries(statusCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([s, n]) => `${s}:${n}`)
    .join(",");

  return `${activeCount}|${maxAction}|${maxOrdered}|${maxDelivery}|${statusPart}`;
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
      "action_at, ordered_at, delivery_at, status, sales_acknowledged_at, request_kind, informacja_stock_out_reorder"
    )
    .eq("sales_person_id", salesPersonId);

  if (error) throw new Error(error.message);

  return computeSalesActivityVersionFromRows(
    filterSalesActivityRows((data ?? []) as SalesActivityRow[])
  );
}
