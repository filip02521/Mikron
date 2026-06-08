import type {
  AggregatedDeliveryStats,
  DeliveryStatsOrderInput,
  DeliveryStatsSample,
} from "@/lib/orders/delivery-stats-aggregation";
import { aggregateDeliveryStatsFromOrders } from "@/lib/orders/delivery-stats-aggregation";
import type { DeliveryStats, StatsMode } from "@/types/database";

export type DeliveryStatsHealth =
  | "ok"
  | "low_samples"
  | "no_data"
  | "mismatch"
  | "integrity"
  | "missing_row";

export type DeliveryStatsSupplierDiagnostic = {
  supplierId: string;
  supplierName: string;
  statsMode: StatsMode;
  isActive: boolean;
  stored: DeliveryStats | null;
  storedUpdatedAt: string | null;
  recomputed: AggregatedDeliveryStats;
  samples: DeliveryStatsSample[];
  totalSamples: number;
  combinedAvg: number | null;
  mainAvg: number | null;
  sideAvg: number | null;
  health: DeliveryStatsHealth;
  healthNotes: string[];
  historyOrderCount: number;
  unusedOrderCount: number;
};

export type DeliveryStatsDiagnosticsSummary = {
  supplierCount: number;
  activeSupplierCount: number;
  suppliersWithStoredStats: number;
  suppliersWithSamples: number;
  suppliersNoData: number;
  suppliersLowConfidence: number;
  suppliersMismatch: number;
  suppliersIntegrityIssue: number;
  totalSamples: number;
  totalHistoryOrders: number;
  totalUnusedOrders: number;
  lastStatsUpdate: string | null;
};

export type DeliveryStatsDiagnostics = {
  summary: DeliveryStatsDiagnosticsSummary;
  suppliers: DeliveryStatsSupplierDiagnostic[];
  generatedAt: string;
};

type SupplierRow = {
  id: string;
  name: string;
  stats_mode: StatsMode;
  is_active: boolean;
};

type StoredStatsRow = DeliveryStats & {
  updated_at?: string | null;
};

function storedAsDeliveryStats(row: StoredStatsRow | null): DeliveryStats | null {
  if (!row) return null;
  return {
    supplier_id: row.supplier_id,
    main_sum: row.main_sum,
    main_count: row.main_count,
    main_avg: row.main_avg,
    side_sum: row.side_sum,
    side_count: row.side_count,
    side_avg: row.side_avg,
  };
}

function avgMatches(sum: number | null, count: number | null, avg: number | null): boolean {
  if (!count || count <= 0) return avg == null;
  if (sum == null || avg == null) return false;
  return Math.round(Number(sum) / count) === Number(avg);
}

function storedMismatchFields(
  stored: DeliveryStats,
  recomputed: AggregatedDeliveryStats
): string[] {
  const fields: string[] = [];
  if ((stored.main_count ?? 0) !== recomputed.main_count) fields.push("główne: liczba");
  if ((stored.side_count ?? 0) !== recomputed.side_count) fields.push("poboczne: liczba");
  if (stored.main_avg != null && recomputed.main_avg != null && stored.main_avg !== recomputed.main_avg) {
    fields.push("główne: średnia");
  }
  if (stored.side_avg != null && recomputed.side_avg != null && stored.side_avg !== recomputed.side_avg) {
    fields.push("poboczne: średnia");
  }
  return fields;
}

function evaluateHealth(
  stored: DeliveryStats | null,
  recomputed: AggregatedDeliveryStats,
  totalSamples: number
): { health: DeliveryStatsHealth; notes: string[] } {
  const notes: string[] = [];

  if (stored) {
    if (!avgMatches(stored.main_sum, stored.main_count, stored.main_avg)) {
      notes.push("Wiersz DB: main_avg ≠ round(main_sum / main_count)");
      return { health: "integrity", notes };
    }
    if (!avgMatches(stored.side_sum, stored.side_count, stored.side_avg)) {
      notes.push("Wiersz DB: side_avg ≠ round(side_sum / side_count)");
      return { health: "integrity", notes };
    }
  }

  if (totalSamples === 0 && !stored) {
    notes.push("Brak historii zrealizowanych dostaw i brak wiersza w delivery_stats");
    return { health: "no_data", notes };
  }

  if (totalSamples === 0 && stored) {
    notes.push("Wiersz w delivery_stats bez próbek w historii zamówień (import / stary wpis?)");
    return { health: "mismatch", notes };
  }

  if (totalSamples > 0 && !stored) {
    notes.push("Są próbki w historii, ale brak wiersza delivery_stats — uruchom przeliczenie");
    return { health: "missing_row", notes };
  }

  if (stored && totalSamples > 0) {
    const mismatches = storedMismatchFields(stored, recomputed);
    if (mismatches.length) {
      notes.push(`Rozjazd z historią: ${mismatches.join(", ")}`);
      return { health: "mismatch", notes };
    }
  }

  if (totalSamples > 0 && totalSamples < 3) {
    notes.push("Mniej niż 3 próbki — ETA oznaczone jako szacunek (niska pewność)");
    return { health: "low_samples", notes };
  }

  notes.push("Zgodne z historią zamówień");
  return { health: "ok", notes };
}

export function buildDeliveryStatsDiagnostics(input: {
  suppliers: SupplierRow[];
  storedStats: StoredStatsRow[];
  orders: DeliveryStatsOrderInput[];
  generatedAt?: string;
}): DeliveryStatsDiagnostics {
  const { bySupplier, samples, skipped } = aggregateDeliveryStatsFromOrders(input.orders);
  const storedById = new Map(input.storedStats.map((s) => [s.supplier_id, s]));

  const samplesBySupplier = new Map<string, DeliveryStatsSample[]>();
  for (const sample of samples) {
    const list = samplesBySupplier.get(sample.supplierId) ?? [];
    list.push(sample);
    samplesBySupplier.set(sample.supplierId, list);
  }

  const eligibleBySupplier = new Map<string, number>();
  const skippedBySupplier = new Map<string, number>();
  for (const row of input.orders) {
    if (!row.supplier_id) continue;
    eligibleBySupplier.set(row.supplier_id, (eligibleBySupplier.get(row.supplier_id) ?? 0) + 1);
  }
  for (const row of skipped) {
    if (!row.supplierId) continue;
    skippedBySupplier.set(row.supplierId, (skippedBySupplier.get(row.supplierId) ?? 0) + 1);
  }

  const suppliers: DeliveryStatsSupplierDiagnostic[] = input.suppliers.map((supplier) => {
    const storedRow = storedById.get(supplier.id) ?? null;
    const stored = storedAsDeliveryStats(storedRow);
    const recomputed =
      bySupplier.get(supplier.id) ?? {
        main_sum: 0,
        main_count: 0,
        main_avg: null,
        side_sum: 0,
        side_count: 0,
        side_avg: null,
      };
    const supplierSamples = samplesBySupplier.get(supplier.id) ?? [];
    const totalSamples = supplierSamples.length;
    const { health, notes } = evaluateHealth(stored, recomputed, totalSamples);

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      statsMode: supplier.stats_mode,
      isActive: supplier.is_active,
      stored,
      storedUpdatedAt: storedRow?.updated_at ?? null,
      recomputed,
      samples: supplierSamples.sort((a, b) => b.placementDate.localeCompare(a.placementDate)),
      totalSamples,
      combinedAvg: combinedAvgFromCounts(stored ?? recomputed),
      mainAvg: recomputed.main_avg,
      sideAvg: recomputed.side_avg,
      health,
      healthNotes: notes,
      historyOrderCount: eligibleBySupplier.get(supplier.id) ?? 0,
      unusedOrderCount: skippedBySupplier.get(supplier.id) ?? 0,
    };
  });

  suppliers.sort((a, b) => {
    const rank = (h: DeliveryStatsHealth) =>
      h === "mismatch" || h === "integrity" || h === "missing_row"
        ? 0
        : h === "low_samples"
          ? 1
          : h === "no_data"
            ? 2
            : 3;
    const dr = rank(a.health) - rank(b.health);
    if (dr !== 0) return dr;
    return a.supplierName.localeCompare(b.supplierName, "pl");
  });

  const lastStatsUpdate = input.storedStats.reduce<string | null>((latest, row) => {
    const ts = row.updated_at ?? null;
    if (!ts) return latest;
    if (!latest || ts > latest) return ts;
    return latest;
  }, null);

  const summary: DeliveryStatsDiagnosticsSummary = {
    supplierCount: suppliers.length,
    activeSupplierCount: suppliers.filter((s) => s.isActive).length,
    suppliersWithStoredStats: suppliers.filter((s) => s.stored).length,
    suppliersWithSamples: suppliers.filter((s) => s.totalSamples > 0).length,
    suppliersNoData: suppliers.filter((s) => s.health === "no_data").length,
    suppliersLowConfidence: suppliers.filter((s) => s.health === "low_samples").length,
    suppliersMismatch: suppliers.filter(
      (s) => s.health === "mismatch" || s.health === "missing_row"
    ).length,
    suppliersIntegrityIssue: suppliers.filter((s) => s.health === "integrity").length,
    totalSamples: samples.length,
    totalHistoryOrders: input.orders.length,
    totalUnusedOrders: skipped.length,
    lastStatsUpdate,
  };

  return {
    summary,
    suppliers,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

export function deliveryStatsHealthLabel(health: DeliveryStatsHealth): string {
  switch (health) {
    case "ok":
      return "OK";
    case "low_samples":
      return "Mało próbek";
    case "no_data":
      return "Brak danych";
    case "mismatch":
      return "Rozjazd";
    case "integrity":
      return "Błąd sum";
    case "missing_row":
      return "Brak wiersza";
  }
}

export function formatStatsModeLabel(mode: StatsMode): string {
  return mode === "LACZNIE" ? "Łącznie" : "Osobno (gł./pob.)";
}

function combinedAvgFromCounts(stats: {
  main_sum?: number | null;
  main_count?: number | null;
  side_sum?: number | null;
  side_count?: number | null;
}): number | null {
  const sum = (stats.main_sum ?? 0) + (stats.side_sum ?? 0);
  const count = (stats.main_count ?? 0) + (stats.side_count ?? 0);
  if (count <= 0) return null;
  return Math.round(sum / count);
}

function totalSamplesFromCounts(stats: {
  main_count?: number | null;
  side_count?: number | null;
}): number {
  return (stats.main_count ?? 0) + (stats.side_count ?? 0);
}

export function formatSampleSummary(
  stats: DeliveryStats | AggregatedDeliveryStats | null
): string {
  if (!stats) return "—";
  const total = totalSamplesFromCounts(stats);
  if (!total) return "—";
  const parts: string[] = [];
  if (stats.main_count) parts.push(`gł. ${stats.main_avg ?? "?"} d (${stats.main_count})`);
  if (stats.side_count) parts.push(`pob. ${stats.side_avg ?? "?"} d (${stats.side_count})`);
  const combined = combinedAvgFromCounts(stats);
  if (combined != null && stats.main_count && stats.side_count) {
    parts.push(`łącznie ~${combined} d`);
  }
  return parts.join(" · ") || "—";
}
