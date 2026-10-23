import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { runSubiektLeadTimesSync } from "@/lib/data/subiekt-lead-times-sync";
import { runSupplierCountrySync } from "@/lib/data/supplier-country-sync";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

/**
 * Noc (01:30): ZD/FZ z ostatnich 18 mies. → czasy dostaw ZD → FZ → delivery_stats.
 * `?full=1` — cała historia od 2006 (ok. 5 min).
 * Potem kraj dostawców z Subiekta (`adr_IdPanstwo`) — błąd tego kroku nie psuje wyniku czasów dostaw.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  if (!(await isSubiektReachable({ force: true }))) {
    await recordCronRun("subiekt_lead_times", {
      ok: false,
      detail: { subiektOffline: true, ...warsawCronContext() },
      error: "subiekt_offline",
    });
    return NextResponse.json({ success: false, error: "subiekt_offline" }, { status: 503 });
  }

  const mode = request.nextUrl.searchParams.get("full") === "1" ? "full" : "incremental";
  const result = await runSubiektLeadTimesSync(mode);
  if ("skipped" in result) {
    await recordCronSkipped("subiekt_lead_times", "already_running");
    return NextResponse.json({ success: true, skipped: true, reason: "already_running" });
  }

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
      ...warsawCronContext(),
    },
    error: result.error,
  });
  return NextResponse.json({ success: result.ok, ...result, countrySync }, { status: result.ok ? 200 : 500 });
}
