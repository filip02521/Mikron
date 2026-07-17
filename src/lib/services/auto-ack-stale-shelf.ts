import type { SupabaseClient } from "@supabase/supabase-js";
import type { IndividualOrder } from "@/types/database";
import { classifyOnShelf, businessDaysWaiting } from "@/lib/orders/warehouse-inventory";
import { normalizeIndividualOrder } from "@/lib/data/normalize-order";

const STALE_THRESHOLD_BUSINESS_DAYS = 21;
const SQL_PREFILTER_DAYS = 28;
const BATCH_LIMIT = 200;

type StaleShelfRow = Pick<
  IndividualOrder,
  "id" | "status" | "delivery_at" | "action_at" | "sales_acknowledged_at" | "sales_cancelled_at" | "is_teeth" | "request_kind" | "delivered_quantity" | "quantity" | "sales_person_id" | "source_zk_watch_id" | "source_zk_number" | "sales_client_kh_id" | "sales_client_name" | "products" | "symbol" | "mikran_code" | "subiekt_tw_id"
>;

/**
 * Auto-ack pozycji na regale starszych niż 21 dni roboczych.
 * Wywoływane z runOrderMaintenanceBeforePageLoad — nie blokuje ładowania strony.
 */
export async function autoAcknowledgeStaleWarehouseInventory(
  supabase: SupabaseClient
): Promise<number> {
  const cutoffIso = new Date(Date.now() - SQL_PREFILTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("individual_orders")
    .select(
      "id, status, delivery_at, action_at, sales_acknowledged_at, sales_cancelled_at, is_teeth, request_kind, delivered_quantity, quantity, sales_person_id, source_zk_watch_id, source_zk_number, sales_client_kh_id, sales_client_name, products, symbol, mikran_code, subiekt_tw_id"
    )
    .in("status", ["Zrealizowane", "Czesciowo_zrealizowane"])
    .is("sales_acknowledged_at", null)
    .is("sales_cancelled_at", null)
    .or(`delivery_at.lt.${cutoffIso},action_at.lt.${cutoffIso}`)
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("[autoAcknowledgeStaleShelf] query error:", error.message);
    return 0;
  }

  const rows = (data ?? []) as unknown as StaleShelfRow[];
  if (!rows.length) {
    console.log("[autoAcknowledgeStaleShelf] no rows from SQL prefilter");
    return 0;
  }

  const staleIds: string[] = [];
  let classifiedCount = 0;
  for (const row of rows) {
    const order = normalizeIndividualOrder(row as never) as IndividualOrder;
    if (!classifyOnShelf(order)) continue;
    classifiedCount++;
    const since = order.delivery_at ?? order.action_at ?? null;
    const days = businessDaysWaiting(since);
    if (days >= STALE_THRESHOLD_BUSINESS_DAYS) {
      staleIds.push(order.id);
    }
  }

  const debugRows = rows.slice(0, 5).map((r) => ({ id: r.id, delivery_at: r.delivery_at, action_at: r.action_at }));
  console.log(`[autoAcknowledgeStaleShelf] SQL=${rows.length} classified=${classifiedCount} stale(>=21bd)=${staleIds.length}`, JSON.stringify(debugRows));

  if (!staleIds.length) return 0;

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("individual_orders")
    .update({ sales_acknowledged_at: now })
    .in("id", staleIds)
    .is("sales_acknowledged_at", null)
    .select("id, sales_person_id, source_zk_watch_id, source_zk_number, sales_client_kh_id, sales_client_name, is_teeth, products, symbol, mikran_code, subiekt_tw_id, status, quantity, delivered_quantity, request_kind, sales_acknowledged_at, sales_cancelled_at");

  if (updateError) {
    console.error("[autoAcknowledgeStaleShelf] update error:", updateError.message);
    return 0;
  }

  const ackedRows = (updated ?? []) as unknown as IndividualOrder[];
  const count = ackedRows.length;

  if (count > 0) {
    console.log(`[autoAcknowledgeStaleShelf] acknowledged ${count} stale items: ${ackedRows.map((r) => r.id).join(", ")}`);
  }

  try {
    const { syncZkWatchLineChecksFromOrder } = await import(
      "@/lib/sales/zk-watch-order-sync"
    );
    await Promise.all(
      ackedRows.map((row) =>
        syncZkWatchLineChecksFromOrder({
          ...row,
          sales_acknowledged_at: now,
        })
      )
    );
  } catch (e) {
    console.error("[autoAcknowledgeStaleShelf] ZK watch sync error:", e);
  }

  return count;
}
