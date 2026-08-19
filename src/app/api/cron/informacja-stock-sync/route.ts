import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { runInformacjaStockAutoArrive } from "@/lib/services/informacja-stock-sync";
import { isWarsawWorkHours } from "@/lib/time/warsaw";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Automatyczne powiadomienie handlowca, gdy towar z prośby informacyjnej
 * pojawi się na stanie w Subiekcie (vercel.json pn–pt co godz.).
 * Ręcznie: GET z nagłówkiem cron auth, opcjonalnie ?force=1
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";

  if (!force && !isWarsawWorkHours()) {
    await recordCronSkipped("informacja_stock_sync", "outside_warsaw_work_hours");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "outside_warsaw_work_hours",
      warsaw: warsawCronContext(),
    });
  }

  try {
    const result = await runInformacjaStockAutoArrive({
      lockedBy: "cron-informacja-stock-sync",
      revalidate: true,
    });

    if (result.skipped) {
      await recordCronSkipped(
        "informacja_stock_sync",
        result.skipReason ?? "skipped",
        {
          lockHeld: result.skipReason === "lock_held",
          subiektOffline: result.subiektOffline ?? false,
        }
      );
      if (result.subiektOffline && result.skipReason === "subiekt_offline") {
        return NextResponse.json(
          {
            success: false,
            skipped: true,
            reason: result.skipReason,
            error: "Subiekt niedostępny",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: result.skipReason,
      });
    }

    const detail: Record<string, unknown> = {
      candidates: result.candidates,
      eligible: result.eligible,
      updated: result.updated,
      skippedOrders: result.skippedOrders,
      emailSent: result.emailSent,
      timedOut: result.timedOut ?? false,
      subiektOffline: result.subiektOffline ?? false,
    };
    if (result.emailError) detail.emailError = result.emailError;

    await recordCronRun("informacja_stock_sync", {
      ok: result.ok && !result.emailError,
      detail,
      error: result.emailError,
    });

    return NextResponse.json({
      success: result.ok && !result.emailError,
      ...detail,
      warning: result.emailError
        ? "Statusy zaktualizowane — część e-maili nie wyszła"
        : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    await recordCronRun("informacja_stock_sync", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
