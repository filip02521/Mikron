import type { IndividualOrder } from "@/types/database";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { fetchTeethDeliveryLeadDaysBySupplier } from "@/lib/data/teeth-delivery-eta";

/** Mapa stałego ETA zębów → opcja presentMyOrders (teethEtaSource). */
export async function loadTeethLeadDaysBySupplierIdForOrders(
  orders: ReadonlyArray<Pick<IndividualOrder, "is_teeth" | "supplier_id">>
): Promise<Record<string, number>> {
  if (!hasSupabaseConfig()) return {};
  const supplierIds = [
    ...new Set(
      orders
        .filter((o) => o.is_teeth && o.supplier_id)
        .map((o) => o.supplier_id as string)
    ),
  ];
  if (supplierIds.length === 0) return {};
  try {
    const map = await fetchTeethDeliveryLeadDaysBySupplier(
      createAdminClient(),
      supplierIds
    );
    return Object.fromEntries(map);
  } catch {
    return {};
  }
}
