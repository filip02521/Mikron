import { after, NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { runSubiektLeadTimesCatchUp } from "@/lib/data/subiekt-lead-times-catchup";
import { runRolCronStep } from "@/lib/rol/cron";
import { recordCronRun, type CronRunPayload } from "@/lib/services/cron-run-log";
import {
  CATALOG_ZD_SYNC_CRON_BUDGET_MS,
  isWarsawCatalogSyncWindow,
  runCatalogZdSync,
} from "@/lib/subiekt/catalog-zd-sync";
import { runZdEtaSyncGlobalBackup } from "@/lib/subiekt/zd-eta-sync";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

/** Krok ROL: skan (ok. 20 s) + PDF-y FS po ok. 45 s — w ramach jednego slotu 20 min. */
const ROL_STEP_BUDGET_MS = 12 * 60 * 1000;

/**
 * Nocna synchronizacja katalogu produktów ze Subiekta (indeks ZD + import linii).
 * Uruchamiaj z crona na serwerze w LAN (np. 02:00 Europe/Warsaw).
 * Ręcznie: ?force=1 pomija okno nocne i „już dziś”.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";

  if (!force && !isWarsawCatalogSyncWindow()) {
    await recordCronSkipped("catalog_zd_sync", "outside_warsaw_night_window");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "outside_warsaw_night_window",
      warsaw: warsawCronContext(),
    });
  }

  // Czasy dostaw ZD → FZ raz na dzień, w tle po odpowiedzi slotu — przed stock-watch (5:30), który z nich korzysta.
  if (!force) {
    after(async () => {
      try {
        const leadTimes = await runSubiektLeadTimesCatchUp();
        if (leadTimes !== "not_due") console.info("[catalog-zd-sync] czasy dostaw z Subiekta", leadTimes);
      } catch (e) {
        console.error("[catalog-zd-sync] czasy dostaw z Subiekta", e);
      }
      // Zgłoszenia ROL po czasach dostaw (Subiekt drukuje PDF-y FS po kolei — nie równolegle z innymi krokami).
      // Skan raz na dzień, dopóki zgłoszenie poprzedniego miesiąca nie jest wysłane; wynik w monitorze cronów.
      await runRolCronStep({ budgetMs: ROL_STEP_BUDGET_MS });
    });
  }

  try {
    const result = await runCatalogZdSync({ force, maxDurationMs: CATALOG_ZD_SYNC_CRON_BUDGET_MS });

    const detail: Record<string, unknown> = {
      skipped: result.skipped ?? false,
      reason: result.reason,
      timedOut: result.timedOut,
      subiektOffline: result.subiektOffline ?? false,
      phase: result.state.phase,
      indexComplete: result.state.indexComplete,
      importComplete: result.state.importComplete,
      indexProcessed: result.state.indexProcessed,
      importProcessedDocs: result.state.importProcessedDocs,
      importPending: result.state.importPending,
      autoAssignUpdated: result.state.autoAssignUpdated,
      runId: result.state.runId,
    };

    const partialContinuation =
      result.timedOut &&
      !result.subiektOffline &&
      !result.skipped &&
      !result.state.lastError;

    const payload: Omit<CronRunPayload, "at"> = {
      ok: (result.ok && !result.subiektOffline) || partialContinuation,
      detail,
      error: result.state.lastError ?? (result.subiektOffline ? "subiekt_offline" : undefined),
    };

    await recordCronRun("catalog_zd_sync", payload);

    let zdEtaBackup: Awaited<ReturnType<typeof runZdEtaSyncGlobalBackup>> | null =
      null;
    if (result.ok && !result.skipped && !result.subiektOffline) {
      try {
        zdEtaBackup = await runZdEtaSyncGlobalBackup();
      } catch (e) {
        console.error("[catalog-zd-sync zd-eta backup]", e);
      }
    }

    if (result.skipped) {
      if (result.reason === "lock_held") {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: "lock_held",
          ...detail,
        });
      }
      return NextResponse.json({
        success: true,
        skipped: true,
        ...detail,
        zdEtaBackup,
      });
    }

    if (result.subiektOffline) {
      return NextResponse.json(
        { success: false, error: "Subiekt niedostępny", ...detail },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: result.ok,
      ...detail,
      status: result.state.status,
      zdEtaBackup,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    await recordCronRun("catalog_zd_sync", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
