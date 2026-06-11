"use client";

import { useCallback, useState } from "react";
import type { SupplierOrderGroup } from "@/lib/orders/queue-supplier-groups";
import {
  collapseAllSupplierGroups,
  defaultCollapsedSupplierKeys,
  expandAllSupplierGroups,
  isSupplierGroupExpanded,
  toggleSupplierGroupCollapsed,
  type SupplierGroupCollapseMode,
} from "@/lib/orders/supplier-group-collapse";

/** Stabilny podpis listy grup — zmiana przy dodaniu/usunięciu dostawcy. */
export function supplierGroupsSignature(groups: SupplierOrderGroup[]): string {
  return groups.map((g) => g.supplierKey).join("\u0000");
}

/**
 * Stan zwijania grup dostawcy: domyślnie wszystkie zwinięte,
 * wybrany filtr chipa — grupa rozwinięta.
 */
export function useSupplierGroupCollapse(
  groups: SupplierOrderGroup[],
  supplierFilter: string,
  options?: { collapseMode?: SupplierGroupCollapseMode }
) {
  const collapseMode = options?.collapseMode ?? "smart";
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    defaultCollapsedSupplierKeys(groups, collapseMode)
  );

  const signature = supplierGroupsSignature(groups);
  const collapseSyncKey = `${signature}\0${supplierFilter}\0${collapseMode}`;
  const [appliedCollapseSyncKey, setAppliedCollapseSyncKey] = useState(collapseSyncKey);
  if (collapseSyncKey !== appliedCollapseSyncKey) {
    setAppliedCollapseSyncKey(collapseSyncKey);
    const next = defaultCollapsedSupplierKeys(groups, collapseMode);
    if (supplierFilter) next.delete(supplierFilter);
    setCollapsed(next);
  }

  const toggle = useCallback((supplierKey: string) => {
    setCollapsed((prev) => toggleSupplierGroupCollapsed(prev, supplierKey));
  }, []);

  const isExpanded = useCallback(
    (supplierKey: string) => isSupplierGroupExpanded(supplierKey, collapsed),
    [collapsed]
  );

  const expandAll = useCallback(() => {
    setCollapsed(expandAllSupplierGroups(groups));
  }, [groups]);

  const collapseAll = useCallback(() => {
    setCollapsed(collapseAllSupplierGroups(groups));
  }, [groups]);

  const allExpanded =
    groups.length > 0 && groups.every((g) => isSupplierGroupExpanded(g.supplierKey, collapsed));

  return {
    collapsed,
    setCollapsed,
    toggle,
    isExpanded,
    expandAll,
    collapseAll,
    allExpanded,
  };
}
