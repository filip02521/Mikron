import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  buildDeliveryStatsDiagnostics,
  type DeliveryStatsDiagnostics,
  type DeliveryStatsSkipReasonCount,
} from "@/lib/orders/delivery-stats-diagnostics";
import type { DeliveryStatsOrderInput } from "@/lib/orders/delivery-stats-aggregation";
import { DELIVERY_STATS_COMPLETED_STATUS } from "@/lib/orders/delivery-stats-aggregation";
import {
  aggregateDeliveryStatsFromSampleRows,
  importProtectedStatsFromSampleRows,
  mergeAggregatedPreferLive,
} from "@/lib/orders/delivery-stats-samples";
import { fetchDeliveryStatsFromSamplesEnabled } from "@/lib/data/delivery-stats-flags";
import { fetchActiveDeliveryStatsSamples } from "@/lib/data/delivery-stats-samples";
import type { StatsMode } from "@/types/database";

export async function fetchDeliveryStatsDiagnostics(): Promise<DeliveryStatsDiagnostics | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = createAdminClient();
  const fromSamples = await fetchDeliveryStatsFromSamplesEnabled();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [suppliersRes, statsRes, ordersRes, skipRes, missingOrderedRes] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, stats_mode, is_active")
      .order("name"),
    supabase.from("delivery_stats").select("*"),
    supabase
      .from("individual_orders")
      .select(
        "id, supplier_id, request_kind, status, ordered_at, action_at, delivery_at, order_type, products, is_teeth, sales_cancelled_at, procurement_cancel_disposition"
      )
      .eq("request_kind", "zamowienie")
      .eq("status", DELIVERY_STATS_COMPLETED_STATUS)
      .order("delivery_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("delivery_stats_skip_events")
      .select("reason")
      .gte("created_at", sevenDaysAgo.toISOString()),
    supabase
      .from("individual_orders")
      .select("id", { count: "exact", head: true })
      .eq("request_kind", "zamowienie")
      .eq("status", DELIVERY_STATS_COMPLETED_STATUS)
      .is("ordered_at", null),
  ]);

  if (suppliersRes.error) throw new Error(suppliersRes.error.message);
  if (statsRes.error) throw new Error(statsRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  const skipCounts = new Map<string, number>();
  for (const row of skipRes.data ?? []) {
    const reason = String(row.reason ?? "inne");
    skipCounts.set(reason, (skipCounts.get(reason) ?? 0) + 1);
  }
  const skipEventsLast7Days: DeliveryStatsSkipReasonCount[] = [...skipCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  let recomputedBySupplierFromSamples:
    | Map<string, import("@/lib/orders/delivery-stats-aggregation").AggregatedDeliveryStats>
    | undefined;
  let samplesSource: "orders" | "delivery_stats_samples" = "orders";

  if (fromSamples) {
    try {
      const sampleRows = await fetchActiveDeliveryStatsSamples();
      const live = aggregateDeliveryStatsFromSampleRows(sampleRows);
      const imported = importProtectedStatsFromSampleRows(sampleRows);
      recomputedBySupplierFromSamples = mergeAggregatedPreferLive(live, imported);
      samplesSource = "delivery_stats_samples";
    } catch (e) {
      console.warn("diagnostics samples recompute fallback to orders:", e);
    }
  }

  return buildDeliveryStatsDiagnostics({
    suppliers: (suppliersRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      stats_mode: row.stats_mode as StatsMode,
      is_active: row.is_active,
    })),
    storedStats: statsRes.data ?? [],
    orders: (ordersRes.data ?? []) as DeliveryStatsOrderInput[],
    skipEventsLast7Days,
    missingOrderedAtCount: missingOrderedRes.count ?? 0,
    samplesSource,
    recomputedBySupplierFromSamples,
  });
}
