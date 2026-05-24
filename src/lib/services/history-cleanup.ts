import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  historyRetentionCutoffIso,
  HISTORY_TERMINAL_STATUSES,
} from "@/lib/orders/history-retention";
import { tryAcquireLock } from "@/lib/services/locks";

export type HistoryCleanupResult = {
  individualDeleted: number;
  normalDeleted: number;
  cutoffIso: string;
};

/** Co najwyżej jedno czyszczenie na 24 h (bez crona na serwerze aplikacji). */
const HISTORY_PURGE_LOCK_KEY = "history_retention_purge";
const HISTORY_PURGE_LOCK_TTL_SEC = 24 * 60 * 60;

/**
 * Uruchamia czyszczenie w tle po zapisie do historii — nie blokuje żądania.
 * Dzięki blokadzie w bazie nie odpala się przy każdym wpisie, tylko ~raz dziennie przy aktywności.
 */
export function scheduleHistoryRetentionPurge(): void {
  void (async () => {
    if (!hasSupabaseConfig()) return;
    const acquired = await tryAcquireLock(
      HISTORY_PURGE_LOCK_KEY,
      HISTORY_PURGE_LOCK_TTL_SEC,
      "history-retention"
    );
    if (!acquired) return;
    try {
      await purgeHistoryRetention();
    } catch (e) {
      console.error("[history-retention] purge failed:", e);
    }
  })();
}

/** Usuwa wpisy starsze niż okres retencji (domyślnie 6 miesięcy). */
export async function purgeHistoryRetention(): Promise<HistoryCleanupResult> {
  const cutoffIso = historyRetentionCutoffIso();
  if (!hasSupabaseConfig()) {
    return { individualDeleted: 0, normalDeleted: 0, cutoffIso };
  }

  const supabase = createAdminClient();

  const { count: individualDeleted, error: indErr } = await supabase
    .from("individual_orders")
    .delete({ count: "exact" })
    .lt("action_at", cutoffIso)
    .in("status", [...HISTORY_TERMINAL_STATUSES]);

  if (indErr) throw new Error(indErr.message);

  const { count: normalDeleted, error: normErr } = await supabase
    .from("normal_order_history")
    .delete({ count: "exact" })
    .lt("action_at", cutoffIso);

  if (normErr) throw new Error(normErr.message);

  return {
    individualDeleted: individualDeleted ?? 0,
    normalDeleted: normalDeleted ?? 0,
    cutoffIso,
  };
}
