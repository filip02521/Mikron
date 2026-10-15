import { revalidatePath } from "next/cache";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { runRepairIncompleteIndividualOrders } from "@/lib/services/repair-incomplete-orders-runner";
import { autoAcknowledgeStaleWarehouseInventory } from "@/lib/services/auto-ack-stale-shelf";
import {
  markVerificationAutoAssignSynced,
  markVerificationQueueSynced,
} from "@/lib/data/queries";

export type OrderMaintenanceOnLoadOptions = {
  /** Uzupełnienie supplier_id w Weryfikacji — przed pierwszym fetch listy (/weryfikacja, /podsumowanie). */
  autoAssign?: boolean;
  autoAssignLimit?: number;
};

/** Po cichym promote Weryfikacja→Nowe odśwież nav (badge) i listy zakupów. */
export function revalidateAfterVerificationAutoAssign(): void {
  revalidatePath("/", "layout");
  revalidatePath("/podsumowanie");
  revalidatePath("/weryfikacja");
  revalidatePath("/kolejka");
}

/**
 * Naprawa statusów (+ opcjonalnie auto-assign) przed fetch danych strony.
 * Lekkie county badge robią auto-assign w syncVerificationQueueStatuses (TTL) —
 * tu pełna konserwacja stron zakupów/magazynu/zębów.
 */
export async function runOrderMaintenanceBeforePageLoad(
  options: OrderMaintenanceOnLoadOptions = {}
): Promise<void> {
  if (!hasSupabaseConfig()) return;

  const supabase = createAdminClient();
  // Po kolei: naprawa statusów widzi stan po auto-potwierdzeniu półki (rzadkie przypadki brzegowe).
  await autoAcknowledgeStaleWarehouseInventory(supabase);
  await runRepairIncompleteIndividualOrders(supabase);
  // Tylko repair — auto-assign ma własne TTL (nie blokuj badge przed promote).
  markVerificationQueueSynced();

  if (options.autoAssign) {
    const { autoAssignMissingSuppliersFromCatalog } = await import(
      "@/lib/services/auto-assign-suppliers"
    );
    try {
      const result = await autoAssignMissingSuppliersFromCatalog({
        limit: options.autoAssignLimit ?? 80,
      });
      markVerificationAutoAssignSynced();
      if (result.updated > 0) {
        revalidateAfterVerificationAutoAssign();
      }
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
