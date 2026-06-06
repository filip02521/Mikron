import {
  fetchIndividualOrders,
  fetchSalesCancelledOrders,
  fetchSuppliersWithSchedules,
} from "@/lib/data/queries";
import { fetchSalesPeopleForPicker } from "@/lib/data/sales-people-admin";
import { countDailyPanelNavBadge } from "@/lib/orders/procurement-daily-ui";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";

/** Licznik „Nowe” w menu — ta sama logika co countDailyPanelNavBadge(workspace), bez pełnego layoutu strony. */
export async function countDailyPanelNavBadgeForNav(): Promise<number> {
  const [schedules, newOrders, salesPeople, salesCancelledOrders] = await Promise.all([
    fetchSuppliersWithSchedules(undefined, { activeOnly: true }),
    fetchIndividualOrders({ status: "Nowe", hideSalesAcknowledged: false }),
    fetchSalesPeopleForPicker(),
    fetchSalesCancelledOrders(7).catch(() => []),
  ]);

  const workspace = buildSummaryWorkspace(
    schedules,
    newOrders,
    undefined,
    salesPeople.map((p) => ({ id: p.id, name: p.name })),
    salesCancelledOrders
  );

  return countDailyPanelNavBadge(workspace);
}
