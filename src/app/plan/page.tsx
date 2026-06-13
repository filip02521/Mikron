import {
  fetchDeliveryStats,
  fetchIndividualOrders,
  fetchSuppliersWithSchedules,
} from "@/lib/data/queries";
import type { DeliveryStats } from "@/types/database";
import { aggregateVisibleMyOrdersBySupplier } from "@/lib/orders/sales-open-orders";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import { PlanClient } from "@/components/plan/PlanClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { ManagerPreviewBanner } from "@/components/sales/ManagerPreviewBanner";
import { SalesPreviewPageChrome } from "@/components/sales/SalesPreviewPageChrome";
import { getAppRole } from "@/lib/auth-dev";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isAdmin, isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("plan");

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ dla?: string }>;
}) {
  const { dla: previewSalesPersonId } = await searchParams;
  const role = await getAppRole();
  let salesPersonId: string | null = null;
  let salesPersonName: string | null = null;
  let isTeamPreview = false;
  let adminReadOnlyPreview = false;
  let linkError: string | null = null;

  try {
    const user = await getSessionUser();
    if (user && isAdmin(user.role) && previewSalesPersonId) {
      adminReadOnlyPreview = true;
      const preview = await resolvePreviewSalesPerson(previewSalesPersonId, user);
      if (preview) {
        salesPersonId = preview.id;
        salesPersonName = preview.name;
        isTeamPreview = true;
      } else {
        linkError = "Nie znaleziono handlowca do podglądu.";
      }
    } else if (user && isSalesManager(user.role) && previewSalesPersonId) {
      const own = await resolveSalesPersonForUser(user);
      const preview = await resolvePreviewSalesPerson(previewSalesPersonId, user);
      if (preview) {
        salesPersonId = preview.id;
        salesPersonName = preview.name;
        isTeamPreview = preview.id !== own?.id;
      } else {
        linkError = "Nie znaleziono handlowca do podglądu.";
      }
    } else if (role && isSalesAccount(role)) {
      const user = await getSessionUser();
      if (user) {
        const resolved = await resolveSalesPersonForUser(user);
        salesPersonId = resolved?.id ?? null;
        salesPersonName = resolved?.name ?? null;
      }
    }
  } catch {
    /* dev */
  }

  if (role && isSalesAccount(role) && !salesPersonId && !isTeamPreview && !linkError) {
    return (
      <SalesAccountLinkRequired
        title="Harmonogram"
        description="Kalendarz działu dostaw i wyszukiwarka dostawców. Konto musi być przypisane do profilu handlowca."
      />
    );
  }

  let error: string | null = null;
  let suppliers: Awaited<ReturnType<typeof fetchSuppliersWithSchedules>> = [];
  let workspace = buildSummaryWorkspace([], []);
  let prioritySupplierIds: string[] = [];
  let openOrderCountBySupplier: Record<string, number> = {};
  let statsBySupplierId: Record<string, DeliveryStats> = {};

  try {
    const [supplierRows, statsRows] = await Promise.all([
      fetchSuppliersWithSchedules(),
      fetchDeliveryStats(),
    ]);
    suppliers = supplierRows;
    statsBySupplierId = Object.fromEntries(
      (statsRows as DeliveryStats[]).map((s) => [s.supplier_id, s])
    );
    workspace = buildSummaryWorkspace(suppliers, []);

    const salesScoped =
      (isSalesAccount(role ?? "sales") && salesPersonId) ||
      (role === "admin" && Boolean(salesPersonId)) ||
      (isTeamPreview && Boolean(salesPersonId));
    if (salesScoped && salesPersonId) {
      const openOrders = await fetchIndividualOrders({
        salesPersonId,
        hideSalesAcknowledged: false,
      });
      const aggregated = aggregateVisibleMyOrdersBySupplier(
        openOrders,
        statsRows as DeliveryStats[]
      );
      prioritySupplierIds = aggregated.prioritySupplierIds;
      openOrderCountBySupplier = aggregated.openOrderCountBySupplier;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Błąd ładowania";
  }

  const salesMode = Boolean(
    role &&
      (isSalesAccount(role) ||
        (role === "admin" && salesPersonId) ||
        (isTeamPreview && salesPersonId))
  );

  const content = (
    <>
      {!salesMode ? (
        <PageHeader
          title="Harmonogram"
          description="Podgląd harmonogramu zamówień u dostawców — bez panelu zakupowego."
        />
      ) : null}
      {salesMode ? (
        <PlanClient
          workspace={workspace}
          suppliers={suppliers}
          mode="sales"
          prioritySupplierIds={prioritySupplierIds}
          openOrderCountBySupplier={openOrderCountBySupplier}
          statsBySupplierId={statsBySupplierId}
          error={error}
          pageTitle={
            isTeamPreview && salesPersonName ? `Harmonogram: ${salesPersonName}` : undefined
          }
        />
      ) : (
        <PlanClient
          workspace={workspace}
          suppliers={suppliers}
          mode="full"
          prioritySupplierIds={prioritySupplierIds}
          openOrderCountBySupplier={openOrderCountBySupplier}
          statsBySupplierId={statsBySupplierId}
          error={error}
        />
      )}
    </>
  );

  return (
    <SalesPreviewPageChrome
      linkError={linkError}
      banner={
        isTeamPreview && salesPersonId && salesPersonName ? (
          <ManagerPreviewBanner
            salesPersonId={salesPersonId}
            salesPersonName={salesPersonName}
            readOnly={adminReadOnlyPreview}
            scope="plan"
          />
        ) : null
      }
    >
      {content}
    </SalesPreviewPageChrome>
  );
}
