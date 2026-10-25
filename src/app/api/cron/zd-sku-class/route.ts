import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { runZdSkuClassSync } from "@/lib/data/zd-sku-class-sync";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

export const dynamic = "force-dynamic";
/** Pełny przebieg (wszystkie zmapowane zakresy) to kilkanaście minut. */
export const maxDuration = 1800;

/** Ręcznie (`cron-invoke -Job zd-sku-class`); co miesiąc liczy to `stock-watch` (`zd-automat-catchup`). Klasy ABC (zysk 12 mies.) × XYZ (52 tygodnie) → zd_sku_class. */
export async function GET(request: Request) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  if (!(await isSubiektReachable({ force: true }))) {
    await recordCronRun("zd_sku_class", {
      ok: false,
      detail: { subiektOffline: true, ...warsawCronContext() },
      error: "subiekt_offline",
    });
    return NextResponse.json({ success: false, error: "subiekt_offline" }, { status: 503 });
  }

  const result = await runZdSkuClassSync();
  if ("skipped" in result) {
    await recordCronSkipped("zd_sku_class", "already_running");
    return NextResponse.json({ success: true, skipped: true, reason: "already_running" });
  }

  const { ok, error, ...detail } = result;
  await recordCronRun("zd_sku_class", { ok, detail: { ...detail, ...warsawCronContext() }, error });
  return NextResponse.json({ success: ok, ...result }, { status: ok ? 200 : 500 });
}
