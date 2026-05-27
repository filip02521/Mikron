import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import { refreshProductSupplierCacheBatch } from "@/lib/subiekt/refresh-product-supplier-cache";

const LOCK_KEY = "cron_refresh_product_supplier_cache";

/** Odświeża okresowo cache tw_Id → dostawca (żeby nie skanować ZD przy każdym użyciu). */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const acquired = await tryAcquireLock(LOCK_KEY, 120, "cron-refresh-product-supplier-cache");
  if (!acquired) {
    await recordCronRun("refresh_product_supplier_cache", {
      ok: true,
      detail: { skipped: true, reason: "lock_busy" },
    });
    return NextResponse.json({ success: true, skipped: true, reason: "lock_busy" });
  }

  try {
    const result = await refreshProductSupplierCacheBatch({ limit: 60, staleAfterDays: 21 });
    await recordCronRun("refresh_product_supplier_cache", {
      ok: true,
      detail: result,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "refresh_product_supplier_cache failed";
    await recordCronRun("refresh_product_supplier_cache", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseLock(LOCK_KEY);
  }
}

