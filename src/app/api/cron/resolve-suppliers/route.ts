import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import {
  fetchPendingSupplierResolveOrderIds,
  resolveOrdersSupplierBackground,
} from "@/lib/subiekt/resolve-order-supplier";
import { revalidatePath } from "next/cache";

/** Uzupełnia dostawców z Subiekta dla prośb zapisanych w tle (retry / gdy after() nie zdążył). */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  try {
    const ids = await fetchPendingSupplierResolveOrderIds(25);
    if (!ids.length) {
      await recordCronRun("resolve_suppliers", { ok: true, detail: { processed: 0 } });
      return NextResponse.json({ success: true, processed: 0 });
    }

    const result = await resolveOrdersSupplierBackground(ids);
    revalidatePath("/podsumowanie");
    revalidatePath("/weryfikacja");
    revalidatePath("/moje");

    await recordCronRun("resolve_suppliers", {
      ok: true,
      detail: { ...result, queued: ids.length },
    });

    return NextResponse.json({ success: true, ...result, queued: ids.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "resolve_suppliers failed";
    await recordCronRun("resolve_suppliers", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
