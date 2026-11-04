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
  /** Dostawca przypięty ręcznie — automaty nie dopisują innych. null = tryb automatyczny. */
  manualSupplierId: string | null;
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
  if (row.topSupplier) {
    const pinned = row.manualSupplierId === row.topSupplier.id ? " · ręcznie" : "";
    const main = `${row.topSupplier.name} (${row.topSupplier.orderCount})${pinned}`;
    if (
      filteredSupplierId &&
      filteredSupplierName &&
      row.topSupplier.id !== filteredSupplierId
    ) {
      return `${main} · filtr: ${filteredSupplierName}`;
    }
    return main;
  }
  if (filteredSupplierId && filteredSupplierName) {
    return `${filteredSupplierName} (filtr) · bez głównego`;
  }
  return "bez dostawcy";
}

export function mergeUniqueTwIds(...groups: number[][]): number[] {
  return [...new Set(groups.flat())];
}
