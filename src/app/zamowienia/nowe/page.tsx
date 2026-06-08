import { fetchSupplierFormContext } from "@/lib/data/queries";
import { fetchSalesPeopleForPicker } from "@/lib/data/sales-people-admin";
import { OrderFormClient } from "@/components/orders/OrderFormClient";
import { getAppRole } from "@/lib/auth-dev";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("noweZamowienia");

export default async function NoweZamowieniePage() {
  const role = await getAppRole();
  let suppliers: Awaited<ReturnType<typeof fetchSupplierFormContext>>["suppliers"] = [];
  let statsBySupplierId: Awaited<
    ReturnType<typeof fetchSupplierFormContext>
  >["statsBySupplierId"] = {};
  let salesPeople: { id: string; name: string }[] = [];
  try {
    const ctx = await fetchSupplierFormContext();
    suppliers = ctx.suppliers;
    statsBySupplierId = ctx.statsBySupplierId;
    salesPeople = await fetchSalesPeopleForPicker();
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
