import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

export type TeethProductRow = {
  subiektTwId: number;
  symbol: string | null;
  name: string;
  plu: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: Record<string, unknown>): TeethProductRow {
  return {
    subiektTwId: Number(row.subiekt_tw_id),
    symbol: row.symbol != null ? String(row.symbol) : null,
    name: String(row.name ?? ""),
    plu: row.plu != null ? String(row.plu) : null,
    note: String(row.note ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function fetchTeethProducts(): Promise<TeethProductRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("prosba_teeth_products")
    .select("subiekt_tw_id, symbol, name, plu, note, created_at, updated_at")
    .order("name")
    .order("symbol");

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function fetchTeethProductTwIds(): Promise<number[]> {
  const rows = await fetchTeethProducts();
  return rows.map((row) => row.subiektTwId);
}

export async function fetchTeethProductTwIdSet(): Promise<Set<number>> {
  const ids = await fetchTeethProductTwIds();
  return new Set(ids.map((id) => Math.trunc(id)));
}
