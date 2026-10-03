/**
 * Przewidywany termin dostawy do opisu nowego ZD — ten sam silnik co ETA w aplikacji:
 * dziś + typowy czas realizacji dostawcy (delivery_stats / kwantyle próbek, dni robocze).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateDeliveryEta, estimateOptionsFromQuantiles } from "@/lib/orders/delivery-eta";
import {
  loadDeliveryEtaQuantilesForSupplierIds,
  pickQuantilesForOrderType,
} from "@/lib/orders/delivery-eta-quantiles-load";
import type { DeliveryStats, StatsMode } from "@/types/database";

export type ZdCreateEta = {
  /** yyyy-mm-dd */
  dateKey: string;
  businessDays: number;
  sampleCount: number;
  lowConfidence: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

export async function estimateZdCreateEta(
  supplierId: string,
  todayKey: string
): Promise<ZdCreateEta | null> {
  const id = supplierId.trim();
  if (!id) return null;
  const supabase = createAdminClient();
  const [statsRes, supplierRes, quantiles] = await Promise.all([
    supabase.from("delivery_stats").select("*").eq("supplier_id", id).maybeSingle(),
    supabase.from("suppliers").select("stats_mode").eq("id", id).maybeSingle(),
    loadDeliveryEtaQuantilesForSupplierIds([id]),
  ]);
  const stats = (statsRes.data ?? null) as DeliveryStats | null;
  if (!stats) return null;
  const statsMode = ((supplierRes.data?.stats_mode as StatsMode | undefined) ?? "LACZNIE");
  // ZD z Kreatora = zamówienie planowe.
  const q = pickQuantilesForOrderType(quantiles.bySupplierId[id], statsMode, "Glowne");
  const eta = estimateDeliveryEta(
    todayKey,
    stats,
    "Glowne",
    statsMode,
    estimateOptionsFromQuantiles(q, quantiles.useP50)
  );
  if (!eta) return null;
  const d = eta.expectedDate;
  return {
    dateKey: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    businessDays: eta.primaryBusinessDays,
    sampleCount: eta.sampleCount,
    lowConfidence: eta.lowConfidence,
  };
}
