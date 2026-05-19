import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { runMorningRoutine } from "@/lib/operations/automation";
import { isWarsawMorningRoutineHour } from "@/lib/time/warsaw";
import {
  morningRoutineAlreadyRanToday,
  recordCronSkipped,
  warsawCronContext,
} from "@/lib/time/warsaw-cron";

/**
 * Pełna poranna rutyna o 6:00 Europe/Warsaw (pn–pt):
 * 1. Przelicz terminy dostawców → panel dzienny
 * 2. Domknij pozycje w kolejce realizacji (z wpisaną ilością dostarczoną)
 * 3. Wyślij codzienny status do handlowców (jeśli Resend skonfigurowany)
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const warsaw = warsawCronContext();

  if (!isWarsawMorningRoutineHour()) {
    await recordCronSkipped("morning_routine", "outside_warsaw_6am_window");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "outside_warsaw_6am_window",
      warsaw,
    });
  }

  if (await morningRoutineAlreadyRanToday()) {
    await recordCronSkipped("morning_routine", "already_ran_today");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "already_ran_today",
      warsaw,
    });
  }

  try {
    const result = await runMorningRoutine();

    revalidatePath("/podsumowanie");
    revalidatePath("/plan");
    revalidatePath("/kolejka");
    revalidatePath("/moje");
    revalidatePath("/lokalizacje/[location]", "page");

    const issues = [
      ...result.sync.scheduleErrors,
      ...result.deliveries.emailFailures,
      ...result.dailySales.failures,
    ];
    const skippedEmail =
      result.dailySales.skipped && result.dailySales.reason === "email_not_configured";

    await recordCronRun("morning_routine", {
      ok: issues.length === 0 && !skippedEmail,
      detail: {
        warsawDateKey: warsaw.dateKey,
        schedulesProcessed: result.sync.schedulesProcessed,
        deliveriesProcessed: result.deliveries.processed,
        dailySalesSent: result.dailySales.sent,
        dailySalesSkipped: result.dailySales.skipped,
        dailySalesReason: result.dailySales.reason,
        issues,
      },
      error: issues.length ? issues.join("; ") : skippedEmail ? "email_not_configured" : undefined,
    });

    return NextResponse.json({
      success: issues.length === 0,
      sync: result.sync,
      deliveries: result.deliveries,
      dailySales: result.dailySales,
      issues,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    await recordCronRun("morning_routine", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
