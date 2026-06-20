import { Suspense } from "react";
import { fetchSalesPeople, fetchSupplierFormContext } from "@/lib/data/queries";
import { OrderFormClient } from "@/components/orders/OrderFormClient";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { isAdminReadOnlyPanelPreview } from "@/lib/auth/admin-panel-context";
import { isAdmin, isSalesManager } from "@/lib/auth-roles";
import { readAdminPanelContextForSession } from "@/lib/auth/read-admin-panel-context";
import { SalesPageAlerts } from "@/components/sales/SalesPageAlerts";
import { ProsbaFormSuspenseFallback } from "@/components/orders/ProsbaFormSuspenseFallback";
import {
  filterRowsByGroupScope,
  getManagedGroupIdsForUser,
} from "@/lib/data/sales-group-access";
import { PageHeader } from "@/components/ui/PageHeader";
import { resolveProsbaSupplierId } from "@/lib/orders/prosba-url";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { Alert } from "@/components/ui/Alert";
import { salesPageShellClass, brandLinkClass } from "@/lib/ui/ontime-theme";

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
  let salesPeople: { id: string; name: string }[] = [];
  let lockedSalesPerson: { id: string; name: string } | null = null;
  let isSales = false;
  let isManager = false;
  let managerSelfId: string | null = null;

  try {
    const ctx = await fetchSupplierFormContext();
    suppliers = ctx.suppliers;
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
            hint="Podgląd formularza handlowca — składanie prośb jest wyłączone dla administratora."
            hintAriaLabel="O podglądzie prośby"
          />
          <Alert tone="info">
            Wybierz handlowca z{" "}
            <a href="/admin/wybor-handlowca" className={brandLinkClass}>
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
        <SalesPageAlerts
          teamPreview={{
            salesPersonId: lockedSalesPerson.id,
            salesPersonName: lockedSalesPerson.name,
            scope: "prosba",
            readOnly: true,
          }}
        />
        <Suspense fallback={<ProsbaFormSuspenseFallback />}>
          <OrderFormClient
            suppliers={suppliers}
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
        hint="Formularz jest dostępny po powiązaniu konta z kartą handlowca."
      />
    );
  }

  if (isManager && delegateId && !lockedSalesPerson) {
    return (
      <div className={salesPageShellClass}>
        <PageHeader title="Nowa prośba" description="Nie znaleziono wybranego handlowca." />
        <Alert tone="error">
          Sprawdź link lub wybierz osobę z{" "}
          <a href="/zespol" className={brandLinkClass}>
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
          hint="Wybierz handlowca z zespołu lub powiąż swoje konto z kartą handlowca."
          hintAriaLabel="O formularzu prośby"
        />
        <Alert tone="warning">
          Aby składać prośby w swoim imieniu, administrator musi przypisać Ci kartę handlowca.
          Możesz od razu złożyć prośbę w imieniu innej osoby z{" "}
          <a href="/zespol" className={brandLinkClass}>
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
      <SalesPageAlerts
        teamPreview={
          isManager && lockedSalesPerson && lockedSalesPerson.id !== managerSelfId
            ? {
                salesPersonId: lockedSalesPerson.id,
                salesPersonName: lockedSalesPerson.name,
                scope: "prosba",
              }
            : null
        }
        linkErrorWarningOnIgnored={false}
      />
      <Suspense fallback={<ProsbaFormSuspenseFallback />}>
      {lockedSalesPerson ? (
        <OrderFormClient
          suppliers={suppliers}
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
          salesPeople={salesPeople}
          initialSupplierId={initialSupplierId}
        />
      )}
      </Suspense>
    </div>
  );
}
