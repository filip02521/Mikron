import { Suspense } from "react";
import { fetchMonthlyStats } from "@/lib/data/monthly-stats";
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
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month)) {
    return searchParams.month;
  }
  return currentKey;
}

export default async function MonthlySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getSessionUser();
  const role = session?.role ?? null;

  if (!role) {
    return (
      <div className={cn(panelWorkspaceShellClass, "rounded-lg border border-slate-200 bg-white p-6")}>
        <Alert tone="warning">Zaloguj się, aby zobaczyć podsumowanie miesiąca.</Alert>
      </div>
    );
  }

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
        {stats ? <MonthlySummaryClient stats={stats} /> : null}
      </Suspense>
    </>
  );
}
