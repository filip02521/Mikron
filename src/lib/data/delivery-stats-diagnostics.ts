import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  buildDeliveryStatsDiagnostics,
  type DeliveryStatsDiagnostics,
} from "@/lib/orders/delivery-stats-diagnostics";
import type { DeliveryStatsOrderInput } from "@/lib/orders/delivery-stats-aggregation";
import { DELIVERY_STATS_COMPLETED_STATUS } from "@/lib/orders/delivery-stats-aggregation";
import type { StatsMode } from "@/types/database";

export async function fetchDeliveryStatsDiagnostics(): Promise<DeliveryStatsDiagnostics | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = createAdminClient();

  const [suppliersRes, statsRes, ordersRes] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, stats_mode, is_active")
      .order("name"),
    supabase.from("delivery_stats").select("*"),
    supabase
      .from("individual_orders")
      .select(
        "id, supplier_id, request_kind, status, ordered_at, action_at, delivery_at, order_type, products"
      )
      .eq("request_kind", "zamowienie")
      .eq("status", DELIVERY_STATS_COMPLETED_STATUS)
      .order("delivery_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (suppliersRes.error) throw new Error(suppliersRes.error.message);
  if (statsRes.error) throw new Error(statsRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  return buildDeliveryStatsDiagnostics({
    suppliers: (suppliersRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      stats_mode: row.stats_mode as StatsMode,
      is_active: row.is_active,
    })),
    storedStats: statsRes.data ?? [],
    orders: (ordersRes.data ?? []) as DeliveryStatsOrderInput[],
  });
}
