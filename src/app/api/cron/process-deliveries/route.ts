import { NextRequest, NextResponse } from "next/server";
import { processMarkedDeliveries } from "@/lib/services/orders";
import { flushAllDueDeliveryNotifications } from "@/lib/orders/delivery-notification-queue";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { isEmailConfigured } from "@/lib/env/email-config";
import { isProductionRuntime } from "@/lib/env/app-config";
import { isWarsawWorkHours } from "@/lib/time/warsaw";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";

  if (!force && !isWarsawWorkHours()) {
    await recordCronSkipped("process_deliveries", "outside_warsaw_work_hours");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "outside_warsaw_work_hours",
      warsaw: warsawCronContext(),
    });
  }

  try {
    const [marked, queueFlush] = await Promise.all([
      processMarkedDeliveries({ lockedBy: "cron-process-deliveries" }),
      flushAllDueDeliveryNotifications("all").catch((err) => ({
        sent: 0,
        error: err instanceof Error ? err.message : String(err),
      })),
    ]);

    if (marked.skipped) {
      // Kolejka undo i tak mogła coś wysłać — raportujemy osobno poniżej gdy nie skipped lock
      await recordCronSkipped("process_deliveries", marked.skipReason ?? "skipped", {
        lockHeld: true,
        queueFlushSent: queueFlush.sent,
        queueFlushError: queueFlush.error,
      });
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: marked.skipReason ?? "skipped",
        queueFlushSent: queueFlush.sent,
        queueFlushError: queueFlush.error,
      });
    }

    const hasEmailIssues =
      marked.emailFailures.length > 0 || Boolean(queueFlush.error);
    const emailNotConfigured =
      isProductionRuntime() &&
      !isEmailConfigured() &&
      (marked.processed > 0 || Boolean(queueFlush.error));

    await recordCronRun("process_deliveries", {
      ok: !hasEmailIssues && !emailNotConfigured,
      detail: {
        processed: marked.processed,
        emailSent: marked.emailSent,
        emailFailures: marked.emailFailures,
        queueFlushSent: queueFlush.sent,
        queueFlushError: queueFlush.error,
        emailNotConfigured: emailNotConfigured || undefined,
      },
      error: emailNotConfigured
        ? "SMTP not configured"
        : hasEmailIssues
          ? [...marked.emailFailures, queueFlush.error].filter(Boolean).join("; ")
          : undefined,
    });

    if (hasEmailIssues) {
      return NextResponse.json({
        success: false,
        processed: marked.processed,
        emailSent: marked.emailSent,
        emailFailures: marked.emailFailures,
        queueFlushSent: queueFlush.sent,
        queueFlushError: queueFlush.error,
        warning: "Statusy zaktualizowane — część e-maili nie wyszła",
      });
    }

    if (emailNotConfigured) {
      return NextResponse.json({
        success: false,
        processed: marked.processed,
        emailSent: marked.emailSent,
        queueFlushSent: queueFlush.sent,
        warning: "E-mail nie skonfigurowany — statusy zaktualizowane, powiadomienia nie wysłane",
      });
    }

    return NextResponse.json({
      success: true,
      processed: marked.processed,
      emailSent: marked.emailSent,
      queueFlushSent: queueFlush.sent,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    await recordCronRun("process_deliveries", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
