import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import {
  notepadFollowUpAlreadyRanToday,
  runNotepadFollowUpEmails,
} from "@/lib/services/notepad-follow-up-email";
import { isWarsawNotepadFollowUpHour } from "@/lib/time/warsaw";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

/** Digest e-mail: follow-up i ZK po terminie — 7:00 Europe/Warsaw (pn–pt). */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const warsaw = warsawCronContext();

  if (!isWarsawNotepadFollowUpHour()) {
    await recordCronSkipped("notepad_follow_up", "outside_warsaw_7am_window");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "outside_warsaw_7am_window",
      warsaw,
    });
  }

  if (await notepadFollowUpAlreadyRanToday()) {
    await recordCronSkipped("notepad_follow_up", "already_ran_today");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "already_ran_today",
      warsaw,
    });
  }

  try {
    const result = await runNotepadFollowUpEmails(warsaw.dateKey);

    revalidatePath("/notatnik");
    revalidatePath("/", "layout");

    await recordCronRun("notepad_follow_up", {
      ok: result.failures.length === 0,
      detail: {
        warsawDateKey: warsaw.dateKey,
        sent: result.sent,
        recipients: result.recipients,
        itemsNotified: result.itemsNotified,
        failures: result.failures,
      },
      error: result.failures.length
        ? result.failures.map((f) => `${f.to}: ${f.error}`).join("; ")
        : undefined,
    });

    return NextResponse.json({
      success: result.failures.length === 0,
      ...result,
      warsaw,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    await recordCronRun("notepad_follow_up", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
