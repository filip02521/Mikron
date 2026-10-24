import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { runZdKpiWeekly } from "@/lib/data/zd-kpi-weekly";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

/** Poniedziałek 07:00: KPI automatu ZD za miniony tydzień (pn–nd) → zd_kpi_weekly. */
export async function GET(request: Request) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  if (!(await isSubiektReachable({ force: true }))) {
    await recordCronRun("zd_kpi_weekly", {
      ok: false,
      detail: { subiektOffline: true, ...warsawCronContext() },
      error: "subiekt_offline",
    });
    return NextResponse.json({ success: false, error: "subiekt_offline" }, { status: 503 });
  }

  const result = await runZdKpiWeekly();
  if ("skipped" in result) {
    await recordCronSkipped("zd_kpi_weekly", "already_running");
    return NextResponse.json({ success: true, skipped: true, reason: "already_running" });
  }

  const { ok, error, ...detail } = result;
  await recordCronRun("zd_kpi_weekly", { ok, detail: { ...detail, ...warsawCronContext() }, error });
  return NextResponse.json({ success: ok, ...result }, { status: ok ? 200 : 500 });
}
