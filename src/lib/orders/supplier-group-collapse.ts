import type { SupplierOrderGroup } from "@/lib/orders/queue-supplier-groups";

const AUTO_EXPAND_MAX_LINES = 3;

/**
 * Domyślnie zwinięte duże grupy; rozwinięte: jeden dostawca lub małe partie (≤3 pozycje).
 */
export function defaultCollapsedSupplierKeys(groups: SupplierOrderGroup[]): Set<string> {
  if (groups.length <= 1) {
    return expandAllSupplierGroups(groups);
  }
  const collapsed = collapseAllSupplierGroups(groups);
  for (const g of groups) {
    if (g.orders.length <= AUTO_EXPAND_MAX_LINES) {
      collapsed.delete(g.supplierKey);
    }
  }
  return collapsed;
}

export function isSupplierGroupExpanded(
  supplierKey: string,
  collapsed: Set<string>
): boolean {
  return !collapsed.has(supplierKey);
}

export function toggleSupplierGroupCollapsed(
  collapsed: Set<string>,
  supplierKey: string
): Set<string> {
  const next = new Set(collapsed);
  if (next.has(supplierKey)) next.delete(supplierKey);
  else next.add(supplierKey);
  return next;
}

export function expandAllSupplierGroups(groups: SupplierOrderGroup[]): Set<string> {
  return new Set();
}

export function collapseAllSupplierGroups(groups: SupplierOrderGroup[]): Set<string> {
  return new Set(groups.map((g) => g.supplierKey));
}
