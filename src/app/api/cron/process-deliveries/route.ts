import { NextRequest, NextResponse } from "next/server";
import { processMarkedDeliveries } from "@/lib/services/orders";
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
    const result = await processMarkedDeliveries();
    const hasEmailIssues = result.emailFailures.length > 0;
    const emailNotConfigured =
      isProductionRuntime() && !isEmailConfigured() && result.processed > 0;

    await recordCronRun("process_deliveries", {
      ok: !hasEmailIssues && !emailNotConfigured,
      detail: {
        processed: result.processed,
        emailSent: result.emailSent,
        emailFailures: result.emailFailures,
        emailNotConfigured: emailNotConfigured || undefined,
      },
      error: emailNotConfigured
        ? "RESEND_API_KEY not configured"
        : hasEmailIssues
          ? result.emailFailures.join("; ")
          : undefined,
    });

    if (hasEmailIssues) {
      return NextResponse.json(
        {
          success: false,
          processed: result.processed,
          emailSent: result.emailSent,
          emailFailures: result.emailFailures,
        },
        { status: 207 }
      );
    }

    if (emailNotConfigured) {
      return NextResponse.json(
        {
          success: false,
          processed: result.processed,
          emailSent: result.emailSent,
          warning: "E-mail nie skonfigurowany — statusy zaktualizowane, powiadomienia nie wysłane",
        },
        { status: 207 }
      );
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      emailSent: result.emailSent,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    await recordCronRun("process_deliveries", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
