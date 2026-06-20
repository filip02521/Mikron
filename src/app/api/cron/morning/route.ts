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
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";
  const warsaw = warsawCronContext();

  if (!force && !isWarsawMorningRoutineHour()) {
    await recordCronSkipped("morning_routine", "outside_warsaw_6am_window");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "outside_warsaw_6am_window",
      warsaw,
    });
  }

  if (!force && (await morningRoutineAlreadyRanToday())) {
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
    revalidatePath("/historia");

    const issues = [
      ...result.sync.scheduleErrors,
      ...result.deliveries.emailFailures,
    ];

    await recordCronRun("morning_routine", {
      ok: issues.length === 0,
      detail: {
        warsawDateKey: warsaw.dateKey,
        schedulesProcessed: result.sync.schedulesProcessed,
        deliveriesProcessed: result.deliveries.processed,
        historyIndividualDeleted: result.historyCleanup.individualDeleted,
        historyNormalDeleted: result.historyCleanup.normalDeleted,
        warehouseReceiptsDeleted: result.historyCleanup.warehouseReceiptsDeleted,
        operationsNotesDeleted: result.historyCleanup.operationsNotesDeleted,
        productEventsDeleted: result.historyCleanup.productEventsDeleted,
        salesBugReportsDeleted: result.historyCleanup.salesBugReportsDeleted,
        departmentBoardThreadsDeleted: result.historyCleanup.departmentBoardThreadsDeleted,
        passwordResetOtpsDeleted: result.historyCleanup.passwordResetOtpsDeleted,
        subiektZdIndexDeleted: result.historyCleanup.subiektZdIndexDeleted,
        authRateLimitEventsDeleted: result.historyCleanup.authRateLimitEventsDeleted,
        dataRetentionCutoff: result.historyCleanup.cutoffDateOnly,
        issues,
      },
      error: issues.length ? issues.join("; ") : undefined,
    });

    return NextResponse.json({
      success: issues.length === 0,
      sync: result.sync,
      deliveries: result.deliveries,
      historyCleanup: result.historyCleanup,
      issues,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    await recordCronRun("morning_routine", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
