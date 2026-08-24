import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import {
  fetchDeliveryStats,
  fetchIndividualOrders,
  fetchSuppliersOnVacationNow,
  fetchSuppliersWithSchedules,
} from "@/lib/data/queries";
import { estimateTeethDeliveryEtaBatch } from "@/lib/data/teeth-delivery-eta";
import { fetchTeethSchedules } from "@/lib/data/teeth-schedule";
import type { DeliveryStats, TeethSupplierSchedule } from "@/types/database";
import { formatEtaLabel } from "@/lib/orders/delivery-eta";
import { aggregateVisibleMyOrdersBySupplier } from "@/lib/orders/sales-open-orders";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import { PlanClient } from "@/components/plan/PlanClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { SalesPreviewPageChrome } from "@/components/sales/SalesPreviewPageChrome";
import { getAppRole } from "@/lib/auth-dev";
import { logDevPageError } from "@/lib/dev/log-page-error";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isAdmin, isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import { SALES_PLAN_COPY } from "@/lib/sales/sales-plan-ui-copy";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("plan");
export const dynamic = "force-dynamic";

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
        salesPersonId = own?.id ?? null;
        salesPersonName = own?.name ?? null;
      }
    } else if (role && isSalesAccount(role)) {
      const user = await getSessionUser();
      if (user) {
        const resolved = await resolveSalesPersonForUser(user);
        salesPersonId = resolved?.id ?? null;
        salesPersonName = resolved?.name ?? null;
      }
    }
  } catch (error) {
    logDevPageError("plan/page", error);
  }

  if (role && isSalesAccount(role) && !salesPersonId && !isTeamPreview && !linkError) {
    return (
      <SalesAccountLinkRequired
        title={SALES_PLAN_COPY.pageTitle}
        hint={SALES_PLAN_COPY.accountLinkHint}
      />
    );
  }

  let error: string | null = null;
  let suppliers: Awaited<ReturnType<typeof fetchSuppliersWithSchedules>> = [];
  let workspace = buildSummaryWorkspace([], []);
  let prioritySupplierIds: string[] = [];
  let openOrderCountBySupplier: Record<string, number> = {};
  let statsBySupplierId: Record<string, DeliveryStats> = {};
  let teethOpenSupplierIds: string[] = [];
  const teethScheduleBySupplierId: Record<string, TeethSupplierSchedule> = {};
  const teethHistoryEtaLabelBySupplierId: Record<string, string> = {};

  try {
    const [supplierRows, statsRows, onVacationNow] = await Promise.all([
      fetchSuppliersWithSchedules(),
      fetchDeliveryStats(),
      fetchSuppliersOnVacationNow(),
    ]);
    suppliers = supplierRows;
    statsBySupplierId = Object.fromEntries(
      (statsRows as DeliveryStats[]).map((s) => [s.supplier_id, s])
    );
    workspace = {
      ...buildSummaryWorkspace(suppliers, []),
      suppliersOnVacationNow: onVacationNow,
    };

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
      teethOpenSupplierIds = aggregated.teethOpenSupplierIds;

      const teethOpen = new Set(teethOpenSupplierIds);
      if (teethOpen.size > 0) {
        const schedules = await fetchTeethSchedules().catch(() => []);
        for (const sch of schedules) {
          if (!teethOpen.has(sch.supplier_id)) continue;
          teethScheduleBySupplierId[sch.supplier_id] = sch;
        }

        const todayKey = workspace.todayDateKey || todayDateKeyInWarsaw();
        /** Grupuj po startAt — batch ETA używa jednej daty startu. */
        const historyIdsByStartAt = new Map<string, string[]>();
        for (const sch of Object.values(teethScheduleBySupplierId)) {
          const lead = sch.delivery_lead_business_days;
          if (lead != null && Number.isFinite(lead) && lead > 0) continue;
          if (!sch.computed_next_date) continue;
          let startAt = sch.computed_next_date;
          if (startAt < todayKey) startAt = todayKey;
          const ids = historyIdsByStartAt.get(startAt) ?? [];
          ids.push(sch.supplier_id);
          historyIdsByStartAt.set(startAt, ids);
        }
        await Promise.all(
          [...historyIdsByStartAt.entries()].map(async ([startAt, supplierIds]) => {
            try {
              const estimates = await estimateTeethDeliveryEtaBatch(
                supplierIds,
                startAt
              );
              for (const [supplierId, estimate] of estimates) {
                teethHistoryEtaLabelBySupplierId[supplierId] =
                  formatEtaLabel(estimate);
              }
            } catch (etaError) {
              logDevPageError("plan/teeth-eta", etaError);
            }
          })
        );
      }
    }
  } catch (e) {
    error = userFacingErrorText(e, "Błąd ładowania");
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
            isTeamPreview && salesPersonName
              ? SALES_PLAN_COPY.previewTitle(salesPersonName)
              : undefined
          }
          adminReadOnlyPreview={adminReadOnlyPreview}
          teethOpenSupplierIds={teethOpenSupplierIds}
          teethScheduleBySupplierId={teethScheduleBySupplierId}
          teethHistoryEtaLabelBySupplierId={teethHistoryEtaLabelBySupplierId}
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
      teamPreview={
        isTeamPreview && salesPersonId && salesPersonName
          ? {
              salesPersonId,
              salesPersonName,
              readOnly: adminReadOnlyPreview,
              scope: "plan",
            }
          : null
      }
    >
      {content}
    </SalesPreviewPageChrome>
  );
}
