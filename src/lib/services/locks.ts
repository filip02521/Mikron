import { createAdminClient } from "@/lib/supabase/admin";

export async function tryAcquireLock(
  key: string,
  ttlSeconds = 30,
  lockedBy = "system"
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("try_acquire_job_lock", {
    p_key: key,
    p_ttl_seconds: ttlSeconds,
    p_locked_by: lockedBy,
  });

  if (error) {
    if (error.message.includes("try_acquire_job_lock")) {
      return tryAcquireLockLegacy(key, ttlSeconds, lockedBy);
    }
    console.error("tryAcquireLock", error.message);
    return false;
  }

  return data === true;
}

/** Fallback gdy migracja 013 nie jest jeszcze na bazie. */
async function tryAcquireLockLegacy(
  key: string,
  ttlSeconds: number,
  lockedBy: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const until = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const { data: existing } = await supabase
    .from("job_locks")
    .select("locked_until")
    .eq("key", key)
    .maybeSingle();

  if (existing?.locked_until && new Date(existing.locked_until) > new Date()) {
    return false;
  }

  const { error } = await supabase.from("job_locks").upsert({
    key,
    locked_until: until,
    locked_by: lockedBy,
  });
  return !error;
}

export async function releaseLock(key: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("job_locks").delete().eq("key", key);
}
