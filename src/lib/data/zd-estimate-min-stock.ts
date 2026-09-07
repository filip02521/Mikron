import { createAdminClient } from "@/lib/supabase/admin";

export type ZdEstimateMinStockRow = {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  grtId: number | null;
  grtNazwa: string | null;
  /** Minimalna liczba sztuk fizycznych — dobija cel ZD nawet przy braku sprzedaży. */
  minStockSzt: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
};

type DbRow = {
  subiekt_tw_id: number;
  tw_symbol: string | null;
  tw_nazwa: string | null;
  grt_id: number | null;
  grt_nazwa: string | null;
  min_stock_szt: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

const SELECT_COLS =
  "subiekt_tw_id, tw_symbol, tw_nazwa, grt_id, grt_nazwa, min_stock_szt, note, created_at, updated_at, created_by";

const PG_UNIQUE_VIOLATION = "23505";

export function mapZdEstimateMinStockRow(row: DbRow): ZdEstimateMinStockRow {
  return {
    subiektTwId: Number(row.subiekt_tw_id),
    twSymbol: row.tw_symbol?.trim() || null,
    twNazwa: (row.tw_nazwa ?? "").trim() || "—",
    grtId: row.grt_id != null ? Number(row.grt_id) : null,
    grtNazwa: row.grt_nazwa?.trim() || null,
    minStockSzt: Math.max(0, Math.trunc(Number(row.min_stock_szt))),
    note: (row.note ?? "").trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

export async function fetchZdEstimateMinStock(): Promise<
  ZdEstimateMinStockRow[]
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_min_stock")
    .select(SELECT_COLS)
    .order("tw_symbol", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapZdEstimateMinStockRow(row as DbRow));
}

export async function fetchZdEstimateMinStockOne(
  subiektTwId: number
): Promise<ZdEstimateMinStockRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_min_stock")
    .select(SELECT_COLS)
    .eq("subiekt_tw_id", Math.trunc(subiektTwId))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapZdEstimateMinStockRow(data as DbRow);
}

async function updateExistingMinStock(input: {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  grtId: number | null;
  grtNazwa: string | null;
  minStockSzt: number;
  note?: string;
}): Promise<ZdEstimateMinStockRow> {
  const existing = await fetchZdEstimateMinStockOne(input.subiektTwId);
  if (!existing) {
    throw new Error("Minimum stanów nie istnieje (wyścig usunięcia).");
  }
  const supabase = createAdminClient();
  const note =
    input.note !== undefined
      ? input.note.trim().slice(0, 500)
      : existing.note;
  const { data, error } = await supabase
    .from("zd_estimate_min_stock")
    .update({
      tw_symbol: input.twSymbol ?? existing.twSymbol,
      tw_nazwa: input.twNazwa,
      grt_id: input.grtId ?? existing.grtId,
      grt_nazwa: input.grtNazwa ?? existing.grtNazwa,
      min_stock_szt: input.minStockSzt,
      note,
      updated_at: new Date().toISOString(),
    })
    .eq("subiekt_tw_id", input.subiektTwId)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(error.message);
  return mapZdEstimateMinStockRow(data as DbRow);
}

/**
 * Zapisuje minimum stanów (min_stock_szt ≥ 0).
 * min_stock_szt = 0 = usuń (brak minimum).
 */
export async function upsertZdEstimateMinStock(input: {
  subiektTwId: number;
  twSymbol?: string | null;
  twNazwa: string;
  grtId?: number | null;
  grtNazwa?: string | null;
  minStockSzt: number;
  note?: string;
  createdBy?: string | null;
}): Promise<ZdEstimateMinStockRow | null> {
  const subiektTwId = Math.trunc(input.subiektTwId);
  if (!Number.isFinite(subiektTwId) || subiektTwId <= 0) {
    throw new Error("Niepoprawne tw_Id produktu.");
  }

  const minStockSzt = Math.max(0, Math.trunc(Number(input.minStockSzt)));
  if (!Number.isFinite(minStockSzt) || minStockSzt > 1_000_000) {
    throw new Error("Minimum stanów musi być liczbą całkowitą 0–1 000 000.");
  }

  const twNazwa = input.twNazwa.trim() || `Towar ${subiektTwId}`;
  const twSymbol = input.twSymbol?.trim() || null;
  const grtId = input.grtId ?? null;
  const grtNazwa = input.grtNazwa?.trim() || null;
  const now = new Date().toISOString();

  const existing = await fetchZdEstimateMinStockOne(subiektTwId);
  if (existing) {
    return updateExistingMinStock({
      subiektTwId,
      twSymbol,
      twNazwa,
      grtId,
      grtNazwa,
      minStockSzt,
      note: input.note,
    });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_min_stock")
    .insert({
      subiekt_tw_id: subiektTwId,
      tw_symbol: twSymbol,
      tw_nazwa: twNazwa,
      grt_id: grtId,
      grt_nazwa: grtNazwa,
      min_stock_szt: minStockSzt,
      note: (input.note ?? "").trim().slice(0, 500),
      created_at: now,
      updated_at: now,
      created_by: input.createdBy ?? null,
    })
    .select(SELECT_COLS)
    .single();

  if (!error) {
    return mapZdEstimateMinStockRow(data as DbRow);
  }
  if (error.code === PG_UNIQUE_VIOLATION) {
    return updateExistingMinStock({
      subiektTwId,
      twSymbol,
      twNazwa,
      grtId,
      grtNazwa,
      minStockSzt,
      note: input.note,
    });
  }
  throw new Error(error.message);
}

export async function deleteZdEstimateMinStock(
  subiektTwId: number
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("zd_estimate_min_stock")
    .delete()
    .eq("subiekt_tw_id", Math.trunc(subiektTwId));
  if (error) throw new Error(error.message);
}

/**
 * Mapa tw_Id → minStockSzt do szybkiego lookupu w estymacji.
 * Eksportowana też z lib/orders/zd-estimate-min-stock-lookup (client-safe).
 */
export function minStockRowsToMap(
  rows: readonly ZdEstimateMinStockRow[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const row of rows) {
    if (row.minStockSzt > 0) {
      map.set(row.subiektTwId, row.minStockSzt);
    }
  }
  return map;
}
