import { Suspense } from "react";
import { fetchTeethQueue } from "@/lib/data/teeth-queue";
import { TeethPanelClient } from "@/components/zeby/TeethPanelClient";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";
import { panelWorkspaceShellClass } from "@/lib/ui/ontime-theme";
import { PanelDailyRouteLoadingSkeleton } from "@/components/layout/PanelRouteLoading";
import { requireTeethPanel } from "@/lib/auth";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("zeby");

export default async function ZebyPage() {
  await requireTeethPanel("read");

  let groups: Awaited<ReturnType<typeof fetchTeethQueue>> = [];
  let error: string | null = null;

  try {
    groups = await fetchTeethQueue();
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
        <TeethPanelClient initialGroups={groups} />
      </Suspense>
    </>
  );
}
