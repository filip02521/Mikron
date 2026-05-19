import type { SupabaseClient } from "@supabase/supabase-js";
import { repairIncompleteIndividualOrders } from "@/lib/services/repair-incomplete-orders";

/** Naprawa statusów — błąd nie blokuje ładowania strony, ale jest logowany. */
export async function runRepairIncompleteIndividualOrders(
  supabase: SupabaseClient
): Promise<number> {
  try {
    return await repairIncompleteIndividualOrders(supabase);
  } catch (err) {
    console.error("[repairIncompleteIndividualOrders]", err);
    return 0;
  }
}
