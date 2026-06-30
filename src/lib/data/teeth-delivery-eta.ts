import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  calculateBusinessDate,
  calculateBusinessDays,
  formatDateString,
  parseDateOnly,
} from "@/lib/orders/dates";
import type { DeliveryEtaEstimate } from "@/lib/orders/delivery-eta";

/**
 * Szacuj termin dostawy zamówień zębowych na podstawie historii
 * tylko zębowych zamówień (is_teeth = true, status Zrealizowane).
 *
 * Oblicza średnią dni robocze między teeth_ordered_at (lub ordered_at)
 * a delivery_at dla zrealizowanych zamówień zębowych u danego dostawcy.
 */
export async function estimateTeethDeliveryEta(
  supplierId: string,
  placementAt: string
): Promise<DeliveryEtaEstimate | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("individual_orders")
    .select("teeth_ordered_at, ordered_at, delivery_at")
    .eq("is_teeth", true)
    .eq("supplier_id", supplierId)
    .eq("status", "Zrealizowane")
    .not("delivery_at", "is", null)
    .order("delivery_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;

  const samples: number[] = [];
  for (const row of data) {
    const orderedAt = row.teeth_ordered_at ?? row.ordered_at;
    if (!orderedAt || !row.delivery_at) continue;
    const start = parseDateOnly(orderedAt);
    const end = parseDateOnly(row.delivery_at as string);
    if (!start || !end) continue;
    const days = calculateBusinessDays(start, end);
    if (days >= 0) samples.push(days);
  }

  if (samples.length === 0) return null;

  const avg = samples.reduce((sum, d) => sum + d, 0) / samples.length;
  const avgRounded = Math.round(avg);
  const start = parseDateOnly(placementAt);
  if (!start || avgRounded <= 0) return null;

  return {
    avgBusinessDays: avgRounded,
    expectedDate: calculateBusinessDate(start, avgRounded),
    sampleCount: samples.length,
    lowConfidence: samples.length < 3,
  };
}

/**
 * Rozwiąż ostateczną datę dostawy dla zamówienia zębowego.
 * Jeśli teeth_delivery_date jest ustawione ręcznie → użyj go.
 * W przeciwnym razie → użyj szacunku z historii zębowej.
 */
export function resolveTeethDeliveryDate(
  teethDeliveryDate: string | null | undefined,
  estimate: DeliveryEtaEstimate | null
): string | null {
  if (teethDeliveryDate) return teethDeliveryDate;
  if (estimate) {
    return formatDateString(estimate.expectedDate);
  }
  return null;
}
