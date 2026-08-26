import type { AggregatedDeliveryStats } from "@/lib/orders/delivery-stats-aggregation";
import { aggregatedToDeliveryStatsRow } from "@/lib/orders/delivery-stats-aggregation";
import type { DeliveryEtaVariability } from "@/lib/orders/delivery-eta";
import type { OrderType, StatsMode } from "@/types/database";

export type DeliveryStatsSampleRow = {
  id?: string;
  supplier_id: string;
  order_id: string | null;
  placement_date: string;
  delivery_date: string;
  first_delivery_date?: string | null;
  business_days_full: number;
  business_days_first?: number | null;
  order_type: "Glowne" | "Poboczne";
  is_teeth: boolean;
  source: "receive" | "backfill" | "import";
  deleted_at?: string | null;
  created_at?: string;
};

export type DeliveryStatsQuantiles = {
  p50: number | null;
  p90: number | null;
  nOrders: number;
  placementDayCount: number;
  firstReceiptP50: number | null;
  variability: DeliveryEtaVariability | null;
  nextMorningShare: number | null;
  hasRecentSample: boolean;
};

function percentileNearestRank(sortedAsc: number[], p: number): number | null {
  if (!sortedAsc.length) return null;
  const rank = Math.ceil((p / 100) * sortedAsc.length) - 1;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, rank));
  return sortedAsc[idx]!;
}

/**
 * Mean ważony dniem: 1 waga na (supplier, placement_date, order_type).
 * Wartość dnia = średnia business_days_full próbek tego dnia.
 */
export function aggregateDeliveryStatsFromSampleRows(
  rows: DeliveryStatsSampleRow[]
): Map<string, AggregatedDeliveryStats> {
  type DayBucket = { sum: number; n: number };
  const dayKeys = new Map<string, DayBucket>();

  for (const row of rows) {
    if (row.deleted_at) continue;
    if (row.is_teeth) continue;
    if (row.source === "import") {
      // import synthetic — handled separately in protected avg path; skip live mean
      continue;
    }
    const key = `${row.supplier_id}|${row.placement_date}|${row.order_type}`;
    const bucket = dayKeys.get(key) ?? { sum: 0, n: 0 };
    bucket.sum += row.business_days_full;
    bucket.n += 1;
    dayKeys.set(key, bucket);
  }

  const rawBySupplier = new Map<
    string,
    { Glowne: { sum: number; count: number }; Poboczne: { sum: number; count: number } }
  >();

  for (const [key, bucket] of dayKeys) {
    const [supplierId, , orderType] = key.split("|") as [string, string, "Glowne" | "Poboczne"];
    const dayValue = bucket.sum / bucket.n;
    if (!rawBySupplier.has(supplierId)) {
      rawBySupplier.set(supplierId, {
        Glowne: { sum: 0, count: 0 },
        Poboczne: { sum: 0, count: 0 },
      });
    }
    const raw = rawBySupplier.get(supplierId)!;
    raw[orderType].sum += dayValue;
    raw[orderType].count += 1;
  }

  const bySupplier = new Map<string, AggregatedDeliveryStats>();
  for (const [supplierId, raw] of rawBySupplier) {
    bySupplier.set(supplierId, {
      main_sum: raw.Glowne.sum,
      main_count: raw.Glowne.count,
      main_avg: raw.Glowne.count ? Math.round(raw.Glowne.sum / raw.Glowne.count) : null,
      side_sum: raw.Poboczne.sum,
      side_count: raw.Poboczne.count,
      side_avg: raw.Poboczne.count ? Math.round(raw.Poboczne.sum / raw.Poboczne.count) : null,
    });
  }
  return bySupplier;
}

/** Import-protected rows: synthetic samples that must survive wipe+recalc. */
export function importProtectedStatsFromSampleRows(
  rows: DeliveryStatsSampleRow[]
): Map<string, AggregatedDeliveryStats> {
  const bySupplier = new Map<
    string,
    { Glowne: { sum: number; count: number }; Poboczne: { sum: number; count: number } }
  >();

  for (const row of rows) {
    if (row.deleted_at || row.source !== "import" || row.is_teeth) continue;
    if (!bySupplier.has(row.supplier_id)) {
      bySupplier.set(row.supplier_id, {
        Glowne: { sum: 0, count: 0 },
        Poboczne: { sum: 0, count: 0 },
      });
    }
    const raw = bySupplier.get(row.supplier_id)!;
    raw[row.order_type].sum += row.business_days_full;
    raw[row.order_type].count += 1;
  }

  const result = new Map<string, AggregatedDeliveryStats>();
  for (const [supplierId, raw] of bySupplier) {
    result.set(supplierId, {
      main_sum: raw.Glowne.sum,
      main_count: raw.Glowne.count,
      main_avg: raw.Glowne.count ? Math.round(raw.Glowne.sum / raw.Glowne.count) : null,
      side_sum: raw.Poboczne.sum,
      side_count: raw.Poboczne.count,
      side_avg: raw.Poboczne.count ? Math.round(raw.Poboczne.sum / raw.Poboczne.count) : null,
    });
  }
  return result;
}

export function mergeAggregatedPreferLive(
  live: Map<string, AggregatedDeliveryStats>,
  imported: Map<string, AggregatedDeliveryStats>
): Map<string, AggregatedDeliveryStats> {
  const out = new Map(imported);
  for (const [id, agg] of live) {
    out.set(id, agg);
  }
  return out;
}

export function quantilesFromSampleRows(
  rows: DeliveryStatsSampleRow[],
  orderType: OrderType,
  statsMode: StatsMode,
  options?: { recentWithinDays?: number; now?: Date }
): DeliveryStatsQuantiles {
  const recentWithinDays = options?.recentWithinDays ?? 90;
  const now = options?.now ?? new Date();
  const recentCutoff = new Date(now);
  recentCutoff.setDate(recentCutoff.getDate() - recentWithinDays);
  const recentKey = recentCutoff.toISOString().slice(0, 10);

  const active = rows.filter((r) => {
    if (r.deleted_at || r.is_teeth || r.source === "import") return false;
    if (statsMode === "OSOBNO") {
      if (orderType === "Glowne" || orderType === "Poboczne") {
        return r.order_type === orderType;
      }
    }
    return true;
  });

  const days = active.map((r) => r.business_days_full).sort((a, b) => a - b);
  const firstDays = active
    .map((r) => r.business_days_first)
    .filter((d): d is number => d != null && d >= 0)
    .sort((a, b) => a - b);

  const daySet = new Set(active.map((r) => `${r.placement_date}|${r.order_type}`));
  const p50 = percentileNearestRank(days, 50);
  const p90 = days.length >= 5 ? percentileNearestRank(days, 90) : null;
  const firstReceiptP50 = percentileNearestRank(firstDays, 50);

  let variability: DeliveryEtaVariability | null = null;
  if (p50 != null && p90 != null && days.length >= 5) {
    variability = p90 - p50 >= 5 ? "wide" : "stable";
  }

  const nextMorning = active.filter((r) => r.business_days_full === 1).length;
  const nextMorningShare = active.length ? nextMorning / active.length : null;
  const hasRecentSample = active.some((r) => r.delivery_date >= recentKey);

  return {
    p50,
    p90,
    nOrders: active.length,
    placementDayCount: daySet.size,
    firstReceiptP50,
    variability,
    nextMorningShare,
    hasRecentSample: active.length === 0 ? false : hasRecentSample,
  };
}

export function sampleRowsToDeliveryStatsPayload(
  bySupplier: Map<string, AggregatedDeliveryStats>
): Array<ReturnType<typeof aggregatedToDeliveryStatsRow> & { updated_at: string }> {
  const now = new Date().toISOString();
  return [...bySupplier.entries()].map(([supplierId, agg]) => ({
    ...aggregatedToDeliveryStatsRow(supplierId, agg),
    updated_at: now,
  }));
}
