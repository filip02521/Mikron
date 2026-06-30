import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { normalizeIndividualOrder } from "@/lib/data/normalize-order";
import { fetchTeethDetailsForOrders } from "@/lib/data/teeth-order-details";
import { fetchTeethProductInfo } from "@/lib/data/teeth-products";
import {
  canEditIndividualRequestGroup,
  isIndividualOrderEditable,
} from "@/lib/orders/individual-request-edit";
import { editInitialFromOrders } from "@/lib/orders/individual-request-edit-ui";
import { fetchSuppliersForForm, fetchSalesPeople } from "@/lib/data/queries";
import { enrichTeethDetailsForDisplay } from "@/lib/teeth/teeth-validation";
import type { TeethKind } from "@/lib/teeth/teeth-catalog";
import type { IndividualOrder } from "@/types/database";
import type { EditIndividualRequestInitial } from "@/components/orders/EditIndividualRequestModal";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";

export type TeethEditContext = {
  order: IndividualOrder;
  initial: EditIndividualRequestInitial;
  suppliers: OrderFormSupplierOption[];
  salesPeople: { id: string; name: string }[];
  canEdit: boolean;
  editBlockedReason: string | null;
};

export async function fetchTeethOrderEditContext(orderId: string): Promise<TeethEditContext> {
  if (!hasSupabaseConfig()) {
    throw new Error("Brak konfiguracji bazy danych");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("id", orderId)
    .eq("is_teeth", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nie znaleziono pozycji zębowej");

  const [teethMap, teethProducts, suppliers, salesPeopleRows] = await Promise.all([
    fetchTeethDetailsForOrders([orderId]),
    fetchTeethProductInfo().catch(() => []),
    fetchSuppliersForForm(),
    fetchSalesPeople(),
  ]);

  const rawOrder = normalizeIndividualOrder(data);
  const adminKind: TeethKind | null =
    rawOrder.subiekt_tw_id != null && rawOrder.subiekt_tw_id > 0
      ? (teethProducts.find((row) => row.twId === Math.trunc(rawOrder.subiekt_tw_id!))?.kind ??
        null)
      : null;

  const order = normalizeIndividualOrder({
    ...data,
    teeth_details: enrichTeethDetailsForDisplay(teethMap.get(orderId) ?? null, adminKind),
  });

  const salesPeople = salesPeopleRows.map((sp) => ({
    id: sp.id,
    name: sp.name,
  }));

  const canEdit = canEditIndividualRequestGroup([order]);
  let editBlockedReason: string | null = null;
  if (!canEdit) {
    if (order.ordered_at?.trim()) {
      editBlockedReason = "Pozycja została już zamówiona u dostawcy — użyj „Cofnij zamówienie” w historii.";
    } else if (order.status === "Anulowane") {
      editBlockedReason = "Pozycja jest anulowana.";
    } else if (!isIndividualOrderEditable(order)) {
      editBlockedReason = "Ta pozycja nie podlega już edycji.";
    } else {
      editBlockedReason = "Brak uprawnień do edycji.";
    }
  }

  return {
    order,
    initial: editInitialFromOrders([order]),
    suppliers,
    salesPeople,
    canEdit,
    editBlockedReason,
  };
}
