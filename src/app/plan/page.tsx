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
import { getAppRole } from "@/lib/auth-dev";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesAccount } from "@/lib/auth-roles";

export default async function PlanPage() {
  const role = await getAppRole();
  let salesPersonId: string | null = null;

  if (role && isSalesAccount(role)) {
    try {
      const user = await getSessionUser();
      if (user) {
        const resolved = await resolveSalesPersonForUser(user);
        salesPersonId = resolved?.id ?? null;
      }
    } catch {
      /* dev */
    }

    if (!salesPersonId) {
      return (
        <SalesAccountLinkRequired
          title="Harmonogram zakupów"
          description="Kalendarz działu dostaw i wyszukiwarka dostawców. Konto musi być przypisane do profilu handlowca."
        />
      );
    }
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

    if (isSalesAccount(role ?? "sales") && salesPersonId) {
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

  const salesMode = role ? isSalesAccount(role) : false;

  return (
    <>
      {!salesMode ? (
        <PageHeader
          title="Harmonogram zakupów"
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
}
