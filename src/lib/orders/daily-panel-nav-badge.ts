import { fetchOperationsDailyPanelMetrics } from "@/lib/orders/operations-daily-panel-version";

/** Licznik „Nowe” w menu — ta sama logika co countDailyPanelNavBadge(workspace), bez pełnego layoutu strony. */
export async function countDailyPanelNavBadgeForNav(): Promise<number> {
  const metrics = await fetchOperationsDailyPanelMetrics();
  return metrics.navBadge;
}
