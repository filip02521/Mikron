import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { runRepairIncompleteIndividualOrders } from "@/lib/services/repair-incomplete-orders-runner";
import { autoAcknowledgeStaleWarehouseInventory } from "@/lib/services/auto-ack-stale-shelf";

export type OrderMaintenanceOnLoadOptions = {
  /** Uzupełnienie supplier_id w Weryfikacji — przed pierwszym fetch listy (/weryfikacja). */
  autoAssign?: boolean;
  autoAssignLimit?: number;
};

/**
 * Naprawa statusów (+ opcjonalnie auto-assign) przed fetch danych strony.
 * Nie wywoływać z AppShell / lekkich countów — tylko z page.tsx zakupów/magazynu/zębów.
 */
export async function runOrderMaintenanceBeforePageLoad(
  options: OrderMaintenanceOnLoadOptions = {}
): Promise<void> {
  if (!hasSupabaseConfig()) return;

  const supabase = createAdminClient();
  await autoAcknowledgeStaleWarehouseInventory(supabase);
  await runRepairIncompleteIndividualOrders(supabase);

  if (options.autoAssign) {
    const { autoAssignMissingSuppliersFromCatalog } = await import(
      "@/lib/services/auto-assign-suppliers"
    );
    try {
      await autoAssignMissingSuppliersFromCatalog({
        limit: options.autoAssignLimit ?? 80,
      });
    } catch (e) {
      console.error("[runOrderMaintenanceBeforePageLoad autoAssign]", e);
    }
  }
}

/** @deprecated Użyj runOrderMaintenanceBeforePageLoad przed fetch — after() zmienia pierwszy render. */
export async function runDeferredOrderMaintenance(
  options: OrderMaintenanceOnLoadOptions = {}
): Promise<void> {
  return runOrderMaintenanceBeforePageLoad(options);
}
