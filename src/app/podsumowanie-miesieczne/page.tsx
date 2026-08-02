import { Suspense } from "react";
import { fetchMonthlyStats } from "@/lib/data/monthly-stats";
import { resolveCompletedMonthlySummaryMonthKey } from "@/lib/data/monthly-stats-shared";
import { getSessionUser } from "@/lib/auth";
import { Alert } from "@/components/ui/Alert";
import { MonthlySummaryClient } from "@/components/monthly-summary/MonthlySummaryClient";
import { PanelRouteLoading } from "@/components/layout/PanelRouteLoading";
import { panelWorkspaceShellClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("monthlySummary");
export const dynamic = "force-dynamic";

function resolveMonthKey(searchParams: { month?: string }): string {
  return resolveCompletedMonthlySummaryMonthKey(searchParams.month);
}

export default async function MonthlySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tab?: string }>;
}) {
  const session = await getSessionUser();

  if (!session?.role) {
    return (
      <div className={cn(panelWorkspaceShellClass, "rounded-lg border border-slate-200 bg-white p-6")}>
        <Alert tone="warning">Zaloguj się, aby zobaczyć podsumowanie miesiąca.</Alert>
      </div>
    );
  }

  const role = session.role;
  const params = await searchParams;
  const monthKey = resolveMonthKey(params);

  let stats;
  let error: string | null = null;
  try {
    stats = await fetchMonthlyStats(monthKey);
  } catch (e) {
    error = e instanceof Error ? e.message : "Błąd ładowania statystyk";
  }

  return (
    <>
      {error ? (
        <Alert tone="warning" className={cn(panelWorkspaceShellClass, "mb-4")}>
          {error}. Sprawdź połączenie z Supabase.
        </Alert>
      ) : null}
      <Suspense fallback={<PanelRouteLoading variant="admin" label="Ładowanie podsumowania" />}>
        {stats ? (
          <MonthlySummaryClient
            stats={stats}
            role={role}
            workspaces={session.assignedWorkspaces ?? []}
          />
        ) : null}
      </Suspense>
    </>
  );
}
