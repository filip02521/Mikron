import { fetchSuppliersForRequestForms, fetchVerificationOrders } from "@/lib/data/queries";
import { runOrderMaintenanceBeforePageLoad } from "@/lib/services/deferred-order-maintenance";
import { fetchSalesPeopleForPicker } from "@/lib/data/sales-people-admin";
import { VerificationClient } from "@/components/verification/VerificationClient";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import type { IndividualOrder } from "@/types/database";

export default async function WeryfikacjaPage() {
  await runOrderMaintenanceBeforePageLoad({ autoAssign: true });

  let orders: IndividualOrder[] = [];
  let suppliers: OrderFormSupplierOption[] = [];
  let salesPeople: { id: string; name: string }[] = [];

  try {
    const [o, s] = await Promise.all([
      fetchVerificationOrders(),
      fetchSuppliersForRequestForms(),
    ]);
    orders = o;
    suppliers = s;
    salesPeople = await fetchSalesPeopleForPicker();
  } catch {
    /* empty */
  }

  return (
    <VerificationClient
      orders={orders}
      suppliers={suppliers}
      salesPeople={salesPeople.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
