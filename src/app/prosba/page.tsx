import { fetchSalesPeople, fetchSupplierDeliveryContext } from "@/lib/data/queries";
import { OrderFormClient } from "@/components/orders/OrderFormClient";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";

export default async function ProsbaPage() {
  let suppliers: Awaited<
    ReturnType<typeof fetchSupplierDeliveryContext>
  >["suppliers"] = [];
  let statsBySupplierId: Awaited<
    ReturnType<typeof fetchSupplierDeliveryContext>
  >["statsBySupplierId"] = {};
  let salesPeople: { id: string; name: string }[] = [];
  let lockedSalesPerson: { id: string; name: string } | null = null;
  let isSales = false;

  try {
    const ctx = await fetchSupplierDeliveryContext();
    suppliers = ctx.suppliers;
    statsBySupplierId = ctx.statsBySupplierId;
    salesPeople = await fetchSalesPeople();
  } catch {
    /* empty */
  }

  try {
    const user = await getSessionUser();
    if (user?.role === "sales") {
      isSales = true;
      lockedSalesPerson = await resolveSalesPersonForUser(user);
    }
  } catch {
    /* empty */
  }

  if (isSales && !lockedSalesPerson) {
    return (
      <SalesAccountLinkRequired
        title="Zgłoś prośbę"
        description="Formularz prośby jest dostępny po powiązaniu konta z kartą handlowca."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Zgłoś prośbę"
        description="Prośba jest zawsze składana na Twoje konto — wybierasz tylko dostawcę i produkt."
      />
      {lockedSalesPerson ? (
        <OrderFormClient
          suppliers={suppliers}
          statsBySupplierId={statsBySupplierId}
          salesPeople={salesPeople}
          lockedSalesPerson={lockedSalesPerson}
          singleGroup
        />
      ) : (
        <OrderFormClient
          suppliers={suppliers}
          statsBySupplierId={statsBySupplierId}
          salesPeople={salesPeople}
        />
      )}
    </>
  );
}
