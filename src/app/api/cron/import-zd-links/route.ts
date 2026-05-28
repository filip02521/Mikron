import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/services/cron-auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import { importZdLinksBatch } from "@/lib/subiekt/zd-import";

const LOCK_KEY = "cron_import_zd_links";

/** Batch: import produkt→dostawca z historii ZD (Subiekt). */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request.headers.get("authorization"));
  if (denied) return denied;

  const acquired = await tryAcquireLock(LOCK_KEY, 120, "cron-import-zd-links");
  if (!acquired) {
    await recordCronRun("import_zd_links", {
      ok: true,
      detail: { skipped: true, reason: "lock_busy" },
    });
    return NextResponse.json({ success: true, skipped: true, reason: "lock_busy" });
  }

  try {
    const result = await importZdLinksBatch({ limit: 60, onlyMissing: true });
    await recordCronRun("import_zd_links", { ok: true, detail: result });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "import_zd_links failed";
    await recordCronRun("import_zd_links", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseLock(LOCK_KEY);
  }
}

