import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { runZdEtaSync } from "@/lib/subiekt/zd-eta-sync";
import { isWarsawWorkHours } from "@/lib/time/warsaw";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Backup sync terminów ZD w godzinach pracy (vercel.json co 2 h, pn–pt).
 * Ręcznie: GET z nagłówkiem cron auth, opcjonalnie ?force=1
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";

  if (!force && !isWarsawWorkHours()) {
    await recordCronSkipped("zd_eta_sync", "outside_warsaw_work_hours");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "outside_warsaw_work_hours",
      warsaw: warsawCronContext(),
    });
  }

  try {
    const result = await runZdEtaSync({
      maxDurationMs: 280_000,
      force,
      allowLiveSearch: true,
    });

    if (result.skipped) {
      await recordCronSkipped("zd_eta_sync", result.reason ?? "skipped", {
        subiektOffline: result.subiektOffline ?? false,
      });
      return NextResponse.json({ success: true, skipped: true, reason: result.reason });
    }

    if (result.updated > 0) {
      revalidatePath("/moje");
    }

    const detail: Record<string, unknown> = {
      candidates: result.candidates,
      processed: result.processed,
      updated: result.updated,
      cleared: result.cleared,
      docsFetched: result.docsFetched,
      timedOut: result.timedOut ?? false,
      subiektOffline: result.subiektOffline ?? false,
    };

    await recordCronRun("zd_eta_sync", {
      ok: result.ok && !result.subiektOffline,
      detail,
      error: result.subiektOffline ? "subiekt_offline" : undefined,
    });

    if (result.subiektOffline) {
      return NextResponse.json(
        { success: false, error: "Subiekt niedostępny", ...detail },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: result.ok, ...detail });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    await recordCronRun("zd_eta_sync", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
