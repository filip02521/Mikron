import { Suspense } from "react";
import { fetchSalesPeople, fetchSupplierDeliveryContext } from "@/lib/data/queries";
import { OrderFormClient } from "@/components/orders/OrderFormClient";
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
        title="Nowa prośba"
        description="Formularz jest dostępny po powiązaniu konta z kartą handlowca."
      />
    );
  }

  if (isManager && !lockedSalesPerson) {
    return (
      <>
        <PageHeader
          title="Nowa prośba"
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
        <PageHeader title="Nowa prośba" description="Nie znaleziono wybranego handlowca." />
        <Alert tone="error">Sprawdź link lub wybierz osobę z listy zespołu.</Alert>
      </>
    );
  }

  const delegatePeople = isManager ? salesPeople : [];
  const initialSupplierId = resolveProsbaSupplierId(
    dostawcaParam,
    suppliers.map((s) => s.id)
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Suspense
        fallback={
          <p className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            Ładowanie formularza…
          </p>
        }
      >
      {lockedSalesPerson ? (
        <OrderFormClient
          suppliers={suppliers}
          statsBySupplierId={statsBySupplierId}
          salesPeople={salesPeople}
          lockedSalesPerson={lockedSalesPerson}
          singleGroup
          submitForOther={isManager && lockedSalesPerson.id !== managerSelfId}
          initialSupplierId={initialSupplierId}
          delegatePeople={
            isManager && managerSelfId && delegatePeople.length > 0
              ? delegatePeople
              : undefined
          }
          managerSelfId={managerSelfId ?? undefined}
        />
      ) : (
        <OrderFormClient
          suppliers={suppliers}
          statsBySupplierId={statsBySupplierId}
          salesPeople={salesPeople}
          initialSupplierId={initialSupplierId}
        />
      )}
      </Suspense>
    </div>
  );
}
