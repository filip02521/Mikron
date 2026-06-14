import { Suspense } from "react";
import { cn } from "@/lib/cn";
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

const emptyWorkspace = buildSummaryWorkspace([], []);

export default async function PodsumowaniePage() {
  await runOrderMaintenanceBeforePageLoad();

  let workspace = emptyWorkspace;
  let suppliers: OrderFormSupplierOption[] = [];
  let supplierDirectory: Awaited<
    ReturnType<typeof fetchSummaryWorkspace>
  >["supplierDirectory"] = [];
  let salesPeople: { id: string; name: string; email: string }[] = [];
  let statsBySupplierId: Record<string, import("@/types/database").DeliveryStats> =
    {};
  let supplierStatsMode: Record<string, import("@/types/database").StatsMode> = {};
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
  } catch (e) {
    error = e instanceof Error ? e.message : "Błąd ładowania";
  }

  return (
    <>
      {error ? (
        <Alert tone="warning" className={cn(panelWorkspaceShellClass, "mb-4")}>
          {error}. Sprawdź połączenie z Supabase.
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
        />
      </Suspense>
    </>
  );
}
