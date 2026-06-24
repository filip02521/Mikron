import type { SupabaseClient } from "@supabase/supabase-js";

function escapeIlike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/**
 * Gdy handlowiec wpisał symbol / PLU bez wyboru z listy Subiekta — dopasuj tw_Id z lokalnego katalogu.
 */
export async function resolveOrderLineSubiektTwIdFromCatalog(
  supabase: SupabaseClient,
  input: {
    subiektTwId?: number | null;
    symbol?: string | null;
    mikranCode?: string | null;
  }
): Promise<number | null> {
  const existing =
    input.subiektTwId != null ? Math.trunc(Number(input.subiektTwId)) : null;
  if (existing && Number.isFinite(existing) && existing > 0) return existing;

  const symbol = String(input.symbol ?? "").trim();
  const plu = String(input.mikranCode ?? "").trim();

  if (symbol) {
    const pattern = escapeIlike(symbol);
    const { data, error } = await supabase
      .from("subiekt_products")
      .select("subiekt_tw_id, symbol")
      .ilike("symbol", pattern)
      .limit(2);
    if (error) throw new Error(error.message);
    if ((data ?? []).length === 1) {
      const row = (data ?? [])[0] as { subiekt_tw_id: number | string };
      return Number(row.subiekt_tw_id) || null;
    }
  }

  if (plu) {
    const pattern = escapeIlike(plu);
    const { data, error } = await supabase
      .from("subiekt_products")
      .select("subiekt_tw_id, plu")
      .ilike("plu", pattern)
      .limit(2);
    if (error) throw new Error(error.message);
    if ((data ?? []).length === 1) {
      const row = (data ?? [])[0] as { subiekt_tw_id: number | string };
      return Number(row.subiekt_tw_id) || null;
    }
  }

  return null;
}
