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
  let verificationOrders: IndividualOrder[] = [];
  let error: string | null = null;

  try {
    const [data, verification] = await Promise.all([
      fetchSummaryWorkspace(),
      fetchVerificationOrders(),
    ]);
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

      <Suspense fallback={<PanelDailyRouteLoadingSkeleton />}>
        <SummaryWorkspace
          workspace={workspace}
          suppliers={suppliers}
          supplierDirectory={supplierDirectory}
          salesPeople={salesPeople}
          statsBySupplierId={statsBySupplierId}
          supplierStatsMode={supplierStatsMode}
          verificationOrders={verificationOrders}
          teethLaneBySupplierId={teethLaneBySupplierId}
          canPrepareZd={canPrepareZd}
          etaUseP50={etaUseP50}
          etaQuantilesBySupplierId={etaQuantilesBySupplierId}
        />
      </Suspense>
    </>
  );
}
