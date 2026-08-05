import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  PROCUREMENT_LANE_ORDER_SETTING_KEY,
  serializeProcurementLaneOrder,
} from "@/lib/orders/procurement-request-lane-order";
import type { ProcurementRequestLaneId } from "@/lib/orders/procurement-request-lanes";

export async function fetchProcurementLaneOrderRaw(): Promise<unknown> {
  if (!hasSupabaseConfig()) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", PROCUREMENT_LANE_ORDER_SETTING_KEY)
    .maybeSingle();
  if (error) {
    console.error("fetchProcurementLaneOrderRaw:", error.message);
    return null;
  }
  return data?.value ?? null;
}

export async function saveProcurementLaneOrder(
  order: readonly ProcurementRequestLaneId[]
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert({
    key: PROCUREMENT_LANE_ORDER_SETTING_KEY,
    value: serializeProcurementLaneOrder(order),
  });
  if (error) throw new Error(error.message);
}
