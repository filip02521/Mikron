"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupplierOrderGroup } from "@/lib/orders/queue-supplier-groups";
import {
  collapseAllSupplierGroups,
  defaultCollapsedSupplierKeys,
  expandAllSupplierGroups,
  isSupplierGroupExpanded,
  toggleSupplierGroupCollapsed,
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
  supplierFilter: string
) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    defaultCollapsedSupplierKeys(groups)
  );

  const signature = supplierGroupsSignature(groups);

  useEffect(() => {
    setCollapsed(() => {
      const next = defaultCollapsedSupplierKeys(groups);
      if (supplierFilter) next.delete(supplierFilter);
      return next;
    });
    // groups — tylko przy zmianie signature (lista dostawców), nie przy każdym refreshu wierszy
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groups zsynchronizowane z signature w rodzicu (useMemo)
  }, [signature, supplierFilter]);

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
