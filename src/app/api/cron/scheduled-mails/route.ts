import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Legacy endpoint — Ivoclar weekly send moved to OnTime Raporty.
 * Kept so old SchTasks / Vercel cron entries fail closed (no send) instead of 404.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  await recordCronSkipped("scheduled_mails", "moved_to_ontime_raporty");
  return NextResponse.json({
    success: true,
    skipped: true,
    reason: "moved_to_ontime_raporty",
    warsaw: warsawCronContext(),
  });
}
