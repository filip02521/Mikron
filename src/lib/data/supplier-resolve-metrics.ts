import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

export type SupplierResolveMetrics = {
  total: number;
  promoted: number;
  failed: number;
  notFound: number;
  skipped: number;
  offline: number;
  promotedPct: number;
  sinceDays: number;
};

export async function recordSupplierResolveLog(
  orderId: string,
  result: string,
  durationMs?: number
): Promise<void> {
  if (!hasSupabaseConfig()) return;
  const supabase = createAdminClient();
  await supabase.from("supplier_resolve_log").insert({
    order_id: orderId,
    result,
    duration_ms: durationMs ?? null,
  });
}

export async function fetchSupplierResolveMetrics(
  sinceDays = 7
): Promise<SupplierResolveMetrics> {
  if (!hasSupabaseConfig()) {
    return {
      total: 0,
      promoted: 0,
      failed: 0,
      notFound: 0,
      skipped: 0,
      offline: 0,
      promotedPct: 0,
      sinceDays,
    };
  }

  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("supplier_resolve_log")
    .select("result")
    .gte("created_at", since.toISOString());

  if (error) throw new Error(error.message);

  const counts = {
    promoted: 0,
    failed: 0,
    not_found: 0,
    skipped: 0,
    offline: 0,
  };

  for (const row of data ?? []) {
    const r = row.result as string;
    if (r === "promoted") counts.promoted++;
    else if (r === "not_found") counts.not_found++;
    else if (r === "skipped") counts.skipped++;
    else if (r === "offline") counts.offline++;
    else counts.failed++;
  }

  const total = data?.length ?? 0;
  const promotedPct = total > 0 ? Math.round((counts.promoted / total) * 100) : 0;

  return {
    total,
    promoted: counts.promoted,
    failed: counts.failed,
    notFound: counts.not_found,
    skipped: counts.skipped,
    offline: counts.offline,
    promotedPct,
    sinceDays,
  };
}
