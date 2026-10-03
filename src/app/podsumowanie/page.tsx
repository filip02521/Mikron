import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { getSessionUser } from "@/lib/auth";
import { canAccessZdEstimate } from "@/lib/auth-roles";
import { fetchSummaryWorkspace, fetchVerificationOrders } from "@/lib/data/queries";
import { runOrderMaintenanceBeforePageLoad } from "@/lib/services/deferred-order-maintenance";
import { SummaryWorkspace } from "@/components/summary/SummaryWorkspace";
import { Alert } from "@/components/ui/Alert";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import { PanelDailyRouteLoadingSkeleton } from "@/components/layout/PanelRouteLoading";
import { panelWorkspaceShellClass } from "@/lib/ui/ontime-theme";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import type { IndividualOrder } from "@/types/database";
import { listZdEstimateSupplierScopes } from "@/lib/data/zd-estimate-supplier-scopes";
import {
  listStockWatchOffPlanSuppliers,
  listStockWatchSupplierSignals,
  type StockWatchOffPlanSupplier,
  type StockWatchSupplierSignal,
} from "@/lib/stock-watch/data";
import { StockWatchOffPlanBanner } from "@/components/stock-watch/StockWatchOffPlanBanner";
import { warsawNowParts } from "@/lib/time/warsaw";
import {
  supplierSubiektScopeInfoFromRow,
  type SupplierSubiektScopeInfo,
} from "@/lib/orders/zd-estimate-supplier-scope";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("podsumowanie");
export const dynamic = "force-dynamic";

const emptyWorkspace = buildSummaryWorkspace([], []);

export default async function PodsumowaniePage() {
  await runOrderMaintenanceBeforePageLoad();

  const session = await getSessionUser();
  const canPrepareZd = Boolean(
    session?.role && canAccessZdEstimate(session.role, session.assignedWorkspaces)
  );

  let workspace = emptyWorkspace;
  let suppliers: OrderFormSupplierOption[] = [];
  let supplierDirectory: Awaited<
    ReturnType<typeof fetchSummaryWorkspace>
  >["supplierDirectory"] = [];
  let salesPeople: { id: string; name: string; email: string }[] = [];
  let statsBySupplierId: Record<string, import("@/types/database").DeliveryStats> =
    {};
  let supplierStatsMode: Record<string, import("@/types/database").StatsMode> = {};
  let teethLaneBySupplierId: Awaited<
    ReturnType<typeof fetchSummaryWorkspace>
  >["teethLaneBySupplierId"] = {};
  let etaUseP50 = false;
  let etaQuantilesBySupplierId: Awaited<
    ReturnType<typeof fetchSummaryWorkspace>
  >["etaQuantilesBySupplierId"] = {};
  const subiektScopeBySupplierId: Record<string, SupplierSubiektScopeInfo> = {};
  let verificationOrders: IndividualOrder[] = [];
  let error: string | null = null;
  let offPlanSuppliers: StockWatchOffPlanSupplier[] = [];
  let stockSignalBySupplierId: Record<string, StockWatchSupplierSignal> = {};

  try {
    const [data, verification, scopeRows, offPlan, stockSignals] = await Promise.all([
      fetchSummaryWorkspace(),
      fetchVerificationOrders(),
      // Powiązania dostawca → grupa/cecha Subiekta; brak tabeli/błąd nie blokuje panelu.
      listZdEstimateSupplierScopes().catch(() => []),
      // Panel Braki (nocna analiza): brak tabeli / błąd nie blokuje panelu dziennego.
      listStockWatchOffPlanSuppliers(warsawNowParts().dateKey).catch(() => []),
      listStockWatchSupplierSignals().catch(() => ({})),
    ]);
    offPlanSuppliers = offPlan;
    stockSignalBySupplierId = stockSignals;
    for (const row of scopeRows) {
      // Kilka zakresów na dostawcę — główny (pierwszy) + etykiety kolejnych.
      const primary = subiektScopeBySupplierId[row.supplierId];
      if (primary) {
        primary.extraLabels = [...(primary.extraLabels ?? []), row.label || `#${row.grupaId ?? row.cechaId}`];
        continue;
      }
      const info = supplierSubiektScopeInfoFromRow(row);
      if (info) subiektScopeBySupplierId[row.supplierId] = info;
    }
    verificationOrders = verification;
    workspace = data.workspace;
    suppliers = data.suppliers;
    supplierDirectory = data.supplierDirectory;
    salesPeople = data.salesPeople;
    statsBySupplierId = data.statsBySupplierId;
    supplierStatsMode = data.supplierStatsMode;
    teethLaneBySupplierId = data.teethLaneBySupplierId;
    etaUseP50 = data.etaUseP50;
    etaQuantilesBySupplierId = data.etaQuantilesBySupplierId;
  } catch (e) {
    error = userFacingErrorText(e, "Błąd ładowania");
  }

  return (
    <>
      {error ? (
        <Alert tone="warning" className={cn(panelWorkspaceShellClass, "mb-4")}>
          {error}
        </Alert>
      ) : null}

      {offPlanSuppliers.length > 0 ? (
        <div className={panelWorkspaceShellClass}>
          <StockWatchOffPlanBanner suppliers={offPlanSuppliers} canPrepareZd={canPrepareZd} />
        </div>
      ) : null}

      <Suspense fallback={<PanelDailyRouteLoadingSkeleton />}>
        <SummaryWorkspace
          workspace={workspace}
          stockSignalBySupplierId={stockSignalBySupplierId}
          suppliers={suppliers}
          supplierDirectory={supplierDirectory}
          salesPeople={salesPeople}
          statsBySupplierId={statsBySupplierId}
          supplierStatsMode={supplierStatsMode}
          verificationOrders={verificationOrders}
          teethLaneBySupplierId={teethLaneBySupplierId}
          subiektScopeBySupplierId={subiektScopeBySupplierId}
          canPrepareZd={canPrepareZd}
          etaUseP50={etaUseP50}
          etaQuantilesBySupplierId={etaQuantilesBySupplierId}
        />
      </Suspense>
    </>
  );
}
