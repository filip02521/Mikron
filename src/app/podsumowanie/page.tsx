import { fetchSummaryWorkspace, fetchVerificationOrders } from "@/lib/data/queries";
import { SummaryWorkspace } from "@/components/summary/SummaryWorkspace";
import { PanelDailyHelp } from "@/components/summary/PanelDailyHelp";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import type { IndividualOrder } from "@/types/database";

const emptyWorkspace = buildSummaryWorkspace([], []);

export default async function PodsumowaniePage() {
  let workspace = emptyWorkspace;
  let suppliers: { id: string; name: string }[] = [];
  let supplierDirectory: Awaited<
    ReturnType<typeof fetchSummaryWorkspace>
  >["supplierDirectory"] = [];
  let salesPeople: { id: string; name: string }[] = [];
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
      <PageHeader
        badge={
          <Badge variant="info" className="mb-2">
            Panel dzienny
          </Badge>
        }
        title="Panel dzienny"
        description="Przegląd dnia, obsługa prośb i harmonogram dostawców — w dwóch sekcjach: dziś i plan tygodnia."
        actions={<PanelDailyHelp />}
      />

      {error && (
        <Alert tone="warning" className="mb-6">
          {error}. Sprawdź połączenie z Supabase.
        </Alert>
      )}

      <SummaryWorkspace
        workspace={workspace}
        suppliers={suppliers}
        supplierDirectory={supplierDirectory}
        salesPeople={salesPeople}
        statsBySupplierId={statsBySupplierId}
        supplierStatsMode={supplierStatsMode}
        verificationOrders={verificationOrders}
      />
    </>
  );
}
