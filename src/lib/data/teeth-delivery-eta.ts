import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  calculateBusinessDate,
  calculateBusinessDays,
  formatDateString,
  parseDateOnly,
} from "@/lib/orders/dates";
import type { DeliveryEtaEstimate } from "@/lib/orders/delivery-eta";
import { warsawDateKeyFromIso } from "@/lib/time/warsaw";

export type TeethDeliveryEtaSource = "fixed" | "history";

/** ETA zębów — rozszerzenie wspólnego typu o źródło (stałe vs historia). */
export type TeethDeliveryEtaEstimate = DeliveryEtaEstimate & {
  source: TeethDeliveryEtaSource;
};

/** Data kalendarzowa w Warszawie z ISO lub YYYY-MM-DD (Vercel = UTC). */
export function teethPlacementDateOnly(placementAt: string): Date | null {
  const raw = placementAt.trim();
  if (!raw) return null;
  const key = raw.length === 10 ? raw : warsawDateKeyFromIso(raw);
  return parseDateOnly(key);
}

/**
 * Stałe dni robocze per dostawca z teeth_supplier_schedules.
 * Zwraca tylko wartości > 0 (0 / null = brak stałego ETA).
 */
export async function fetchTeethDeliveryLeadDaysBySupplier(
  supabase: SupabaseClient,
  supplierIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const unique = [...new Set(supplierIds.map((id) => id?.trim()).filter(Boolean))] as string[];
  if (unique.length === 0) return result;

  const { data, error } = await supabase
    .from("teeth_supplier_schedules")
    .select("supplier_id, delivery_lead_business_days")
    .in("supplier_id", unique);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const sid = typeof row.supplier_id === "string" ? row.supplier_id : null;
    if (!sid) continue;
    const raw = row.delivery_lead_business_days;
    const days = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(days) || days <= 0) continue;
    result.set(sid, Math.trunc(days));
  }
  return result;
}

/**
 * Szacuj termin dostawy zamówień zębowych.
 * Priorytet: stałe ETA z harmonogramu → średnia z historii Zrealizowane.
 */
export async function estimateTeethDeliveryEta(
  supplierId: string,
  placementAt: string
): Promise<TeethDeliveryEtaEstimate | null> {
  const map = await estimateTeethDeliveryEtaBatch([supplierId], placementAt);
  return map.get(supplierId) ?? null;
}

/**
 * Wsadowe szacowanie ETA dla wielu dostawców.
 * Stałe delivery_lead_business_days wygrywa z historią.
 */
export async function estimateTeethDeliveryEtaBatch(
  supplierIds: string[],
  placementAt: string
): Promise<Map<string, TeethDeliveryEtaEstimate>> {
  const result = new Map<string, TeethDeliveryEtaEstimate>();
  const unique = [...new Set(supplierIds.map((id) => id?.trim()).filter(Boolean))] as string[];
  if (!hasSupabaseConfig() || unique.length === 0) return result;

  const start = teethPlacementDateOnly(placementAt);
  if (!start) return result;

  const supabase = createAdminClient();
  const fixedDays = await fetchTeethDeliveryLeadDaysBySupplier(supabase, unique);

  for (const [supplierId, days] of fixedDays) {
    result.set(supplierId, {
      avgBusinessDays: days,
      expectedDate: calculateBusinessDate(start, days),
      sampleCount: 0,
      lowConfidence: false,
      source: "fixed",
    });
  }

  const historyIds = unique.filter((id) => !result.has(id));
  if (historyIds.length === 0) return result;

  const { data, error } = await supabase
    .from("individual_orders")
    .select("supplier_id, teeth_ordered_at, ordered_at, delivery_at")
    .eq("is_teeth", true)
    .in("supplier_id", historyIds)
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

  for (const [supplierId, rows] of bySupplier) {
    if (result.has(supplierId)) continue;
    const samples: number[] = [];
    for (const row of rows.slice(0, 20)) {
      const orderedAt = row.teeth_ordered_at ?? row.ordered_at;
      if (!orderedAt || !row.delivery_at) continue;
      const s = teethPlacementDateOnly(String(orderedAt));
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
      source: "history",
    });
  }

  return result;
}

/**
 * Rozwiąż ostateczną datę dostawy dla zamówienia zębowego.
 * Jeśli teeth_delivery_date jest ustawione ręcznie → użyj go.
 * W przeciwnym razie → użyj szacunku (stałe / historia).
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

/**
 * Zamówienia do uzupełnienia teeth_delivery_date po mark-ordered.
 * Pomija brak dostawcy oraz wiersze z już ustawioną datą (ręczny override).
 */
export function collectOrdersNeedingTeethDeliveryEstimate(
  beforeUpdate: ReadonlyArray<{
    id: string;
    supplier_id: string | null;
    teeth_delivery_date: string | null;
  }> | null | undefined,
  placementAt: string
): Array<{
  id: string;
  supplier_id: string;
  teeth_ordered_at: string;
  ordered_at: string;
}> {
  const result: Array<{
    id: string;
    supplier_id: string;
    teeth_ordered_at: string;
    ordered_at: string;
  }> = [];
  for (const row of beforeUpdate ?? []) {
    const supplierId = row.supplier_id?.trim() || null;
    if (!supplierId || !row.id) continue;
    if (row.teeth_delivery_date) continue;
    result.push({
      id: row.id,
      supplier_id: supplierId,
      ordered_at: placementAt,
      teeth_ordered_at: placementAt,
    });
  }
  return result;
}

/**
 * Zapisz wyliczone teeth_delivery_date na zamówieniach bez ręcznej daty.
 * Używane po mark-ordered i po clearTeethDeliveryDateOverride.
 */
export async function applyTeethDeliveryEstimateToOrders(
  supabase: SupabaseClient,
  orders: ReadonlyArray<{
    id: string;
    supplier_id: string | null;
    teeth_ordered_at?: string | null;
    ordered_at?: string | null;
  }>,
  placementAtFallback: string
): Promise<void> {
  const needing = orders.filter((o) => o.id && o.supplier_id);
  if (needing.length === 0) return;

  const byPlacement = new Map<string, typeof needing>();
  for (const order of needing) {
    const placement =
      order.teeth_ordered_at?.trim() ||
      order.ordered_at?.trim() ||
      placementAtFallback;
    const list = byPlacement.get(placement) ?? [];
    list.push(order);
    byPlacement.set(placement, list);
  }

  for (const [placementAt, group] of byPlacement) {
    const supplierIds = [
      ...new Set(group.map((o) => o.supplier_id!).filter(Boolean)),
    ];
    let batch: Map<string, TeethDeliveryEtaEstimate>;
    try {
      batch = await estimateTeethDeliveryEtaBatch(supplierIds, placementAt);
    } catch {
      continue;
    }

    const byDate = new Map<string, string[]>();
    for (const order of group) {
      const estimate = batch.get(order.supplier_id!);
      const date = resolveTeethDeliveryDate(null, estimate ?? null);
      if (!date) continue;
      const list = byDate.get(date) ?? [];
      list.push(order.id);
      byDate.set(date, list);
    }

    await Promise.all(
      [...byDate.entries()].map(async ([date, orderIds]) => {
        const { error } = await supabase
          .from("individual_orders")
          .update({ teeth_delivery_date: date })
          .in("id", orderIds)
          .eq("is_teeth", true)
          .is("teeth_delivery_date", null);
        if (error) throw new Error(error.message);
      })
    );
  }
}
