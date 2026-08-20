import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { IVOCLAR_WEEKLY_JOB_ID, runIvoclarWeeklyMail } from "@/lib/services/mail/run-ivoclar-weekly-mail";
import { loadMailJob } from "@/lib/services/mail/mail-log";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import { isWarsawScheduledMailWindow } from "@/lib/time/warsaw";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOCK_KEY = "scheduled-mails";
const LOCK_TTL_SEC = 360;

export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";

  if (!force && !isWarsawScheduledMailWindow()) {
    await recordCronSkipped("scheduled_mails", "outside_warsaw_mail_window");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "outside_warsaw_mail_window",
      warsaw: warsawCronContext(),
    });
  }

  const lockOk = await tryAcquireLock(LOCK_KEY, LOCK_TTL_SEC, "cron-scheduled-mails");
  if (!lockOk) {
    await recordCronSkipped("scheduled_mails", "lock_held");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "lock_held",
    });
  }

  try {
    const job = await loadMailJob(IVOCLAR_WEEKLY_JOB_ID);
    if (!job?.enabled) {
      await recordCronSkipped("scheduled_mails", "job_disabled");
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "job_disabled",
      });
    }

    const result = await runIvoclarWeeklyMail({ trigger: "cron" });

    if (result.ok && result.skipped) {
      await recordCronSkipped("scheduled_mails", result.skipReason ?? "skipped");
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: result.skipReason,
      });
    }

    if (!result.ok) {
      await recordCronRun("scheduled_mails", {
        ok: false,
        error: result.error,
      });
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    const detail: Record<string, unknown> = {
      jobId: IVOCLAR_WEEKLY_JOB_ID,
      logId: result.logId,
      status: result.status,
      hadWarnings: result.hadWarnings ?? false,
      issuesCount: result.issuesCount ?? 0,
      blockingIssueCount: result.blockingIssueCount ?? 0,
    };

    await recordCronRun("scheduled_mails", {
      ok: result.status === "sent",
      detail,
      error: result.status === "failed" ? "Wysyłka Ivoclar nie powiodła się" : undefined,
    });

    return NextResponse.json({
      success: result.status === "sent",
      ...detail,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    await recordCronRun("scheduled_mails", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseLock(LOCK_KEY);
  }
}
