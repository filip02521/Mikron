import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";
import { warsawNowParts } from "@/lib/time/warsaw";
import {
  isWarsawStockWatchWindow,
  runStockWatchWorker,
  STOCK_WATCH_CRON_BUDGET_MS,
} from "@/lib/stock-watch/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

/**
 * Nocna analiza braków (panel /zakupy/braki). Tylko odczyt z Subiekta.
 * Cron co 20 min w oknie 5:00–6:59 (Warszawa) — niedokończone zakresy
 * kontynuowane w kolejnym slocie. Ręcznie: ?force=1 (nowy przebieg, poza oknem).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";
  if (!force && !isWarsawStockWatchWindow()) {
    await recordCronSkipped("stock_watch", "outside_warsaw_window");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "outside_warsaw_window",
      warsaw: warsawCronContext(),
    });
  }

  const result = await runStockWatchWorker({
    trigger: "cron",
    force,
    budgetMs: STOCK_WATCH_CRON_BUDGET_MS,
  });

  // Pominięcie „już zrobione dziś” nie nadpisuje wpisu z udanego przebiegu.
  if (!(result.skipped && result.reason === "already_done_today")) {
    await recordCronRun("stock_watch", {
      ok: result.ok && (result.scopesFailed ?? 0) === 0,
      detail: { ...result, warsawDateKey: warsawNowParts().dateKey },
      error: result.error,
    });
  }

  return NextResponse.json({ success: result.ok, ...result }, {
    status: result.ok ? 200 : 503,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
