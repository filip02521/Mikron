import { hasSupabaseConfig } from "@/lib/supabase/admin";
import { fetchActiveDeliveryStatsSamples } from "@/lib/data/delivery-stats-samples";
import { fetchDeliveryEtaUseP50Enabled } from "@/lib/data/delivery-stats-flags";
import {
  quantilesFromSampleRows,
  type DeliveryEtaSupplierQuantiles,
} from "@/lib/orders/delivery-eta-quantiles-shared";
import type { IndividualOrder } from "@/types/database";

export type { DeliveryEtaSupplierQuantiles };
export {
  pickQuantilesForOrderType,
  leadTimeDisplayFromQuantiles,
} from "@/lib/orders/delivery-eta-quantiles-shared";

/**
 * Ładuje kwantyle z delivery_stats_samples dla wskazanych dostawców.
 * Gdy tabela nie istnieje / brak samples → pusta mapa (ETA = mean z delivery_stats).
 */
export async function loadDeliveryEtaQuantilesForSupplierIds(
  supplierIds: string[]
): Promise<{
  useP50: boolean;
  bySupplierId: Record<string, DeliveryEtaSupplierQuantiles>;
}> {
  const useP50 = await fetchDeliveryEtaUseP50Enabled();
  const unique = [...new Set(supplierIds.map((id) => id?.trim()).filter(Boolean))] as string[];
  if (!hasSupabaseConfig() || unique.length === 0) {
    return { useP50, bySupplierId: {} };
  }

  try {
    const samples = await fetchActiveDeliveryStatsSamples(unique);
    const bySupplierId: Record<string, DeliveryEtaSupplierQuantiles> = {};
    for (const supplierId of unique) {
      const rows = samples.filter((s) => s.supplier_id === supplierId);
      if (!rows.length) continue;
      bySupplierId[supplierId] = {
        LACZNIE: quantilesFromSampleRows(rows, "Glowne", "LACZNIE"),
        Glowne: quantilesFromSampleRows(rows, "Glowne", "OSOBNO"),
        Poboczne: quantilesFromSampleRows(rows, "Poboczne", "OSOBNO"),
      };
    }
    return { useP50, bySupplierId };
  } catch (e) {
    console.warn("loadDeliveryEtaQuantilesForSupplierIds:", e);
    return { useP50, bySupplierId: {} };
  }
}

export async function loadDeliveryEtaQuantilesForOrders(
  orders: IndividualOrder[]
): Promise<{
  useP50: boolean;
  bySupplierId: Record<string, DeliveryEtaSupplierQuantiles>;
}> {
  const supplierIds = orders
    .map((o) => o.supplier_id)
    .filter((id): id is string => Boolean(id?.trim()));
  return loadDeliveryEtaQuantilesForSupplierIds(supplierIds);
}

