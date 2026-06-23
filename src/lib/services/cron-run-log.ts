import { createAdminClient } from "@/lib/supabase/admin";

export type CronRunPayload = {
  ok: boolean;
  at: string;
  detail?: Record<string, unknown>;
  error?: string;
};

export type CronJobId =
  | "process_deliveries"
  | "morning_sync"
  | "morning_routine"
  | "catalog_zd_sync"
  | "zd_eta_sync";

export const CRON_JOB_IDS: CronJobId[] = [
  "morning_routine",
  "process_deliveries",
  "zd_eta_sync",
  "catalog_zd_sync",
  "morning_sync",
];

export async function recordCronRun(
  job: CronJobId,
  payload: Omit<CronRunPayload, "at"> & { at?: string }
): Promise<boolean> {
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
