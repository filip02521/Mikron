import type { StatsMode } from "@/types/database";

/** Dostawca w formularzach prośby / weryfikacji / edycji — z powiązaniem Subiekt. */
export type OrderFormSupplierOption = {
  id: string;
  name: string;
  stats_mode?: StatsMode;
  subiekt_kh_id?: number | null;
};

type SupplierRowLike = {
  id: string;
  name: string;
  stats_mode?: StatsMode | string | null;
  subiekt_kh_id?: number | null;
};

export function mapRowToOrderFormSupplier(row: SupplierRowLike): OrderFormSupplierOption {
  return {
    id: row.id,
    name: row.name,
    stats_mode: (row.stats_mode ?? "LACZNIE") as StatsMode,
    subiekt_kh_id: row.subiekt_kh_id ?? null,
  };
}

export function mapRowsToOrderFormSuppliers(rows: SupplierRowLike[]): OrderFormSupplierOption[] {
  return rows.map(mapRowToOrderFormSupplier);
}

/** Minimalny wiersz wymagany przez {@link import("@/lib/subiekt/match-supplier").toAppSupplierRefs}. */
export function orderFormSuppliersHaveSubiektRefs(
  suppliers: OrderFormSupplierOption[]
): boolean {
  return suppliers.every((s) => "subiekt_kh_id" in s);
}
