import {
  quantilesFromSampleRows,
  type DeliveryStatsQuantiles,
} from "@/lib/orders/delivery-stats-samples";
import type { StatsMode } from "@/types/database";

export type DeliveryEtaSupplierQuantiles = {
  LACZNIE: DeliveryStatsQuantiles;
  Glowne: DeliveryStatsQuantiles;
  Poboczne: DeliveryStatsQuantiles;
};

export function pickQuantilesForOrderType(
  bucket: DeliveryEtaSupplierQuantiles | undefined,
  statsMode: StatsMode,
  orderType: string
): DeliveryStatsQuantiles | undefined {
  if (!bucket) return undefined;
  if (statsMode === "LACZNIE") return bucket.LACZNIE;
  if (orderType === "Poboczne") return bucket.Poboczne;
  return bucket.Glowne;
}

/** Opcje lead-time UI z kwantyli dostawcy (brief / drawer / prośba). */
export function leadTimeDisplayFromQuantiles(
  bucket: DeliveryEtaSupplierQuantiles | undefined,
  useP50: boolean
): import("@/lib/orders/delivery-eta").LeadTimeDisplayOptions {
  if (!bucket) return { useP50 };
  return {
    useP50,
    p50Combined: bucket.LACZNIE.p50,
    p50Main: bucket.Glowne.p50,
    p50Side: bucket.Poboczne.p50,
    nOrders: bucket.LACZNIE.nOrders > 0 ? bucket.LACZNIE.nOrders : null,
    variability: bucket.LACZNIE.variability,
    hasRecentSample: bucket.LACZNIE.hasRecentSample,
  };
}

/** Re-export dla modułów serwerowych budujących kwantyle z wierszy samples. */
export { quantilesFromSampleRows };
