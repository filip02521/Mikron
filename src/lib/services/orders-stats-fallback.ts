/**
 * Fallback read-modify-write gdy RPC increment_delivery_stats jeszcze nie istnieje.
 * Używane tylko z delivery-stats-samples przy błędzie RPC / undo dual-write.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderType } from "@/types/database";

export async function updateSupplierStatsFallback(
  supplierId: string,
  deliveryDays: number,
  orderType: OrderType,
  options?: { decrement?: boolean }
): Promise<void> {
  const supabase = createAdminClient();
  const isMain = orderType === "Glowne";
  const { data: existing } = await supabase
    .from("delivery_stats")
    .select("main_sum, side_sum, main_count, side_count")
    .eq("supplier_id", supplierId)
    .maybeSingle();

  const decrement = options?.decrement === true;
  const deltaDays = decrement ? -Math.abs(deliveryDays) : deliveryDays;
  const deltaCount = decrement ? -1 : 1;

  if (existing) {
    const sumCol = isMain ? "main_sum" : "side_sum";
    const countCol = isMain ? "main_count" : "side_count";
    const avgCol = isMain ? "main_avg" : "side_avg";
    const currentSum = Number(existing[sumCol as keyof typeof existing] ?? 0);
    const currentCount = Number(existing[countCol as keyof typeof existing] ?? 0);
    const newCount = Math.max(0, currentCount + deltaCount);
    const newSum = Math.max(0, currentSum + deltaDays);
    if (newCount === 0) {
      await supabase
        .from("delivery_stats")
        .update({
          [sumCol]: null,
          [countCol]: null,
          [avgCol]: null,
          updated_at: new Date().toISOString(),
        })
        .eq("supplier_id", supplierId);
    } else {
      await supabase
        .from("delivery_stats")
        .update({
          [sumCol]: newSum,
          [countCol]: newCount,
          [avgCol]: Math.round(newSum / newCount),
          updated_at: new Date().toISOString(),
        })
        .eq("supplier_id", supplierId);
    }
  } else if (!decrement) {
    await supabase.from("delivery_stats").insert({
      supplier_id: supplierId,
      main_sum: isMain ? deliveryDays : null,
      main_count: isMain ? 1 : null,
      main_avg: isMain ? deliveryDays : null,
      side_sum: !isMain ? deliveryDays : null,
      side_count: !isMain ? 1 : null,
      side_avg: !isMain ? deliveryDays : null,
    });
  }
}
