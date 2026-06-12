import { calculateBusinessDays, parseDateOnly } from "@/lib/orders/dates";
import { warsawDateKeyFromIso } from "@/lib/time/warsaw";
import { isMissingProduct } from "@/lib/orders/individual";
import { orderPlacementAt } from "@/lib/orders/order-timing";

/** Tylko pełna realizacja — częściowa nie tworzy próbki (czas liczony do domknięcia zamówienia). */
export const DELIVERY_STATS_COMPLETED_STATUS = "Zrealizowane" as const;

export type DeliveryStatsOrderInput = {
  id: string;
  supplier_id: string | null;
  request_kind?: string | null;
  status: string;
  ordered_at: string | null;
  action_at: string;
  delivery_at: string | null;
  order_type: string | null;
  products: string;
};

export type AggregatedDeliveryStats = {
  main_sum: number;
  main_count: number;
  main_avg: number | null;
  side_sum: number;
  side_count: number;
  side_avg: number | null;
};

export type DeliveryStatsSample = {
  orderId: string;
  supplierId: string;
  placementDate: string;
  deliveryDate: string;
  businessDays: number;
  orderType: "Glowne" | "Poboczne";
  dedupKey: string;
};

export type SkippedDeliveryStatsOrder = {
  orderId: string;
  supplierId: string | null;
  reason: string;
};

export function deliveryStatsDedupKey(
  supplierId: string,
  placementDate: string
): string {
  return `${supplierId}|${placementDate}`;
}

export function placementDateFromOrder(
  row: Pick<DeliveryStatsOrderInput, "ordered_at" | "action_at" | "status">
): string | null {
  const placement = orderPlacementAt({
    ordered_at: row.ordered_at,
    action_at: row.action_at,
    status: row.status as never,
  });
  if (!placement) return null;
  return warsawDateKeyFromIso(placement);
}

/** Deterministyczny wybór próbki: najwcześniejsza dostawa, potem id. */
export function sortOrdersForDeliveryStatsSelection(
  orders: DeliveryStatsOrderInput[]
): DeliveryStatsOrderInput[] {
  return [...orders].sort((a, b) => {
    const da = a.delivery_at ?? "";
    const db = b.delivery_at ?? "";
    if (da !== db) return da.localeCompare(db);
    return a.id.localeCompare(b.id);
  });
}

export function isOrderSelectedAsDeliveryStatsSample(
  orderId: string,
  orders: DeliveryStatsOrderInput[]
): boolean {
  const { samples } = aggregateDeliveryStatsFromOrders(orders);
  return samples.some((sample) => sample.orderId === orderId);
}

function finalizeAggregate(raw: {
  Glowne: { sum: number; count: number };
  Poboczne: { sum: number; count: number };
}): AggregatedDeliveryStats {
  return {
    main_sum: raw.Glowne.sum,
    main_count: raw.Glowne.count,
    main_avg: raw.Glowne.count ? Math.round(raw.Glowne.sum / raw.Glowne.count) : null,
    side_sum: raw.Poboczne.sum,
    side_count: raw.Poboczne.count,
    side_avg: raw.Poboczne.count ? Math.round(raw.Poboczne.sum / raw.Poboczne.count) : null,
  };
}

/** Agregacja próbek — jedna próbka na dostawcę + dzień zamówienia (canonical / pełne przeliczenie). */
export function aggregateDeliveryStatsFromOrders(orders: DeliveryStatsOrderInput[]): {
  bySupplier: Map<string, AggregatedDeliveryStats>;
  samples: DeliveryStatsSample[];
  skipped: SkippedDeliveryStatsOrder[];
} {
  const processed = new Set<string>();
  const rawBySupplier = new Map<
    string,
    { Glowne: { sum: number; count: number }; Poboczne: { sum: number; count: number } }
  >();
  const samples: DeliveryStatsSample[] = [];
  const skipped: SkippedDeliveryStatsOrder[] = [];

  for (const row of sortOrdersForDeliveryStatsSelection(orders)) {
    if (row.request_kind === "informacja") {
      skipped.push({ orderId: row.id, supplierId: row.supplier_id, reason: "informacja" });
      continue;
    }
    if (row.status !== DELIVERY_STATS_COMPLETED_STATUS) {
      skipped.push({
        orderId: row.id,
        supplierId: row.supplier_id,
        reason: "nie w pełni zrealizowane",
      });
      continue;
    }
    if (isMissingProduct(row.products)) {
      skipped.push({ orderId: row.id, supplierId: row.supplier_id, reason: "brak produktu" });
      continue;
    }
    if (!row.supplier_id) {
      skipped.push({ orderId: row.id, supplierId: null, reason: "brak dostawcy" });
      continue;
    }
    if (!row.order_type || row.order_type === "None") {
      skipped.push({ orderId: row.id, supplierId: row.supplier_id, reason: "brak typu zamówienia" });
      continue;
    }

    const placementDate = placementDateFromOrder(row);
    const deliveryDate = parseDateOnly(row.delivery_at);
    if (!placementDate || !deliveryDate) {
      skipped.push({
        orderId: row.id,
        supplierId: row.supplier_id,
        reason: !placementDate ? "brak daty zamówienia" : "brak daty dostawy",
      });
      continue;
    }

    const orderDate = parseDateOnly(
      orderPlacementAt({
        ordered_at: row.ordered_at,
        action_at: row.action_at,
        status: row.status as never,
      })!
    )!;
    const deliveryDateKey = warsawDateKeyFromIso(deliveryDate.toISOString());
    const dedupKey = deliveryStatsDedupKey(row.supplier_id, placementDate);
    if (processed.has(dedupKey)) {
      skipped.push({ orderId: row.id, supplierId: row.supplier_id, reason: "duplikat dnia" });
      continue;
    }

    const days = calculateBusinessDays(orderDate, deliveryDate);
    if (days < 0) {
      skipped.push({ orderId: row.id, supplierId: row.supplier_id, reason: "ujemne dni robocze" });
      continue;
    }

    processed.add(dedupKey);
    const orderType = row.order_type === "Glowne" ? "Glowne" : "Poboczne";
    if (!rawBySupplier.has(row.supplier_id)) {
      rawBySupplier.set(row.supplier_id, {
        Glowne: { sum: 0, count: 0 },
        Poboczne: { sum: 0, count: 0 },
      });
    }
    const bucket = rawBySupplier.get(row.supplier_id)!;
    bucket[orderType].sum += days;
    bucket[orderType].count += 1;

    samples.push({
      orderId: row.id,
      supplierId: row.supplier_id,
      placementDate,
      deliveryDate: deliveryDateKey,
      businessDays: days,
      orderType,
      dedupKey,
    });
  }

  const bySupplier = new Map<string, AggregatedDeliveryStats>();
  for (const [supplierId, raw] of rawBySupplier) {
    bySupplier.set(supplierId, finalizeAggregate(raw));
  }

  return { bySupplier, samples, skipped };
}

export function aggregatedToDeliveryStatsRow(
  supplierId: string,
  agg: AggregatedDeliveryStats
): {
  supplier_id: string;
  main_sum: number | null;
  main_count: number | null;
  main_avg: number | null;
  side_sum: number | null;
  side_count: number | null;
  side_avg: number | null;
} {
  return {
    supplier_id: supplierId,
    main_sum: agg.main_count ? agg.main_sum : null,
    main_count: agg.main_count || null,
    main_avg: agg.main_avg,
    side_sum: agg.side_count ? agg.side_sum : null,
    side_count: agg.side_count || null,
    side_avg: agg.side_avg,
  };
}

/** Przyrostowo: czy inne zrealizowane zamówienie już zajęło ten dzień zamówienia u dostawcy. */
export function hasSiblingDeliveryStatsSample(
  order: DeliveryStatsOrderInput,
  siblings: DeliveryStatsOrderInput[]
): boolean {
  const placementDate = placementDateFromOrder(order);
  if (!placementDate || !order.supplier_id) return false;
  const dedupKey = deliveryStatsDedupKey(order.supplier_id, placementDate);
  return siblings.some((row) => {
    if (row.id === order.id) return false;
    if (row.status !== DELIVERY_STATS_COMPLETED_STATUS) return false;
    if (row.supplier_id !== order.supplier_id) return false;
    const siblingDate = placementDateFromOrder(row);
    if (!siblingDate) return false;
    return deliveryStatsDedupKey(row.supplier_id!, siblingDate) === dedupKey;
  });
}

export function businessDaysForDeliveryStatsSample(
  order: DeliveryStatsOrderInput,
  deliveryAtIso: string
): number | null {
  if (order.request_kind === "informacja") return null;
  if (isMissingProduct(order.products)) return null;
  if (!order.supplier_id || !order.order_type || order.order_type === "None") return null;

  const placement = orderPlacementAt({
    ordered_at: order.ordered_at,
    action_at: order.action_at,
    status: order.status as never,
  });
  const orderDate = placement ? parseDateOnly(placement) : null;
  const deliveryDate = parseDateOnly(deliveryAtIso);
  if (!orderDate || !deliveryDate) return null;

  const days = calculateBusinessDays(orderDate, deliveryDate);
  return days >= 0 ? days : null;
}
