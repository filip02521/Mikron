import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun, type CronRunPayload } from "@/lib/services/cron-run-log";
import {
  isWarsawCatalogSyncWindow,
  runCatalogZdSync,
} from "@/lib/subiekt/catalog-zd-sync";
import { runZdEtaSyncGlobalBackup } from "@/lib/subiekt/zd-eta-sync";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  try {
    const result = await runCatalogZdSync({ force, maxDurationMs: 4 * 60 * 1000 });

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

    const payload: Omit<CronRunPayload, "at"> = {
      ok: result.ok && !result.subiektOffline,
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
