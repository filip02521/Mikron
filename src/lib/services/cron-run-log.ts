import { createAdminClient } from "@/lib/supabase/admin";
import { captureServerEvent } from "@/lib/posthog/server";
import {
  CRON_JOB_IDS,
  type CronJobId,
  type CronRunPayload,
} from "@/lib/services/cron-run-shared";

export type { CronJobId, CronRunPayload } from "@/lib/services/cron-run-shared";
export { CRON_JOB_IDS } from "@/lib/services/cron-run-shared";
export async function recordCronRun(
  job: CronJobId,
  payload: Omit<CronRunPayload, "at"> & { at?: string }
): Promise<boolean> {
  // Puls cronu w PostHog (alert, gdy go brak albo ok=false) — niezależnie od zapisu w bazie.
  const detail = (payload.detail ?? {}) as { skipped?: unknown; reason?: unknown };
  try {
    captureServerEvent("cron_run", {
      job,
      ok: payload.ok,
      skipped: detail.skipped === true,
      reason: typeof detail.reason === "string" ? detail.reason : undefined,
      error: payload.error,
    });
  } catch (e) {
    // recordCronRun nigdy nie rzuca — wywołujący crony na tym polegają.
    console.error(`recordCronRun(${job}) posthog failed`, e);
  }
  try {
    const supabase = createAdminClient();
    const value: CronRunPayload = {
      at: payload.at ?? new Date().toISOString(),
      ok: payload.ok,
      detail: payload.detail,
      error: payload.error,
    };
    const { error } = await supabase.from("app_settings").upsert({
      key: `cron_last_${job}`,
      value,
    });
    if (error) {
      console.error(`recordCronRun(${job}) upsert failed`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`recordCronRun(${job}) failed`, e);
    return false;
  }
}

export async function readCronRun(job: CronJobId): Promise<CronRunPayload | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", `cron_last_${job}`)
      .maybeSingle();
    if (!data?.value || typeof data.value !== "object") return null;
    return data.value as CronRunPayload;
  } catch {
    return null;
  }
}

export async function readAllCronRuns(): Promise<Record<CronJobId, CronRunPayload | null>> {
  const entries = await Promise.all(
    CRON_JOB_IDS.map(async (id) => [id, await readCronRun(id)] as const)
  );
  return Object.fromEntries(entries) as Record<CronJobId, CronRunPayload | null>;
}
