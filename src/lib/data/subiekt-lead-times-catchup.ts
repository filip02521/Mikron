/**
 * Czasy dostaw ZD → FZ jako krok nadrabiający w istniejącym cronie `catalog-zd-sync` (02:00–04:40)
 * — bez osobnego zadania Windows (`install-cron.ps1` nie jest uruchamiany przy wdrożeniu).
 * Raz na dzień warszawski; kończy się przed `stock-watch` (5:30), który czyta czasy dostaw automatu.
 * Przebieg bez zapisu (błąd, Subiekt offline, blokada) = ponowienie w kolejnym slocie.
 */
import { recordCronRun } from "@/lib/services/cron-run-log";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";
import { warsawNowParts } from "@/lib/time/warsaw";
import {
  readSubiektLeadTimesState,
  runSubiektLeadTimesSync,
  type SubiektLeadTimesSyncMode,
  type SubiektLeadTimesSyncState,
} from "@/lib/data/subiekt-lead-times-sync";
import { runSupplierCountrySync } from "@/lib/data/supplier-country-sync";

/** Do zrobienia: brak udanej synchronizacji (crona albo ręcznej z /admin) z dzisiejszego dnia warszawskiego. */
export function subiektLeadTimesDue(state: Pick<SubiektLeadTimesSyncState, "at" | "ok"> | null, todayKey: string): boolean {
  if (!state?.ok || !state.at) return true;
  const at = new Date(state.at);
  return Number.isNaN(at.getTime()) || warsawNowParts(at).dateKey !== todayKey;
}

/** Synchronizacja + kraj dostawców + wpis do monitora crona — wspólne dla trasy i kroku nadrabiającego. */
export async function runSubiektLeadTimesCron(mode: SubiektLeadTimesSyncMode, extraDetail: Record<string, unknown> = {}) {
  if (!(await isSubiektReachable({ force: true }))) {
    await recordCronRun("subiekt_lead_times", {
      ok: false,
      detail: { subiektOffline: true, ...extraDetail, ...warsawCronContext() },
      error: "subiekt_offline",
    });
    return { status: "subiekt_offline" as const };
  }

  const result = await runSubiektLeadTimesSync(mode);
  if ("skipped" in result) {
    await recordCronSkipped("subiekt_lead_times", "already_running", extraDetail);
    return { status: "already_running" as const };
  }

  // Błąd kraju dostawców nie psuje wyniku czasów dostaw.
  const countrySync = await runSupplierCountrySync().catch((e: unknown) => ({
    error: e instanceof Error ? e.message : String(e),
  }));

  await recordCronRun("subiekt_lead_times", {
    ok: result.ok,
    detail: {
      mode,
      docsFetched: result.docsFetched,
      samplesAssigned: result.samplesAssigned,
      durationMs: result.durationMs,
      countrySync,
      ...extraDetail,
      ...warsawCronContext(),
    },
    error: result.error,
  });
  return { status: result.ok ? ("done" as const) : ("failed" as const), result, countrySync };
}

export async function runSubiektLeadTimesCatchUp(): Promise<"not_due" | "done" | "failed" | "already_running" | "subiekt_offline"> {
  if (!subiektLeadTimesDue(await readSubiektLeadTimesState(), warsawNowParts().dateKey)) return "not_due";
  return (await runSubiektLeadTimesCron("incremental", { viaCatalogZdSync: true })).status;
}
