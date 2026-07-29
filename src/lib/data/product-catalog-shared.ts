/** Typy i helpery katalogu produktów — bezpieczne dla klienta (bez Supabase / Subiekta). */

export type ProductCatalogRow = {
  subiektTwId: number;
  symbol: string | null;
  name: string | null;
  plu: string | null;
  note: string;
  lastSeenAt: string;
  totalOrders: number;
  topSupplier: { id: string; name: string; orderCount: number } | null;
  lastActionAt: string | null;
};

export type ProductCatalogPage = {
  rows: ProductCatalogRow[];
  total: number;
  offset: number;
  limit: number;
};

export type ProductCatalogCoverageStats = {
  totalProducts: number;
  withSupplier: number;
  withoutSupplier: number;
};

export function formatCatalogSupplierSubtitle(
  row: ProductCatalogRow,
  filteredSupplierId: string | null,
  filteredSupplierName: string | null
): string {
  if (filteredSupplierId && filteredSupplierName) {
    const main =
      row.topSupplier && row.topSupplier.id !== filteredSupplierId
        ? ` · główny: ${row.topSupplier.name} (${row.topSupplier.orderCount})`
        : "";
    return `${filteredSupplierName} (filtr)${main}`;
  }
  if (row.topSupplier) return `${row.topSupplier.name} (${row.topSupplier.orderCount})`;
  return "bez dostawcy";
}

export function mergeUniqueTwIds(...groups: number[][]): number[] {
  return [...new Set(groups.flat())];
}
