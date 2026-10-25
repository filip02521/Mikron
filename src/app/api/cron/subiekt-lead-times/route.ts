import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { runSubiektLeadTimesCron } from "@/lib/data/subiekt-lead-times-catchup";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

/**
 * Ręcznie (`-Job subiekt-lead-times`): ZD/FZ z ostatnich 18 mies. → czasy dostaw ZD → FZ → delivery_stats.
 * Codziennie uruchamia to `catalog-zd-sync` jako krok nadrabiający (`subiekt-lead-times-catchup.ts`).
 * `?full=1` — cała historia od 2006 (ok. 5 min).
 * Potem kraj dostawców z Subiekta (`adr_IdPanstwo`) — błąd tego kroku nie psuje wyniku czasów dostaw.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const mode = request.nextUrl.searchParams.get("full") === "1" ? "full" : "incremental";
  const run = await runSubiektLeadTimesCron(mode);
  if (run.status === "subiekt_offline") {
    return NextResponse.json({ success: false, error: "subiekt_offline" }, { status: 503 });
  }
  if (run.status === "already_running") {
    return NextResponse.json({ success: true, skipped: true, reason: "already_running" });
  }
  const { result, countrySync } = run;
  return NextResponse.json({ success: result.ok, ...result, countrySync }, { status: result.ok ? 200 : 500 });
}
