import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { consumeAuthRateLimit } from "@/lib/auth/auth-rate-limit";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesAccount } from "@/lib/auth-roles";
import { runZdEtaSyncForSalesPerson } from "@/lib/subiekt/zd-eta-sync";

const MANUAL_REFRESH_WINDOW_MS = 5 * 60 * 1000;

/**
 * Odświeżenie terminów ZD dla zalogowanego handlowca (live search włączony).
 * Auto-sync z /moje: ?auto=1 — bez limitu 5 min (osobny bucket).
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const autoSync = new URL(request.url).searchParams.get("auto") === "1";
  if (!autoSync) {
    const rate = await consumeAuthRateLimit({
      bucketKey: `sales:zd-eta-refresh:manual:${user.id}`,
      maxEvents: 1,
      windowMs: MANUAL_REFRESH_WINDOW_MS,
    });
    if (!rate.ok) {
      return NextResponse.json(
        {
          error: rate.unavailable
            ? "Limit odświeżeń jest chwilowo niedostępny."
            : `Poczekaj ${rate.retryAfterSec} s przed kolejnym odświeżeniem ZD.`,
          retryAfterSec: rate.retryAfterSec,
        },
        { status: 429 }
      );
    }
  } else {
    const rate = await consumeAuthRateLimit({
      bucketKey: `sales:zd-eta-refresh:auto:${user.id}`,
      maxEvents: 12,
      windowMs: MANUAL_REFRESH_WINDOW_MS,
    });
    if (!rate.ok) {
      return NextResponse.json(
        {
          error: "Auto-sync ZD jest chwilowo wstrzymany — spróbuj za chwilę.",
          retryAfterSec: rate.retryAfterSec,
        },
        { status: 429 }
      );
    }
  }

  const salesPerson = await resolveSalesPersonForUser(user);
  if (!salesPerson) {
    return NextResponse.json({ error: "Brak powiązanego handlowca" }, { status: 403 });
  }

  try {
    const result = await runZdEtaSyncForSalesPerson(salesPerson.id, {
      force: true,
      allowLiveSearch: true,
    });

    if (result.updated > 0 || result.processed > 0 || result.cleared > 0) {
      revalidatePath("/moje");
    }

    const candidates = result.candidates ?? 0;
    const processed = result.processed ?? 0;

    return NextResponse.json({
      success: result.ok && !result.skipped,
      skipped: result.skipped ?? false,
      reason: result.reason,
      candidates,
      updated: result.updated,
      processed,
      cleared: result.cleared,
      remaining: Math.max(0, candidates - processed),
      subiektOffline: result.subiektOffline ?? false,
      timedOut: result.timedOut ?? false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
