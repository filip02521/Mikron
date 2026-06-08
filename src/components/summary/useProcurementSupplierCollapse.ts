"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProcurementSupplierBlock } from "@/lib/orders/procurement-supplier-groups";
import {
  allCollapsibleProcurementBlocksExpanded,
  collapsedProcurementSupplierIds,
  listCollapsibleProcurementBlocks,
  readProcurementSupplierCollapseOverrides,
  writeProcurementSupplierCollapseOverrides,
} from "@/lib/orders/procurement-supplier-collapse";

/** Zwijanie bloków wieloosobowych u dostawcy — domyślne reguły + ręczne nadpisania. */
export function useProcurementSupplierCollapse(
  blocks: ProcurementSupplierBlock[],
  forceExpandedSupplierIds: ReadonlySet<string> = new Set()
) {
  const [manualOverrides, setManualOverrides] = useState<Map<string, boolean>>(
    () => new Map()
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setManualOverrides(readProcurementSupplierCollapseOverrides());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const valid = new Set(blocks.map((b) => b.supplierId));
    setManualOverrides((prev) => {
      const next = new Map([...prev].filter(([id]) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [blocks, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeProcurementSupplierCollapseOverrides(manualOverrides);
  }, [manualOverrides, hydrated]);

  /** Po „Nowa” utrzymuj rozwinięcie — nie zwijaj automatycznie po mark seen. */
  useEffect(() => {
    if (!hydrated || !forceExpandedSupplierIds.size) return;
    setManualOverrides((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const id of forceExpandedSupplierIds) {
        if (next.get(id) !== false) {
          next.set(id, false);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [forceExpandedSupplierIds, hydrated]);

  const collapsibleBlocks = useMemo(
    () => listCollapsibleProcurementBlocks(blocks),
    [blocks]
  );

  const collapsedSuppliers = useMemo(
    () =>
      collapsedProcurementSupplierIds(
        blocks,
        manualOverrides,
        forceExpandedSupplierIds
      ),
    [blocks, manualOverrides, forceExpandedSupplierIds]
  );

  const allSupplierBlocksExpanded = useMemo(
    () =>
      allCollapsibleProcurementBlocksExpanded(
        blocks,
        manualOverrides,
        forceExpandedSupplierIds
      ),
    [blocks, manualOverrides, forceExpandedSupplierIds]
  );

  const toggleSupplierCollapse = useCallback(
    (supplierId: string) => {
      setManualOverrides((prev) => {
        const currentlyCollapsed = collapsedProcurementSupplierIds(
          blocks,
          prev,
          forceExpandedSupplierIds
        ).has(supplierId);
        const next = new Map(prev);
        next.set(supplierId, !currentlyCollapsed);
        return next;
      });
    },
    [blocks, forceExpandedSupplierIds]
  );

  const setAllSupplierBlocksExpanded = useCallback(
    (expanded: boolean) => {
      setManualOverrides((prev) => {
        const next = new Map(prev);
        for (const block of collapsibleBlocks) {
          if (!expanded && forceExpandedSupplierIds.has(block.supplierId)) {
            continue;
          }
          next.set(block.supplierId, !expanded);
        }
        return next;
      });
    },
    [collapsibleBlocks, forceExpandedSupplierIds]
  );

  return {
    collapsibleBlocks,
    collapsedSuppliers,
    allSupplierBlocksExpanded,
    toggleSupplierCollapse,
    setAllSupplierBlocksExpanded,
  };
}
