import { Suspense } from "react";
import { fetchSummaryWorkspace, fetchVerificationOrders } from "@/lib/data/queries";
import { SummaryWorkspace } from "@/components/summary/SummaryWorkspace";
import { Alert } from "@/components/ui/Alert";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import type { IndividualOrder } from "@/types/database";

const emptyWorkspace = buildSummaryWorkspace([], []);

function PanelLoadingFallback() {
  return (
    <div
      className="mx-auto max-w-6xl animate-pulse rounded-2xl border border-slate-200 bg-white p-8"
      aria-busy
      aria-label="Ładowanie panelu dziennego"
    >
      <div className="h-6 w-48 rounded bg-slate-200" />
      <div className="mt-3 h-4 max-w-lg rounded bg-slate-100" />
      <div className="mt-6 flex gap-2">
        <div className="h-10 w-24 rounded-xl bg-slate-100" />
        <div className="h-10 w-24 rounded-xl bg-slate-100" />
        <div className="h-10 w-24 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

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
      {error ? (
        <Alert tone="warning" className="mb-4">
          {error}. Sprawdź połączenie z Supabase.
        </Alert>
      ) : null}

      <Suspense fallback={<PanelLoadingFallback />}>
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
