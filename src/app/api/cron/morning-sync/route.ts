import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { runMorningScheduleSync } from "@/lib/operations/automation";
import { isWarsawMorningRoutineHour } from "@/lib/time/warsaw";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  if (!isWarsawMorningRoutineHour()) {
    await recordCronSkipped("morning_sync", "outside_warsaw_6am_window");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "outside_warsaw_6am_window",
      warsaw: warsawCronContext(),
    });
  }

  try {
    const sync = await runMorningScheduleSync();

    revalidatePath("/podsumowanie");
    revalidatePath("/plan");
    revalidatePath("/kolejka");
    revalidatePath("/lokalizacje/[location]", "page");

    const ok = sync.scheduleErrors.length === 0;
    await recordCronRun("morning_sync", {
      ok,
      detail: {
        schedulesProcessed: sync.schedulesProcessed,
        errors: sync.scheduleErrors,
      },
      error: ok ? undefined : sync.scheduleErrors.join("; "),
    });

    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          schedulesProcessed: sync.schedulesProcessed,
          errors: sync.scheduleErrors,
        },
        { status: 207 }
      );
    }

    return NextResponse.json({
      success: true,
      schedulesProcessed: sync.schedulesProcessed,
      message:
        "Harmonogramy przeliczone — panel dzienny i lokalizacje pokażą aktualne terminy po odświeżeniu strony.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    await recordCronRun("morning_sync", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
