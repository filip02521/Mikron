import { fetchSalesPeople, fetchSupplierDeliveryContext } from "@/lib/data/queries";
import { OrderFormClient } from "@/components/orders/OrderFormClient";
import { ProsbaDelegatePicker } from "@/components/orders/ProsbaDelegatePicker";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { isSalesManager } from "@/lib/auth-roles";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { Alert } from "@/components/ui/Alert";
import { resolveProsbaSupplierId } from "@/lib/orders/prosba-url";

export default async function ProsbaPage({
  searchParams,
}: {
  searchParams: Promise<{ dla?: string; dostawca?: string }>;
}) {
  const { dla: delegateId, dostawca: dostawcaParam } = await searchParams;
  let suppliers: Awaited<
    ReturnType<typeof fetchSupplierDeliveryContext>
  >["suppliers"] = [];
  let statsBySupplierId: Awaited<
    ReturnType<typeof fetchSupplierDeliveryContext>
  >["statsBySupplierId"] = {};
  let salesPeople: { id: string; name: string }[] = [];
  let lockedSalesPerson: { id: string; name: string } | null = null;
  let isSales = false;
  let isManager = false;
  let managerSelfId: string | null = null;

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
    if (user?.role === "sales" || user?.role === "sales_manager") {
      isSales = user.role === "sales";
      isManager = isSalesManager(user.role);
      const own = await resolveSalesPersonForUser(user);
      managerSelfId = own?.id ?? null;

      if (isManager) {
        if (delegateId) {
          lockedSalesPerson = await resolvePreviewSalesPerson(delegateId);
        } else {
          lockedSalesPerson = own;
        }
      } else {
        lockedSalesPerson = own;
      }
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

  if (isManager && !lockedSalesPerson) {
    return (
      <>
        <PageHeader
          title="Zgłoś prośbę"
          description="Wybierz handlowca z zespołu lub powiąż swoje konto z kartą handlowca."
        />
        <Alert tone="warning">
          Aby składać prośby w swoim imieniu, administrator musi przypisać Ci kartę handlowca.
          Możesz od razu złożyć prośbę w imieniu innej osoby z{" "}
          <a href="/zespol" className="font-medium text-indigo-700 underline">
            podglądu zespołu
          </a>
          .
        </Alert>
      </>
    );
  }

  if (isManager && delegateId && !lockedSalesPerson) {
    return (
      <>
        <PageHeader title="Zgłoś prośbę" description="Nie znaleziono wybranego handlowca." />
        <Alert tone="error">Sprawdź link lub wybierz osobę z listy zespołu.</Alert>
      </>
    );
  }

  const delegatePeople = isManager
    ? salesPeople
    : [];

  const initialSupplierId = resolveProsbaSupplierId(
    dostawcaParam,
    suppliers.map((s) => s.id)
  );

  return (
    <>
      <PageHeader
        title="Zgłoś prośbę"
        description={
          isManager && lockedSalesPerson && lockedSalesPerson.id !== managerSelfId
            ? `Prośba zostanie przypisana do ${lockedSalesPerson.name} i pojawi się na jego panelu.`
            : isManager
              ? "Możesz zgłosić prośbę dla siebie lub w imieniu handlowca z zespołu."
              : "Prośba jest zawsze składana na Twoje konto — wybierasz tylko dostawcę i produkt."
        }
      />
      {isManager && managerSelfId && delegatePeople.length > 0 && lockedSalesPerson ? (
        <ProsbaDelegatePicker
          people={delegatePeople}
          selectedId={lockedSalesPerson.id}
          selfId={managerSelfId}
        />
      ) : null}
      {lockedSalesPerson ? (
        <OrderFormClient
          suppliers={suppliers}
          statsBySupplierId={statsBySupplierId}
          salesPeople={salesPeople}
          lockedSalesPerson={lockedSalesPerson}
          singleGroup
          submitForOther={isManager && lockedSalesPerson.id !== managerSelfId}
          initialSupplierId={initialSupplierId}
        />
      ) : (
        <OrderFormClient
          suppliers={suppliers}
          statsBySupplierId={statsBySupplierId}
          salesPeople={salesPeople}
          initialSupplierId={initialSupplierId}
        />
      )}
    </>
  );
}
