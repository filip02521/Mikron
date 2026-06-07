import {
  countVerificationOrders,
  fetchIndividualOrders,
  fetchSalesCancelledOrders,
  fetchSuppliersWithSchedules,
} from "@/lib/data/queries";
import { fetchSalesPeopleForPicker } from "@/lib/data/sales-people-admin";
import {
  countDailyPanelNavBadge,
  countDailyPanelExceptions,
  summarizeDailyInbox,
} from "@/lib/orders/procurement-daily-ui";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";

export type OperationsDailyPanelMetrics = {
  version: string;
  navBadge: number;
  verificationCount: number;
};

function maxSubmittedAt(groups: { submittedAtLatest: string }[]): string {
  let max = "";
  for (const group of groups) {
    if (group.submittedAtLatest > max) max = group.submittedAtLatest;
  }
  return max;
}

function maxCancelledAt(
  notices: SummaryWorkspaceData["salesCancelledNotices"]
): string {
  let max = "";
  for (const notice of notices) {
    for (const line of notice.lines) {
      if (line.submittedAt > max) max = line.submittedAt;
    }
  }
  return max;
}

/** Skrót stanu panelu dziennego — zmiana = nowa prośba, weryfikacja, harmonogram itd. */
export function computeOperationsDailyPanelVersion(params: {
  workspace: SummaryWorkspaceData;
  verificationCount: number;
}): string {
  const inbox = summarizeDailyInbox(params.workspace);
  const navBadge = countDailyPanelNavBadge(params.workspace);
  const exceptionsCount = countDailyPanelExceptions(params.workspace);
  const maxProsbyAt = maxSubmittedAt([
    ...params.workspace.forSomeoneLeft,
    ...params.workspace.stockOutLeft,
  ]);

  return [
    navBadge,
    params.verificationCount,
    inbox.forSomeoneGroupCount,
    inbox.forSomeoneLineCount,
    inbox.stockOutGroupCount,
    inbox.stockOutLineCount,
    inbox.overdueCount,
    inbox.todayCount,
    inbox.weekPlanCount,
    exceptionsCount,
    params.workspace.salesCancelledNotices.length,
    maxCancelledAt(params.workspace.salesCancelledNotices),
    maxProsbyAt,
  ].join("|");
}

async function fetchOperationsDailyPanelWorkspace(): Promise<SummaryWorkspaceData> {
  const [schedules, newOrders, salesPeople, salesCancelledOrders] = await Promise.all([
    fetchSuppliersWithSchedules(undefined, { activeOnly: true }),
    fetchIndividualOrders({ status: "Nowe", hideSalesAcknowledged: false }),
    fetchSalesPeopleForPicker(),
    fetchSalesCancelledOrders(7).catch(() => []),
  ]);

  return buildSummaryWorkspace(
    schedules,
    newOrders,
    undefined,
    salesPeople.map((p) => ({ id: p.id, name: p.name })),
    salesCancelledOrders
  );
}

/** Jedno pobranie workspace + wersji (AppShell, polling API). */
export async function fetchOperationsDailyPanelMetrics(): Promise<OperationsDailyPanelMetrics> {
  const [workspace, verificationCount] = await Promise.all([
    fetchOperationsDailyPanelWorkspace(),
    countVerificationOrders(),
  ]);

  return {
    version: computeOperationsDailyPanelVersion({ workspace, verificationCount }),
    navBadge: countDailyPanelNavBadge(workspace),
    verificationCount,
  };
}
