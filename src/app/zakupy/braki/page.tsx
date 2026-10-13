import type { Metadata } from "next";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";
import { Alert } from "@/components/ui/Alert";
import {
  StockWatchPanel,
  type StockWatchRunSummary,
} from "@/components/stock-watch/StockWatchPanel";
import {
  getLatestStockWatchRun,
  getSupplierScopeCoverage,
  listStockWatchItems,
  listStockWatchSupplierOrders,
} from "@/lib/stock-watch/data";
import { buildStockWatchDashboard } from "@/lib/stock-watch/dashboard";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export const metadata: Metadata = pageMetadataFor("stockWatch");
export const dynamic = "force-dynamic";
/** „Przelicz teraz” uruchamia worker przez `after()` — działa w limicie czasu tej trasy. */
export const maxDuration = 900;

async function canMutate(): Promise<boolean> {
  try {
    await requireZdEstimateAdmin("mutate");
    return true;
  } catch {
    return false;
  }
}

async function loadPanel(supplierId: string | null) {
  const [items, supplierOrders, run, mutate, coverage] = await Promise.all([
    listStockWatchItems(),
    listStockWatchSupplierOrders(),
    getLatestStockWatchRun(),
    canMutate(),
    getSupplierScopeCoverage(),
  ]);
  const runSummary: StockWatchRunSummary | null = run
    ? {
        status: run.status,
        runDate: run.runDate,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        heartbeatAt: run.heartbeatAt,
        salesEndDate: run.salesEndDate,
        scopesTotal: run.scopesTotal,
        scopesDone: run.scopesDone.length,
        failures: run.scopesFailed.map((f) => ({
          supplierName: f.supplierName,
          message: f.message,
        })),
      }
    : null;
  return {
    dashboard: buildStockWatchDashboard(items, supplierOrders, { alertsSupplierId: supplierId }),
    run: runSummary,
    canMutate: mutate,
    coverage,
    // Dostawca przeanalizowany bez braków nie ma propozycji ani alertów — nazwa z wyników analizy.
    supplierName: supplierId
      ? (supplierOrders.find((o) => o.supplierId === supplierId)?.supplierName ?? null)
      : null,
  };
}

export default async function StockWatchPage({
  searchParams,
}: {
  searchParams: Promise<{ dostawca?: string | string[]; tab?: string | string[] }>;
}) {
  await requireZdEstimateAdmin("read");
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null;

  let panel: Awaited<ReturnType<typeof loadPanel>> | null = null;
  let loadError: string | null = null;
  try {
    panel = await loadPanel(first(params.dostawca));
  } catch (e) {
    loadError = userFacingErrorText(
      e,
      "Nie udało się wczytać wyników analizy. Sprawdź, czy migracja 162_stock_watch jest zastosowana."
    );
  }

  return (
    <div className={adminPageShellClass}>
      {panel ? (
        <StockWatchPanel
          // Stan strony przetrwa zmianę samych parametrów — inny dostawca = świeży panel.
          key={first(params.dostawca) ?? ""}
          dashboard={panel.dashboard}
          run={panel.run}
          canMutate={panel.canMutate}
          coverage={panel.coverage}
          initialSupplierId={first(params.dostawca)}
          initialSupplierName={panel.supplierName}
          initialTab={first(params.tab)}
        />
      ) : (
        <Alert tone="error" title="Panel braków niedostępny">
          {loadError ?? "Nie udało się wczytać panelu."}
        </Alert>
      )}
    </div>
  );
}
