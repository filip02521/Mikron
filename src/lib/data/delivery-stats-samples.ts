import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  aggregateDeliveryStatsFromSampleRows,
  importProtectedStatsFromSampleRows,
  mergeAggregatedPreferLive,
  sampleRowsToDeliveryStatsPayload,
  type DeliveryStatsSampleRow,
} from "@/lib/orders/delivery-stats-samples";
import {
  aggregatedToDeliveryStatsRow,
  businessDaysBetweenWarsawDateKeys,
  businessDaysForDeliveryStatsSample,
  DELIVERY_STATS_COMPLETED_STATUS,
  deliveryDateKeyFromIso,
  isCancelDispositionStatsPoison,
  isTeethStatsPoison,
  placementDateFromOrder,
  type DeliveryStatsOrderInput,
} from "@/lib/orders/delivery-stats-aggregation";
import { fetchDeliveryStatsFromSamplesEnabled } from "@/lib/data/delivery-stats-flags";
import type { OrderType } from "@/types/database";

const SAMPLE_SELECT =
  "id, supplier_id, order_id, placement_date, delivery_date, first_delivery_date, business_days_full, business_days_first, order_type, is_teeth, source, deleted_at, created_at";

export async function fetchActiveDeliveryStatsSamples(
  supplierId?: string | string[]
): Promise<DeliveryStatsSampleRow[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  let q = supabase
    .from("delivery_stats_samples")
    .select(SAMPLE_SELECT)
    .is("deleted_at", null);
  if (typeof supplierId === "string") {
    q = q.eq("supplier_id", supplierId);
  } else if (Array.isArray(supplierId) && supplierId.length > 0) {
    q = q.in("supplier_id", supplierId);
  }
  const { data, error } = await q;
  if (error) {
    console.error("fetchActiveDeliveryStatsSamples:", error.message);
    return [];
  }
  return (data ?? []) as DeliveryStatsSampleRow[];
}

export async function recordDeliveryStatsSkipEvent(input: {
  orderId?: string | null;
  supplierId?: string | null;
  reason: string;
}): Promise<void> {
  if (!hasSupabaseConfig()) return;
  try {
    const supabase = createAdminClient();
    await supabase.from("delivery_stats_skip_events").insert({
      order_id: input.orderId ?? null,
      supplier_id: input.supplierId ?? null,
      reason: input.reason,
    });
  } catch (e) {
    console.error("recordDeliveryStatsSkipEvent:", e);
  }
}

export async function softDeleteDeliveryStatsSampleForOrder(
  orderId: string,
  options?: { throwOnError?: boolean }
): Promise<boolean> {
  const throwOnError = options?.throwOnError === true;
  const supabase = createAdminClient();
  const { data: existing, error: fetchError } = await supabase
    .from("delivery_stats_samples")
    .select("id, supplier_id, placement_date, delivery_date, business_days_full, order_type, source")
    .eq("order_id", orderId)
    .is("deleted_at", null)
    .maybeSingle();
  if (fetchError) {
    console.error("softDeleteDeliveryStatsSampleForOrder fetch:", fetchError.message);
    if (throwOnError) throw new Error(fetchError.message);
    return false;
  }
  if (!existing) return false;

  const { error } = await supabase
    .from("delivery_stats_samples")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", existing.id)
    .is("deleted_at", null);
  if (error) {
    console.error("softDeleteDeliveryStatsSampleForOrder:", error.message);
    if (throwOnError) throw new Error(error.message);
    return false;
  }

  const supplierId = String(existing.supplier_id);
  const fromSamples = await fetchDeliveryStatsFromSamplesEnabled();
  if (fromSamples) {
    await recomputeDeliveryStatsForSupplier(supplierId);
    return true;
  }

  // Dual-write (flaga off): cofnij legacy increment tylko gdy ta próbka była „zwycięzcą dnia”
  // (najwcześniejsza delivery wśród aktywnych siblingów tego dnia+typu) i source ≠ import.
  if (existing.source !== "import") {
    const { data: siblings } = await supabase
      .from("delivery_stats_samples")
      .select("id, delivery_date, order_id, source, business_days_full")
      .eq("supplier_id", supplierId)
      .eq("placement_date", existing.placement_date)
      .eq("order_type", existing.order_type)
      .in("source", ["receive", "backfill"])
      .is("deleted_at", null)
      .neq("id", existing.id);

    const sorted = [...(siblings ?? [])].sort((a, b) => {
      const dd = String(a.delivery_date).localeCompare(String(b.delivery_date));
      if (dd !== 0) return dd;
      return String(a.order_id ?? "").localeCompare(String(b.order_id ?? ""));
    });

    const stillEarlier = sorted.some((s) => {
      const dd = String(s.delivery_date);
      const ed = String(existing.delivery_date);
      if (dd < ed) return true;
      if (dd > ed) return false;
      return String(s.order_id ?? "") < orderId;
    });

    const { updateSupplierStatsFallback } = await import(
      "@/lib/services/orders-stats-fallback"
    );

    if (!stillEarlier) {
      await updateSupplierStatsFallback(
        supplierId,
        -Number(existing.business_days_full),
        existing.order_type as OrderType,
        { decrement: true }
      );
      // Promuj następnego siblinga tego samego dnia+typu (wcześniej pominiętego jako duplikat).
      const next = sorted[0];
      if (next) {
        await updateSupplierStatsFallback(
          supplierId,
          Number(next.business_days_full),
          existing.order_type as OrderType
        );
      }
    }
  }

  return true;
}

export async function insertDeliveryStatsSample(input: {
  supplierId: string;
  orderId: string;
  placementDate: string;
  deliveryDate: string;
  firstDeliveryDate?: string | null;
  businessDaysFull: number;
  businessDaysFirst?: number | null;
  orderType: "Glowne" | "Poboczne";
  isTeeth?: boolean;
  source?: "receive" | "backfill" | "import";
}): Promise<"inserted" | "duplicate" | "error"> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("delivery_stats_samples").insert({
    supplier_id: input.supplierId,
    order_id: input.orderId,
    placement_date: input.placementDate,
    delivery_date: input.deliveryDate,
    first_delivery_date: input.firstDeliveryDate ?? null,
    business_days_full: input.businessDaysFull,
    business_days_first: input.businessDaysFirst ?? null,
    order_type: input.orderType,
    is_teeth: input.isTeeth === true,
    source: input.source ?? "receive",
  });
  if (!error) return "inserted";
  if (error.code === "23505") return "duplicate";
  console.error("insertDeliveryStatsSample:", error.message);
  return "error";
}

export async function incrementDeliveryStatsAtomic(
  supplierId: string,
  deliveryDays: number,
  orderType: OrderType
): Promise<void> {
  if (orderType !== "Glowne" && orderType !== "Poboczne") return;
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("increment_delivery_stats", {
    p_supplier_id: supplierId,
    p_delivery_days: deliveryDays,
    p_order_type: orderType,
  });
  if (error) {
    // Fallback gdy migracja jeszcze nie wdrożona
    console.warn("increment_delivery_stats RPC failed, fallback:", error.message);
    const { updateSupplierStatsFallback } = await import("@/lib/services/orders-stats-fallback");
    await updateSupplierStatsFallback(supplierId, deliveryDays, orderType);
  }
}

export async function recomputeDeliveryStatsForSupplier(
  supplierId: string
): Promise<void> {
  const fromSamples = await fetchDeliveryStatsFromSamplesEnabled();
  if (!fromSamples) return;

  const samples = await fetchActiveDeliveryStatsSamples(supplierId);
  const live = aggregateDeliveryStatsFromSampleRows(
    samples.filter((s) => s.supplier_id === supplierId)
  );
  const imported = importProtectedStatsFromSampleRows(
    samples.filter((s) => s.supplier_id === supplierId)
  );
  const merged = mergeAggregatedPreferLive(live, imported);
  const agg = merged.get(supplierId);
  const supabase = createAdminClient();

  if (!agg || (agg.main_count === 0 && agg.side_count === 0)) {
    // Keep import-only row if present; else delete commodity row
    if (!imported.has(supplierId)) {
      await supabase.from("delivery_stats").delete().eq("supplier_id", supplierId);
    }
    return;
  }

  await supabase.from("delivery_stats").upsert({
    ...aggregatedToDeliveryStatsRow(supplierId, agg),
    updated_at: new Date().toISOString(),
  });
}

export async function recomputeAllDeliveryStatsFromSamples(): Promise<number> {
  const samples = await fetchActiveDeliveryStatsSamples();
  const live = aggregateDeliveryStatsFromSampleRows(samples);
  const imported = importProtectedStatsFromSampleRows(samples);
  const merged = mergeAggregatedPreferLive(live, imported);
  const payload = sampleRowsToDeliveryStatsPayload(merged);

  const supabase = createAdminClient();
  // Nie kasuj import-only dostawców bez live samples — merge już je zawiera.
  // Kasujemy tylko wiersze bez żadnej próbki (live ani import).
  const keepIds = new Set(payload.map((r) => r.supplier_id));
  const { data: existing } = await supabase.from("delivery_stats").select("supplier_id");
  const toDelete = (existing ?? [])
    .map((r) => r.supplier_id as string)
    .filter((id) => !keepIds.has(id));
  if (toDelete.length) {
    await supabase.from("delivery_stats").delete().in("supplier_id", toDelete);
  }
  if (payload.length) {
    const { error } = await supabase.from("delivery_stats").upsert(payload);
    if (error) throw new Error(error.message);
  }
  return payload.length;
}

export function buildSampleInputFromOrder(
  order: DeliveryStatsOrderInput,
  deliveryAtIso: string
): {
  placementDate: string;
  deliveryDate: string;
  businessDaysFull: number;
  orderType: "Glowne" | "Poboczne";
} | null {
  if (isTeethStatsPoison(order) || isCancelDispositionStatsPoison(order)) return null;
  const days = businessDaysForDeliveryStatsSample(order, deliveryAtIso);
  if (days == null) return null;
  const placementDate = placementDateFromOrder(order);
  const deliveryDate = deliveryDateKeyFromIso(deliveryAtIso);
  if (!placementDate || !deliveryDate) return null;
  if (order.order_type !== "Glowne" && order.order_type !== "Poboczne") return null;
  return {
    placementDate,
    deliveryDate,
    businessDaysFull: days,
    orderType: order.order_type,
  };
}

/** Batch backfill samples z historii orders (po supplier / kursor delivery_at). */
export async function backfillDeliveryStatsSamples(options?: {
  supplierId?: string;
  batchSize?: number;
  maxBatches?: number;
}): Promise<{ inserted: number; skipped: number; batches: number }> {
  const batchSize = options?.batchSize ?? 200;
  const maxBatches = options?.maxBatches ?? 50;
  const supabase = createAdminClient();
  let cursorAt: string | null = null;
  let cursorId: string | null = null;
  let inserted = 0;
  let skipped = 0;
  let batches = 0;

  while (batches < maxBatches) {
    let q = supabase
      .from("individual_orders")
      .select(
        "id, supplier_id, request_kind, status, ordered_at, action_at, delivery_at, order_type, products, is_teeth, sales_cancelled_at, procurement_cancel_disposition, first_delivery_at"
      )
      .eq("request_kind", "zamowienie")
      .eq("status", DELIVERY_STATS_COMPLETED_STATUS)
      .not("delivery_at", "is", null)
      .order("delivery_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(batchSize);
    if (options?.supplierId) q = q.eq("supplier_id", options.supplierId);
    if (cursorAt && cursorId) {
      // keyset: (delivery_at, id) > cursor — unika gubienia wierszy o tym samym delivery_at
      q = q.or(
        `delivery_at.gt.${cursorAt},and(delivery_at.eq.${cursorAt},id.gt.${cursorId})`
      );
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<
      DeliveryStatsOrderInput & { first_delivery_at?: string | null }
    >;
    if (!rows.length) break;
    batches++;
    const last = rows[rows.length - 1]!;
    cursorAt = last.delivery_at;
    cursorId = last.id;

    for (const row of rows) {
      if (!row.supplier_id || !row.delivery_at) {
        skipped++;
        continue;
      }
      if (isTeethStatsPoison(row) || isCancelDispositionStatsPoison(row)) {
        skipped++;
        continue;
      }
      const built = buildSampleInputFromOrder(row, row.delivery_at);
      if (!built) {
        skipped++;
        continue;
      }
      let businessDaysFirst: number | null = null;
      if (row.first_delivery_at) {
        const firstKey = deliveryDateKeyFromIso(row.first_delivery_at);
        if (firstKey) {
          businessDaysFirst = businessDaysBetweenWarsawDateKeys(
            built.placementDate,
            firstKey
          );
        }
      } else {
        // Align z receive path: first ≈ full gdy brak first_delivery_at
        businessDaysFirst = built.businessDaysFull;
      }
      const result = await insertDeliveryStatsSample({
        supplierId: row.supplier_id,
        orderId: row.id,
        placementDate: built.placementDate,
        deliveryDate: built.deliveryDate,
        firstDeliveryDate: row.first_delivery_at
          ? deliveryDateKeyFromIso(row.first_delivery_at)
          : built.deliveryDate,
        businessDaysFull: built.businessDaysFull,
        businessDaysFirst,
        orderType: built.orderType,
        isTeeth: false,
        source: "backfill",
      });
      if (result === "inserted") inserted++;
      else skipped++;
    }
    console.log(
      `[backfillDeliveryStatsSamples] batch=${batches} cursor=${cursorAt}/${cursorId} inserted=${inserted} skipped=${skipped}`
    );
  }

  return { inserted, skipped, batches };
}

/** Upsert synthetic import samples so recalc from samples nie kasuje CSV. */
export async function upsertImportDeliveryStatsSamples(input: {
  supplierId: string;
  mainAvg: number | null;
  mainCount: number | null;
  sideAvg: number | null;
  sideCount: number | null;
}): Promise<void> {
  const supabase = createAdminClient();
  // Soft-delete previous import synthetics for supplier
  await supabase
    .from("delivery_stats_samples")
    .update({ deleted_at: new Date().toISOString() })
    .eq("supplier_id", input.supplierId)
    .eq("source", "import")
    .is("deleted_at", null);

  const baseDate = "2000-01-01";
  const rows: Array<Record<string, unknown>> = [];
  if (input.mainCount && input.mainCount > 0 && input.mainAvg != null) {
    for (let i = 0; i < input.mainCount; i++) {
      rows.push({
        supplier_id: input.supplierId,
        order_id: null,
        placement_date: baseDate,
        delivery_date: baseDate,
        business_days_full: input.mainAvg,
        order_type: "Glowne",
        is_teeth: false,
        source: "import",
      });
    }
  }
  if (input.sideCount && input.sideCount > 0 && input.sideAvg != null) {
    for (let i = 0; i < input.sideCount; i++) {
      rows.push({
        supplier_id: input.supplierId,
        order_id: null,
        placement_date: baseDate,
        delivery_date: baseDate,
        business_days_full: input.sideAvg,
        order_type: "Poboczne",
        is_teeth: false,
        source: "import",
      });
    }
  }
  if (rows.length) {
    const { error } = await supabase.from("delivery_stats_samples").insert(rows);
    if (error) throw new Error(error.message);
  }
}
