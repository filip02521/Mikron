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
  const map = await estimateTeethDeliveryEtaBatch([supplierId], placementAt);
  return map.get(supplierId) ?? null;
}

/**
 * Wsadowe szacowanie ETA dla wielu dostawców — jedno zapytanie do DB zamiast N.
 */
export async function estimateTeethDeliveryEtaBatch(
  supplierIds: string[],
  placementAt: string
): Promise<Map<string, DeliveryEtaEstimate>> {
  const result = new Map<string, DeliveryEtaEstimate>();
  if (!hasSupabaseConfig() || supplierIds.length === 0) return result;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("individual_orders")
    .select("supplier_id, teeth_ordered_at, ordered_at, delivery_at")
    .eq("is_teeth", true)
    .in("supplier_id", supplierIds)
    .eq("status", "Zrealizowane")
    .not("delivery_at", "is", null)
    .order("delivery_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return result;

  const bySupplier = new Map<string, typeof data>();
  for (const row of data) {
    const sid = row.supplier_id as string;
    if (!sid) continue;
    const list = bySupplier.get(sid) ?? [];
    list.push(row);
    bySupplier.set(sid, list);
  }

  const start = parseDateOnly(placementAt);
  if (!start) return result;

  for (const [supplierId, rows] of bySupplier) {
    const samples: number[] = [];
    for (const row of rows.slice(0, 20)) {
      const orderedAt = row.teeth_ordered_at ?? row.ordered_at;
      if (!orderedAt || !row.delivery_at) continue;
      const s = parseDateOnly(orderedAt);
      const e = parseDateOnly(row.delivery_at as string);
      if (!s || !e) continue;
      const days = calculateBusinessDays(s, e);
      if (days >= 0) samples.push(days);
    }
    if (samples.length === 0) continue;
    const avg = samples.reduce((sum, d) => sum + d, 0) / samples.length;
    const avgRounded = Math.round(avg);
    if (avgRounded <= 0) continue;
    result.set(supplierId, {
      avgBusinessDays: avgRounded,
      expectedDate: calculateBusinessDate(start, avgRounded),
      sampleCount: samples.length,
      lowConfidence: samples.length < 3,
    });
  }

  return result;
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
