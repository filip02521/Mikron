import { createAdminClient } from "@/lib/supabase/admin";
import {
  checksFromMergedViews,
  mergeZkLineChecksFromDeliveredOrders,
  type ZkLinkableOrder,
} from "@/lib/sales/zk-watch-order-link";
import { isZkWatchArchived } from "@/lib/data/sales-notepad";
import type { IndividualOrder } from "@/types/database";
import type { SalesZkWatch } from "@/types/database";

function toZkLinkableOrder(order: IndividualOrder): ZkLinkableOrder {
  return {
    id: order.id,
    sales_person_id: order.sales_person_id,
    sales_client_name: order.sales_client_name ?? null,
    sales_client_kh_id: order.sales_client_kh_id ?? null,
    source_zk_watch_id: order.source_zk_watch_id ?? null,
    source_zk_number: order.source_zk_number ?? null,
    subiekt_tw_id: order.subiekt_tw_id ?? null,
    symbol: order.symbol ?? null,
    products: order.products ?? null,
    mikran_code: order.mikran_code ?? null,
    status: order.status,
    sales_acknowledged_at: order.sales_acknowledged_at ?? null,
    sales_cancelled_at: order.sales_cancelled_at ?? null,
  };
}

/** Po zapisie dostawy — automatycznie zaznacz pozycje w powiązanych ZK. */
export async function syncZkWatchLineChecksFromDeliveredOrder(
  order: IndividualOrder
): Promise<void> {
  if (order.status !== "Zrealizowane" && order.status !== "Czesciowo_zrealizowane") {
    return;
  }

  const supabase = createAdminClient();
  const { data: watchesRaw, error } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("sales_person_id", order.sales_person_id)
    .is("closed_at", null)
    .is("archived_at", null);

  if (error || !watchesRaw?.length) return;

  const linkOrder = toZkLinkableOrder(order);
  const now = new Date().toISOString();

  for (const row of watchesRaw) {
    const watch = row as SalesZkWatch;
    if (isZkWatchArchived(watch)) continue;

    const { data: fresh, error: freshError } = await supabase
      .from("sales_zk_watches")
      .select("*")
      .eq("id", watch.id)
      .maybeSingle();

    if (freshError || !fresh) continue;
    const current = fresh as SalesZkWatch;
    if (isZkWatchArchived(current)) continue;

    const { checks, changed } = mergeZkLineChecksFromDeliveredOrders(current, [linkOrder]);
    if (!changed) continue;

    const sanitized = checksFromMergedViews(current, checks);
    await supabase
      .from("sales_zk_watches")
      .update({ line_checks: sanitized, updated_at: now })
      .eq("id", current.id);
  }
}
