import { Suspense } from "react";
import { fetchSalesPeople, fetchSupplierFormContext } from "@/lib/data/queries";
import { OrderFormClient } from "@/components/orders/OrderFormClient";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { isSalesManager } from "@/lib/auth-roles";
import {
  filterRowsByGroupScope,
  getManagedGroupIdsForUser,
} from "@/lib/data/sales-group-access";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { Alert } from "@/components/ui/Alert";

export default async function ProsbaPage({
  searchParams,
}: {
  searchParams: Promise<{ dla?: string }>;
}) {
  const { dla: delegateId } = await searchParams;
  let suppliers: Awaited<ReturnType<typeof fetchSupplierFormContext>>["suppliers"] = [];
  let statsBySupplierId: Awaited<
    ReturnType<typeof fetchSupplierFormContext>
  >["statsBySupplierId"] = {};
  let salesPeople: { id: string; name: string }[] = [];
  let lockedSalesPerson: { id: string; name: string } | null = null;
  let isSales = false;
  let isManager = false;
  let managerSelfId: string | null = null;

  try {
    const ctx = await fetchSupplierFormContext();
    suppliers = ctx.suppliers;
    statsBySupplierId = ctx.statsBySupplierId;
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
        const scope = await getManagedGroupIdsForUser(user);
        const scoped = filterRowsByGroupScope(
          (await fetchSalesPeople()).map((p) => ({
            id: p.id,
            name: p.name,
            groupId: (p.group_id as string | null) ?? null,
          })),
          scope
        );
        salesPeople = scoped.map((p) => ({ id: p.id, name: p.name }));

        if (delegateId) {
          lockedSalesPerson = await resolvePreviewSalesPerson(delegateId, user);
        } else {
          lockedSalesPerson = own;
        }
      } else {
        salesPeople = (await fetchSalesPeople()).map((p) => ({
          id: p.id,
          name: p.name,
        }));
        lockedSalesPerson = own;
      }
    } else {
      salesPeople = (await fetchSalesPeople()).map((p) => ({
        id: p.id,
        name: p.name,
      }));
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

  if (isManager && delegateId && !lockedSalesPerson) {
    return (
      <>
        <PageHeader title="Nowa prośba" description="Nie znaleziono wybranego handlowca." />
        <Alert tone="error">
          Sprawdź link lub wybierz osobę z{" "}
          <a href="/zespol" className="font-medium text-red-800 underline">
            podglądu zespołu
          </a>
          .
        </Alert>
      </>
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

  const delegatePeople = isManager ? salesPeople : [];

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
          delegatePeople={
            isManager && delegatePeople.length > 0 ? delegatePeople : undefined
          }
          managerSelfId={managerSelfId ?? undefined}
        />
      ) : (
        <OrderFormClient
          suppliers={suppliers}
          statsBySupplierId={statsBySupplierId}
          salesPeople={salesPeople}
        />
      )}
      </Suspense>
    </div>
  );
}
