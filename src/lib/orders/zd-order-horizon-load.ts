/**
 * Dane do horyzontu zamówienia (harmonogram, interwał, kwantyle dostaw) —
 * wspólne dla Kreatora ZD (opcja „czas dostawy”) i nocnego przebiegu (sygnały).
 */

import type { SupplierWithSchedule } from "@/types/database";
import { resolveSupplierInterval } from "@/lib/orders/dates";
import { isSupplierOrderOnDemand } from "@/lib/orders/supplier-on-demand";
import {
  loadDeliveryEtaQuantilesForSupplierIds,
  pickQuantilesForOrderType,
} from "@/lib/orders/delivery-eta-quantiles-load";
import { resolveZdOrderHorizon, type ZdOrderHorizon } from "@/lib/orders/zd-order-horizon";
import { quantilesFromSampleRows, selectSamplesForStats } from "@/lib/orders/delivery-stats-samples";
import { loadSubiektLeadRowsBySupplier } from "@/lib/data/subiekt-automat-lead";

export async function loadZdOrderHorizons(input: {
  suppliers: readonly SupplierWithSchedule[];
  stockDaysBySupplierId: ReadonlyMap<string, number>;
  todayKey: string;
}): Promise<Map<string, ZdOrderHorizon>> {
  const quantiles = await loadDeliveryEtaQuantilesForSupplierIds(
    input.suppliers.map((s) => s.id)
  );
  // Automat u dostawców „OSOBNO”: czas dostawy ze wszystkich ZD → FZ z Subiekta (statystyki panelu bez zmian).
  const osobno = input.suppliers.filter((s) => s.stats_mode === "OSOBNO").map((s) => s.id);
  const automatRows = await loadSubiektLeadRowsBySupplier(osobno).catch((e: unknown) => {
    console.error("[zd-order-horizon] ZD → FZ z Subiekta dla automatu", e);
    return new Map<string, never[]>();
  });
  const out = new Map<string, ZdOrderHorizon>();
  for (const s of input.suppliers) {
    const stockDays = input.stockDaysBySupplierId.get(s.id);
    if (stockDays == null) continue;
    const bucket = pickQuantilesForOrderType(
      quantiles.bySupplierId[s.id],
      s.stats_mode,
      "Glowne"
    );
    out.set(
      s.id,
      resolveZdOrderHorizon({
        todayKey: input.todayKey,
        stockDays,
        onDemand: isSupplierOrderOnDemand(s),
        nextOrderDate: s.schedule?.computed_next_date ?? null,
        interval: resolveSupplierInterval(s.interval_raw, s.interval_weeks),
        lead: bucket ? { p50: bucket.p50, p90: bucket.p90, nOrders: bucket.nOrders, p90FirstReceipt: bucket.firstReceiptP90 } : null,
        automatLead: (() => {
          const rows = automatRows.get(s.id);
          if (!rows?.length) return null;
          const q = quantilesFromSampleRows(selectSamplesForStats(rows), "Glowne", "LACZNIE");
          return { p50: q.p50, p90: q.p90, nOrders: q.nOrders, p90FirstReceipt: q.firstReceiptP90 };
        })(),
      })
    );
  }
  return out;
}
