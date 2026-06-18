import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesAccount } from "@/lib/auth-roles";
import { runZdEtaSyncForSalesPerson } from "@/lib/subiekt/zd-eta-sync";

/**
 * Ręczne odświeżenie terminów ZD dla zalogowanego handlowca (live search włączony).
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({
      success: result.ok && !result.skipped,
      skipped: result.skipped ?? false,
      reason: result.reason,
      candidates: result.candidates,
      updated: result.updated,
      processed: result.processed,
      cleared: result.cleared,
      subiektOffline: result.subiektOffline ?? false,
      timedOut: result.timedOut ?? false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
