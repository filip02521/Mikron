import { NextRequest, NextResponse } from "next/server";
import { sendDailyStatusToSales } from "@/lib/services/email";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { isProductionRuntime } from "@/lib/env/app-config";
import { isEmailConfigured } from "@/lib/env/email-config";

export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  try {
    const result = await sendDailyStatusToSales();

    if (result.skipped && result.reason === "email_not_configured") {
      if (isProductionRuntime() && !isEmailConfigured()) {
        await recordCronRun("daily_sales", {
          ok: false,
          error: "RESEND_API_KEY not configured",
        });
        return NextResponse.json(
          { error: "E-mail nie skonfigurowany", skipped: true },
          { status: 503 }
        );
      }
    }

    const hasFailures = result.failures.length > 0;
    await recordCronRun("daily_sales", {
      ok: !hasFailures && !result.skipped,
      detail: {
        sent: result.sent,
        skipped: result.skipped,
        reason: result.reason,
        failures: result.failures,
      },
      error: hasFailures ? result.failures.join("; ") : undefined,
    });

    if (hasFailures) {
      return NextResponse.json(
        { success: false, sent: result.sent, failures: result.failures },
        { status: 207 }
      );
    }

    return NextResponse.json({
      success: true,
      sent: result.sent,
      skipped: result.skipped,
      reason: result.reason,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    await recordCronRun("daily_sales", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
