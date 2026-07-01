import type { SupabaseClient } from "@supabase/supabase-js";
import {
  repairIncompleteIndividualOrders,
  repairTeethOrdersFromVerification,
} from "@/lib/services/repair-incomplete-orders";

/** Naprawa statusów — błąd nie blokuje ładowania strony, ale jest logowany. */
export async function runRepairIncompleteIndividualOrders(
  supabase: SupabaseClient
): Promise<number> {
  try {
    const [regular, teeth] = await Promise.all([
      repairIncompleteIndividualOrders(supabase),
      repairTeethOrdersFromVerification(supabase),
    ]);
    return regular + teeth;
  } catch (err) {
    console.error("[repairIncompleteIndividualOrders]", err);
    return 0;
  }
}
