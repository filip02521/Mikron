import { fetchSalesPeople, fetchSupplierDeliveryContext } from "@/lib/data/queries";
import { OrderFormClient } from "@/components/orders/OrderFormClient";
import { getAppRole } from "@/lib/auth-dev";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
export default async function NoweZamowieniePage() {
  const role = await getAppRole();
  let suppliers: Awaited<
    ReturnType<typeof fetchSupplierDeliveryContext>
  >["suppliers"] = [];
  let statsBySupplierId: Awaited<
    ReturnType<typeof fetchSupplierDeliveryContext>
  >["statsBySupplierId"] = {};
  let salesPeople: { id: string; name: string }[] = [];
  try {
    const ctx = await fetchSupplierDeliveryContext();
    suppliers = ctx.suppliers;
    statsBySupplierId = ctx.statsBySupplierId;
    salesPeople = await fetchSalesPeople();
  } catch {
    /* empty */
  }

  let lockedSalesPerson: { id: string; name: string } | null = null;
  if (role === "sales") {
    try {
      const user = await getSessionUser();
      if (user) lockedSalesPerson = await resolveSalesPersonForUser(user);
    } catch {
      /* dev */
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <OrderFormClient
        suppliers={suppliers}
        statsBySupplierId={statsBySupplierId}
        salesPeople={salesPeople}
        lockedSalesPerson={lockedSalesPerson}
      />
    </div>
  );
}
