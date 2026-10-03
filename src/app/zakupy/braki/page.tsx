import type { Metadata } from "next";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";
import { Alert } from "@/components/ui/Alert";
import {
  StockWatchPanel,
  type StockWatchRunSummary,
} from "@/components/stock-watch/StockWatchPanel";
import { getLatestStockWatchRun, listStockWatchItems } from "@/lib/stock-watch/data";
import { listPurchaseDrafts } from "@/lib/stock-watch/drafts";
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

async function loadPanel() {
  const [items, run, drafts, mutate] = await Promise.all([
    listStockWatchItems(),
    getLatestStockWatchRun(),
    listPurchaseDrafts({ statuses: ["draft", "submitted"], limit: 30 }),
    canMutate(),
  ]);
  const openDraftBySupplier = new Map(
    drafts.filter((d) => d.status === "draft").map((d) => [d.supplierId, d.id])
  );
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
    dashboard: buildStockWatchDashboard(items, openDraftBySupplier),
    run: runSummary,
    drafts,
    canMutate: mutate,
  };
}

export default async function StockWatchPage() {
  await requireZdEstimateAdmin("read");

  let panel: Awaited<ReturnType<typeof loadPanel>> | null = null;
  let loadError: string | null = null;
  try {
    panel = await loadPanel();
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
          dashboard={panel.dashboard}
          run={panel.run}
          drafts={panel.drafts}
          canMutate={panel.canMutate}
        />
      ) : (
        <Alert tone="error" title="Panel braków niedostępny">
          {loadError ?? "Nie udało się wczytać panelu."}
        </Alert>
      )}
    </div>
  );
}
