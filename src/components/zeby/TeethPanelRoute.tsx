import { Suspense } from "react";
import { fetchTeethQueue, fetchTeethVerificationQueue, fetchTeethHistoryPage, groupTeethItemsBySupplier } from "@/lib/data/teeth-queue";
import { TeethPanelClient } from "@/components/zeby/TeethPanelClient";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";
import { panelWorkspaceShellClass } from "@/lib/ui/ontime-theme";
import { PanelDailyRouteLoadingSkeleton } from "@/components/layout/PanelRouteLoading";
import { requireTeethPanel } from "@/lib/auth";
import { runOrderMaintenanceBeforePageLoad } from "@/lib/services/deferred-order-maintenance";
import type { Tab } from "@/components/zeby/teeth-panel-types";

export async function TeethPanelRoute({ tab }: { tab: Tab }) {
  await requireTeethPanel("read");
  await runOrderMaintenanceBeforePageLoad();

  let groups: Awaited<ReturnType<typeof fetchTeethQueue>> = [];
  let error: string | null = null;

  if (tab === "kolejka") {
    try {
      groups = await fetchTeethQueue();
    } catch (e) {
      error = e instanceof Error ? e.message : "Błąd ładowania";
    }
  } else if (tab === "weryfikacja") {
    try {
      groups = await fetchTeethVerificationQueue();
    } catch (e) {
      error = e instanceof Error ? e.message : "Błąd ładowania";
    }
  }

  let initialHistoryGroups: Awaited<ReturnType<typeof groupTeethItemsBySupplier>> | null = null;
  if (tab === "historia") {
    try {
      const page = await fetchTeethHistoryPage({ limit: 50, offset: 0 });
      initialHistoryGroups = groupTeethItemsBySupplier(page.items);
    } catch {
      // Client-side fallback in TeethPanelHistoriaView
    }
  }

  return (
    <>
      {error ? (
        <Alert tone="warning" className={cn(panelWorkspaceShellClass, "mb-4")}>
          Nie udało się wczytać kolejki zębów: {error}. Odśwież stronę lub
          spróbuj ponownie za chwilę.
        </Alert>
      ) : null}

      <Suspense fallback={<PanelDailyRouteLoadingSkeleton />}>
        <TeethPanelClient initialGroups={groups} activeTab={tab} initialHistoryGroups={initialHistoryGroups} />
      </Suspense>
    </>
  );
}
