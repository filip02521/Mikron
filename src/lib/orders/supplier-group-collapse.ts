import type { SupplierOrderGroup } from "@/lib/orders/queue-supplier-groups";

/** Domyślnie zwinięte: wszystkie grupy dostawców. */
export function defaultCollapsedSupplierKeys(groups: SupplierOrderGroup[]): Set<string> {
  return collapseAllSupplierGroups(groups);
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
