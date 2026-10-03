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

export async function loadZdOrderHorizons(input: {
  suppliers: readonly SupplierWithSchedule[];
  stockDaysBySupplierId: ReadonlyMap<string, number>;
  todayKey: string;
}): Promise<Map<string, ZdOrderHorizon>> {
  const quantiles = await loadDeliveryEtaQuantilesForSupplierIds(
    input.suppliers.map((s) => s.id)
  );
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
        lead: bucket ? { p50: bucket.p50, p90: bucket.p90, nOrders: bucket.nOrders } : null,
      })
    );
  }
  return out;
}
