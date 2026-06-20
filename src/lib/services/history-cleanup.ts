import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  dataRetentionCutoffDateOnly,
  dataRetentionCutoffIso,
} from "@/lib/data/data-retention";
import {
  HISTORY_TERMINAL_STATUSES,
} from "@/lib/orders/history-retention";
import { tryAcquireLock } from "@/lib/services/locks";

/** Krótszy TTL niż okno rate limit — tylko zapasowe sprzątanie zdarzeń auth. */
const AUTH_RATE_LIMIT_RETENTION_MS = 48 * 60 * 60 * 1000;

export type DataRetentionResult = {
  cutoffIso: string;
  cutoffDateOnly: string;
  individualDeleted: number;
  normalDeleted: number;
  warehouseReceiptsDeleted: number;
  operationsNotesDeleted: number;
  productEventsDeleted: number;
  salesBugReportsDeleted: number;
  departmentBoardThreadsDeleted: number;
  passwordResetOtpsDeleted: number;
  subiektZdIndexDeleted: number;
  authRateLimitEventsDeleted: number;
};

/** @deprecated Użyj DataRetentionResult — zachowane dla kompatybilności crona. */
export type HistoryCleanupResult = Pick<
  DataRetentionResult,
  "individualDeleted" | "normalDeleted" | "cutoffIso"
>;

/** Co najwyżej jedno czyszczenie na 24 h (bez crona na serwerze aplikacji). */
const DATA_RETENTION_LOCK_KEY = "history_retention_purge";
const DATA_RETENTION_LOCK_TTL_SEC = 24 * 60 * 60;

/**
 * Uruchamia czyszczenie w tle po zapisie do historii — nie blokuje żądania.
 * Dzięki blokadzie w bazie nie odpala się przy każdym wpisie, tylko ~raz dziennie przy aktywności.
 */
export function scheduleHistoryRetentionPurge(): void {
  void (async () => {
    if (!hasSupabaseConfig()) return;
    const acquired = await tryAcquireLock(
      DATA_RETENTION_LOCK_KEY,
      DATA_RETENTION_LOCK_TTL_SEC,
      "data-retention"
    );
    if (!acquired) return;
    try {
      await purgeDataRetention();
    } catch (e) {
      console.error("[data-retention] purge failed:", e);
    }
  })();
}

/** Usuwa dane starsze niż okres retencji (domyślnie 3 miesiące). */
export async function purgeDataRetention(): Promise<DataRetentionResult> {
  const cutoffIso = dataRetentionCutoffIso();
  const cutoffDateOnly = dataRetentionCutoffDateOnly();
  const empty: DataRetentionResult = {
    cutoffIso,
    cutoffDateOnly,
    individualDeleted: 0,
    normalDeleted: 0,
    warehouseReceiptsDeleted: 0,
    operationsNotesDeleted: 0,
    productEventsDeleted: 0,
    salesBugReportsDeleted: 0,
    departmentBoardThreadsDeleted: 0,
    passwordResetOtpsDeleted: 0,
    subiektZdIndexDeleted: 0,
    authRateLimitEventsDeleted: 0,
  };

  if (!hasSupabaseConfig()) return empty;

  const supabase = createAdminClient();
  const authRateLimitCutoffIso = new Date(Date.now() - AUTH_RATE_LIMIT_RETENTION_MS).toISOString();
  const nowIso = new Date().toISOString();

  const [
    individualResult,
    normalResult,
    warehouseResult,
    operationsNotesResult,
    productEventsResult,
    salesBugReportsResult,
    departmentBoardResult,
    passwordResetOtpsResult,
    subiektZdIndexResult,
    authRateLimitResult,
  ] = await Promise.all([
    supabase
      .from("individual_orders")
      .delete({ count: "exact" })
      .lt("action_at", cutoffIso)
      .in("status", [...HISTORY_TERMINAL_STATUSES]),
    supabase.from("normal_order_history").delete({ count: "exact" }).lt("action_at", cutoffIso),
    supabase
      .from("warehouse_delivery_receipts")
      .delete({ count: "exact" })
      .lt("received_date", cutoffDateOnly),
    supabase
      .from("operations_notes")
      .delete({ count: "exact" })
      .not("archived_at", "is", null)
      .lt("archived_at", cutoffIso),
    supabase.from("product_events").delete({ count: "exact" }).lt("created_at", cutoffIso),
    supabase
      .from("sales_bug_reports")
      .delete({ count: "exact" })
      .eq("status", "closed")
      .lt("updated_at", cutoffIso),
    supabase
      .from("department_board_threads")
      .delete({ count: "exact" })
      .not("archived_at", "is", null)
      .lt("archived_at", cutoffIso),
    supabase.from("password_reset_otps").delete({ count: "exact" }).lt("expires_at", nowIso),
    supabase.from("subiekt_zd_index").delete({ count: "exact" }).lt("processed_at", cutoffIso),
    supabase
      .from("auth_rate_limit_events")
      .delete({ count: "exact" })
      .lt("created_at", authRateLimitCutoffIso),
  ]);

  const errors = [
    individualResult.error,
    normalResult.error,
    warehouseResult.error,
    operationsNotesResult.error,
    productEventsResult.error,
    salesBugReportsResult.error,
    departmentBoardResult.error,
    passwordResetOtpsResult.error,
    subiektZdIndexResult.error,
    authRateLimitResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors.map((e) => e!.message).join("; "));
  }

  return {
    cutoffIso,
    cutoffDateOnly,
    individualDeleted: individualResult.count ?? 0,
    normalDeleted: normalResult.count ?? 0,
    warehouseReceiptsDeleted: warehouseResult.count ?? 0,
    operationsNotesDeleted: operationsNotesResult.count ?? 0,
    productEventsDeleted: productEventsResult.count ?? 0,
    salesBugReportsDeleted: salesBugReportsResult.count ?? 0,
    departmentBoardThreadsDeleted: departmentBoardResult.count ?? 0,
    passwordResetOtpsDeleted: passwordResetOtpsResult.count ?? 0,
    subiektZdIndexDeleted: subiektZdIndexResult.count ?? 0,
    authRateLimitEventsDeleted: authRateLimitResult.count ?? 0,
  };
}

/** @deprecated alias — użyj purgeDataRetention */
export async function purgeHistoryRetention(): Promise<HistoryCleanupResult> {
  const result = await purgeDataRetention();
  return {
    individualDeleted: result.individualDeleted,
    normalDeleted: result.normalDeleted,
    cutoffIso: result.cutoffIso,
  };
}
