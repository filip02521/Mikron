import {
  countVerificationOrders,
  fetchIndividualOrders,
  fetchSalesCancelledOrders,
  fetchSuppliersWithSchedules,
  countDeliveryQueue,
  countInformacjaQueue,
} from "@/lib/data/queries";
import { query } from "@/lib/db/pool";
import { countOpenDepartmentBoardQuestions } from "@/lib/data/department-board";
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
  openBoardQuestionsCount: number;
  realizacjaCount: number;
  operationsNotatkiCount: number;
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

/** Skrót stanu panelu dziennego — zmiana = nowa prośba, weryfikacja, pytanie na tablicy itd. */
export function computeOperationsDailyPanelVersion(params: {
  workspace: SummaryWorkspaceData;
  verificationCount: number;
  openBoardQuestionsCount?: number;
  /** Ostatnie przeliczenie analizy Braki (karty „Do ZD”) — po zamówieniu odświeża panel. */
  stockWatchComputedAt?: string | null;
  /** Ostatnia odpowiedź dostawcy na zapytanie z tablicy — tablica zakupów odświeża się po każdej. */
  boardSupplierReplyAt?: string | null;
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
    params.openBoardQuestionsCount ?? 0,
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
    params.stockWatchComputedAt ?? "",
    params.boardSupplierReplyAt ?? "",
  ].join("|");
}

async function fetchOperationsDailyPanelWorkspace(): Promise<SummaryWorkspaceData> {
  const [schedules, newOrders, salesPeople, salesCancelledOrders] = await Promise.all([
    fetchSuppliersWithSchedules(undefined, { activeOnly: true }),
    fetchIndividualOrders({ status: "Nowe", hideSalesAcknowledged: false, excludeTeeth: true, allowAll: true }),
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

/** Przed migracjami 174 / 178 — brak (bez wpływu na wersję). */
async function fetchBoardSupplierReplyAt(): Promise<string | null> {
  const { rows } = await query<{ at: string | null }>(
    `SELECT max(m.received_at)::text AS at FROM public.supplier_mail_messages m
      WHERE m.case_kind = 'inquiry' AND m.kind IN ('supplier', 'bounce')`
  );
  return rows[0]?.at ?? null;
}

async function fetchStockWatchComputedAt(): Promise<string | null> {
  const { rows } = await query<{ at: string | null }>(
    `SELECT max(computed_at)::text AS at FROM stock_watch_supplier_orders`
  );
  return rows[0]?.at ?? null;
}

/** Jedno pobranie workspace + wersji (AppShell, polling API). */
export async function fetchOperationsDailyPanelMetrics(
  options?: {
    userId?: string;
    departments?: import("@/types/database").OperationsDepartment[];
  }
): Promise<OperationsDailyPanelMetrics> {
  const [workspace, verificationCount, openBoardQuestionsCount, deliveryCount, informacjaCount, operationsNotatkiCount, stockWatchComputedAt, boardSupplierReplyAt] = await Promise.all([
    fetchOperationsDailyPanelWorkspace(),
    countVerificationOrders(),
    countOpenDepartmentBoardQuestions().catch(() => 0),
    countDeliveryQueue().catch(() => 0),
    countInformacjaQueue().catch(() => 0),
    options?.userId && options?.departments?.length
      ? import("@/lib/data/operations-notepad").then((m) =>
          m.countOperationsNotepadBadge(options.userId!, options.departments!).catch(() => 0)
        )
      : Promise.resolve(0),
    fetchStockWatchComputedAt().catch(() => null),
    fetchBoardSupplierReplyAt().catch(() => null),
  ]);

  const realizacjaCount = deliveryCount + informacjaCount;

  return {
    version: computeOperationsDailyPanelVersion({
      workspace,
      verificationCount,
      openBoardQuestionsCount,
      stockWatchComputedAt,
      boardSupplierReplyAt,
    }),
    navBadge: countDailyPanelNavBadge(workspace),
    verificationCount,
    openBoardQuestionsCount,
    realizacjaCount,
    operationsNotatkiCount,
  };
}
