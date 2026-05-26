import { createAdminClient } from "@/lib/supabase/admin";

export type CronRunPayload = {
  ok: boolean;
  at: string;
  detail?: Record<string, unknown>;
  error?: string;
};

export async function recordCronRun(
  job: "process_deliveries" | "morning_sync" | "morning_routine" | "resolve_suppliers",
  payload: Omit<CronRunPayload, "at"> & { at?: string }
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const value: CronRunPayload = {
      at: payload.at ?? new Date().toISOString(),
      ok: payload.ok,
      detail: payload.detail,
      error: payload.error,
    };
    await supabase.from("app_settings").upsert({
      key: `cron_last_${job}`,
      value,
    });
  } catch (e) {
    console.error(`recordCronRun(${job}) failed`, e);
  }
}

export async function readCronRun(
  job:
    | "process_deliveries"
    | "morning_sync"
    | "morning_routine"
    | "resolve_suppliers"
): Promise<CronRunPayload | null> {
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
