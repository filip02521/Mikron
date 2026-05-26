import { supplierNameMatchesQuery } from "@/lib/subiekt/supplier-search-tokens";

export type SupplierPickRow = {
  id: string;
  name: string;
};

/** Filtrowanie listy dostawców po fragmencie nazwy (bez requestu do API). */
export function filterSuppliersByName(
  suppliers: SupplierPickRow[],
  query: string,
  limit = 12
): SupplierPickRow[] {
  const q = query.trim();
  if (!q) return suppliers.slice(0, limit);
  const out: SupplierPickRow[] = [];
  for (const s of suppliers) {
    if (!supplierNameMatchesQuery(s.name, q)) continue;
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}
