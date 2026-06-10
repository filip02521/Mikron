import { Suspense } from "react";
import { fetchSalesPeople, fetchSupplierFormContext } from "@/lib/data/queries";
import { OrderFormClient } from "@/components/orders/OrderFormClient";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { isAdminReadOnlyPanelPreview } from "@/lib/auth/admin-panel-context";
import { isAdmin, isSalesManager } from "@/lib/auth-roles";
import { readAdminPanelContextForSession } from "@/lib/auth/read-admin-panel-context";
import { ManagerPreviewBanner } from "@/components/sales/ManagerPreviewBanner";
import {
  filterRowsByGroupScope,
  getManagedGroupIdsForUser,
} from "@/lib/data/sales-group-access";
import { PageHeader } from "@/components/ui/PageHeader";
import { resolveProsbaSupplierId } from "@/lib/orders/prosba-url";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { Alert } from "@/components/ui/Alert";
import { salesPageShellClass } from "@/lib/ui/ontime-theme";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("prosba");

export default async function ProsbaPage({
  searchParams,
}: {
  searchParams: Promise<{ dla?: string; dostawca?: string }>;
}) {
  const { dla: delegateId, dostawca } = await searchParams;
  const { panelContext } = await readAdminPanelContextForSession();
  let adminReadOnlyPreview = false;
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
    adminReadOnlyPreview =
      isAdminReadOnlyPanelPreview(user?.role ?? null, panelContext) ||
      Boolean(user?.role && isAdmin(user.role) && delegateId?.trim());

    if (adminReadOnlyPreview && user) {
      if (delegateId) {
        lockedSalesPerson = await resolvePreviewSalesPerson(delegateId, user);
      }
    } else if (user?.role === "sales" || user?.role === "sales_manager") {
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

  if (adminReadOnlyPreview) {
    if (!lockedSalesPerson) {
      return (
        <div className={salesPageShellClass}>
          <PageHeader
            title="Nowa prośba"
            description="Podgląd formularza handlowca — składanie prośb jest wyłączone dla administratora."
          />
          <Alert tone="info">
            Wybierz handlowca z{" "}
            <a href="/admin/wybor-handlowca" className="font-medium text-indigo-700 underline">
              listy podglądu
            </a>
            , aby zobaczyć jego formularz i panel zamówień.
          </Alert>
        </div>
      );
    }

    const initialSupplierId =
      resolveProsbaSupplierId(dostawca, suppliers.map((s) => s.id)) ?? null;

    return (
      <div className={salesPageShellClass}>
        <ManagerPreviewBanner
          salesPersonId={lockedSalesPerson.id}
          salesPersonName={lockedSalesPerson.name}
          readOnly
        />
        <Suspense
          fallback={
            <div className="overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]">
              <div className="border-b border-slate-100 px-3 pb-3 pt-4 sm:px-4">
                <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-slate-100" />
              </div>
              <p className="px-3 py-12 text-center text-xs text-slate-500 sm:px-4">
                Ładowanie formularza…
              </p>
            </div>
          }
        >
          <OrderFormClient
            suppliers={suppliers}
            statsBySupplierId={statsBySupplierId}
            salesPeople={[]}
            lockedSalesPerson={lockedSalesPerson}
            singleGroup
            initialSupplierId={initialSupplierId}
            forceReadOnly
          />
        </Suspense>
      </div>
    );
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
      <div className={salesPageShellClass}>
        <PageHeader title="Nowa prośba" description="Nie znaleziono wybranego handlowca." />
        <Alert tone="error">
          Sprawdź link lub wybierz osobę z{" "}
          <a href="/zespol" className="font-medium text-red-800 underline">
            podglądu zespołu
          </a>
          .
        </Alert>
      </div>
    );
  }

  if (isManager && !lockedSalesPerson) {
    return (
      <div className={salesPageShellClass}>
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
      </div>
    );
  }

  const delegatePeople = isManager ? salesPeople : [];
  const initialSupplierId =
    resolveProsbaSupplierId(dostawca, suppliers.map((s) => s.id)) ?? null;

  return (
    <div className={salesPageShellClass}>
      <Suspense
        fallback={
          <div className="overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]">
            <div className="border-b border-slate-100 px-3 pb-3 pt-4 sm:px-4">
              <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-slate-100" />
            </div>
            <p className="px-3 py-12 text-center text-xs text-slate-500 sm:px-4">
              Ładowanie formularza…
            </p>
          </div>
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
            isManager && delegatePeople.length > 0 ? delegatePeople : undefined
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
