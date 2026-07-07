import { Suspense } from "react";
import { fetchTeethQueue, fetchTeethVerificationQueue } from "@/lib/data/teeth-queue";
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

  return (
    <>
      {error ? (
        <Alert tone="warning" className={cn(panelWorkspaceShellClass, "mb-4")}>
          Nie udało się wczytać kolejki zębów{error ? `: ${error}` : ""}. Odśwież stronę lub
          spróbuj ponownie za chwilę.
        </Alert>
      ) : null}

      <Suspense fallback={<PanelDailyRouteLoadingSkeleton />}>
        <TeethPanelClient initialGroups={groups} activeTab={tab} />
      </Suspense>
    </>
  );
}
