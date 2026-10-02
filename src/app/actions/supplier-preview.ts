"use server";

// @service-role-ok — autoryzacja requireOperations("read"); odczyt jednego dostawcy po warstwie aplikacji.

import { requireOperations } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/admin";
import { fetchDeliveryStats, fetchSuppliersOnVacationNow, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { fetchTeethSupplierLaneIndex } from "@/lib/data/teeth-schedule";
import { fetchZdEstimateSupplierScope } from "@/lib/data/zd-estimate-supplier-scopes";
import { buildSummaryWorkspace, type SupplierSummaryMeta } from "@/lib/orders/summary-workspace";
import {
  supplierSubiektScopeInfoFromRow,
  type SupplierSubiektScopeInfo,
} from "@/lib/orders/zd-estimate-supplier-scope";
import { leadTimeDisplayFromQuantiles } from "@/lib/orders/delivery-eta-quantiles-shared";
import type { LeadTimeDisplayOptions } from "@/lib/orders/delivery-eta";
import type { SupplierOnVacationWindow } from "@/lib/orders/procurement-supplier-vacation";
import type { TeethSupplierLaneSnapshot } from "@/lib/data/teeth-schedule-shared";
import type { DeliveryStats, StatsMode } from "@/types/database";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dane podglądu dostawcy — te same, które panel dzienny ma z SSR. */
export type SupplierPreviewData = {
  supplier: SupplierSummaryMeta;
  vacationWindow: SupplierOnVacationWindow | null;
  teethLane: TeethSupplierLaneSnapshot | null;
  subiektScope: SupplierSubiektScopeInfo | null;
  deliveryStats: DeliveryStats | null;
  statsMode: StatsMode;
  leadTimeDisplay: LeadTimeDisplayOptions;
};

/**
 * Podgląd jednego dostawcy poza panelem dziennym (np. okno po utworzeniu ZD).
 * Termin liczony tą samą logiką co panel (`buildSummaryWorkspace`), więc daty się zgadzają.
 * Części poboczne (statystyki, czasy dostaw, tor zębów) przy błędzie są pomijane.
 */
export async function actionGetSupplierPreview(
  supplierId: string
): Promise<{ ok: true; data: SupplierPreviewData } | { ok: false; message: string }> {
  await requireOperations("read");
  const id = (supplierId ?? "").trim();
  if (!UUID_RE.test(id)) return { ok: false, message: "Nieprawidłowy dostawca." };
  if (!hasSupabaseConfig()) return { ok: false, message: "Brak konfiguracji bazy." };

  const [schedules, onVacation, scopeRow, statsRows, teethIndex, quantiles] = await Promise.all([
    fetchSuppliersWithSchedules(undefined, { activeOnly: false, supplierIds: [id] }),
    fetchSuppliersOnVacationNow().catch(() => ({}) as Record<string, SupplierOnVacationWindow>),
    fetchZdEstimateSupplierScope(id).catch(() => null),
    fetchDeliveryStats().catch(() => []),
    fetchTeethSupplierLaneIndex().catch(() => new Map<string, TeethSupplierLaneSnapshot>()),
    import("@/lib/orders/delivery-eta-quantiles-load")
      .then((m) => m.loadDeliveryEtaQuantilesForSupplierIds([id]))
      .catch(() => null),
  ]);

  const supplier = buildSummaryWorkspace(schedules, []).supplierMeta[id];
  if (!supplier) return { ok: false, message: "Nie znaleziono dostawcy." };
  const vacationWindow = (onVacation as Record<string, SupplierOnVacationWindow>)[id] ?? null;
  if (vacationWindow) supplier.on_vacation_now = true;

  const deliveryStats =
    (statsRows as DeliveryStats[]).find((s) => s.supplier_id === id) ?? null;

  return {
    ok: true,
    data: {
      supplier,
      vacationWindow,
      teethLane: teethIndex.get(id) ?? null,
      subiektScope: scopeRow ? supplierSubiektScopeInfoFromRow(scopeRow) : null,
      deliveryStats,
      statsMode: supplier.stats_mode ?? "LACZNIE",
      leadTimeDisplay: leadTimeDisplayFromQuantiles(
        quantiles?.bySupplierId[id],
        quantiles?.useP50 ?? false
      ),
    },
  };
}
