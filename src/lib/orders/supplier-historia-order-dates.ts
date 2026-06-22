import { createAdminClient } from "@/lib/supabase/admin";
import { supplierOrderDatesFromHistoria } from "@/lib/orders/historia-schedule-actions";
import { historyRetentionCutoffIso } from "@/lib/orders/history-retention";

/** Daty zamówień głównych u dostawcy z normal_order_history (akcja „Zamówione”). */
export async function loadSupplierHistoriaOrderDates(supplierId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("normal_order_history")
    .select("action_at, action")
    .eq("supplier_id", supplierId)
    .gte("action_at", historyRetentionCutoffIso())
    .order("action_at", { ascending: true });

  if (error) throw new Error(error.message);
  return supplierOrderDatesFromHistoria(data ?? []);
}
