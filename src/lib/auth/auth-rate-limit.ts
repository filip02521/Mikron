import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

const CLEANUP_OLDER_THAN_MS = 24 * 60 * 60 * 1000;

async function cleanupOldRateLimitEvents(supabase: ReturnType<typeof createAdminClient>) {
  const cleanupBeforeIso = new Date(Date.now() - CLEANUP_OLDER_THAN_MS).toISOString();
  await supabase
    .from("auth_rate_limit_events")
    .delete()
    .lt("created_at", cleanupBeforeIso);
}

/** Sprawdza limit bez rejestrowania zdarzenia (np. przed logowaniem). */
export async function checkAuthRateLimit(params: {
  bucketKey: string;
  maxEvents: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  if (!hasSupabaseConfig()) {
    return { ok: true };
  }

  const supabase = createAdminClient();
  const sinceIso = new Date(Date.now() - params.windowMs).toISOString();

  await cleanupOldRateLimitEvents(supabase);

  const { count, error: countError } = await supabase
    .from("auth_rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket_key", params.bucketKey)
    .gte("created_at", sinceIso);

  if (countError) {
    console.error("[auth-rate-limit] count failed:", countError.message);
    return { ok: true };
  }

  if ((count ?? 0) >= params.maxEvents) {
    const { data: oldest } = await supabase
      .from("auth_rate_limit_events")
      .select("created_at")
      .eq("bucket_key", params.bucketKey)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const retryAfterSec = oldest?.created_at
      ? Math.max(
          1,
          Math.ceil(
            (Date.parse(oldest.created_at) + params.windowMs - Date.now()) / 1000
          )
        )
      : Math.ceil(params.windowMs / 1000);

    return { ok: false, retryAfterSec };
  }

  return { ok: true };
}

/** Rejestruje nieudaną próbę (lub żądanie objęte limitem, np. wysyłka OTP). */
export async function recordAuthRateLimitEvent(params: { bucketKey: string }): Promise<void> {
  if (!hasSupabaseConfig()) return;

  const supabase = createAdminClient();
  const { error: insertError } = await supabase.from("auth_rate_limit_events").insert({
    bucket_key: params.bucketKey,
  });

  if (insertError) {
    console.error("[auth-rate-limit] insert failed:", insertError.message);
  }
}

/** Sprawdza limit i od razu rejestruje zdarzenie — reset OTP, weryfikacja kodu. */
export async function consumeAuthRateLimit(params: {
  bucketKey: string;
  maxEvents: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const result = await checkAuthRateLimit(params);
  if (!result.ok) return result;
  await recordAuthRateLimitEvent({ bucketKey: params.bucketKey });
  return { ok: true };
}

export function authRateLimitBucket(prefix: string, part: string): string {
  return `${prefix}:${part.trim().toLowerCase()}`;
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
