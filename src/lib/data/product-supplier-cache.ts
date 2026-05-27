import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

export type ProductSupplierCacheRow = {
  subiekt_tw_id: number;
  supplier_id: string;
  source: "zd" | "history";
  matched_at: string;
  updated_at: string;
};

export async function listStaleProductSupplierCacheRows(options?: {
  limit?: number;
  staleAfterDays?: number;
}): Promise<ProductSupplierCacheRow[]> {
  if (!hasSupabaseConfig()) return [];
  const limit = Math.max(1, Math.min(200, options?.limit ?? 50));
  const staleAfterDays = Math.max(1, options?.staleAfterDays ?? 21);
  const cutoff = new Date(Date.now() - staleAfterDays * 86_400_000).toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_supplier_cache")
    .select("subiekt_tw_id, supplier_id, source, matched_at, updated_at")
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductSupplierCacheRow[];
}

export async function touchProductSupplierCache(subiektTwId: number): Promise<void> {
  if (!hasSupabaseConfig()) return;
  if (!Number.isFinite(subiektTwId) || subiektTwId <= 0) return;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("product_supplier_cache")
    .update({ updated_at: new Date().toISOString() })
    .eq("subiekt_tw_id", Math.trunc(subiektTwId));
  if (error) throw new Error(error.message);
}

export async function getCachedSupplierForSubiektProduct(
  subiektTwId: number
): Promise<{ supplierId: string; source: ProductSupplierCacheRow["source"]; matchedAt: Date } | null> {
  if (!hasSupabaseConfig()) return null;
  if (!Number.isFinite(subiektTwId) || subiektTwId <= 0) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_supplier_cache")
    .select("subiekt_tw_id, supplier_id, source, matched_at")
    .eq("subiekt_tw_id", Math.trunc(subiektTwId))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    supplierId: data.supplier_id,
    source: data.source,
    matchedAt: new Date(data.matched_at),
  };
}

export async function upsertCachedSupplierForSubiektProduct(input: {
  subiektTwId: number;
  supplierId: string;
  source: "zd" | "history";
}): Promise<void> {
  if (!hasSupabaseConfig()) return;
  if (!Number.isFinite(input.subiektTwId) || input.subiektTwId <= 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from("product_supplier_cache").upsert(
    {
      subiekt_tw_id: Math.trunc(input.subiektTwId),
      supplier_id: input.supplierId,
      source: input.source,
      matched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "subiekt_tw_id" }
  );
  if (error) throw new Error(error.message);
}

