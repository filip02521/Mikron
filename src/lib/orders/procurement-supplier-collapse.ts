import type { ProcurementSupplierBlock } from "@/lib/orders/procurement-supplier-groups";
import { showProcurementSupplierBlockHeader } from "@/lib/orders/procurement-supplier-groups";

/** Od ilu grup (osób) u dostawcy domyślnie zwijamy listę w panelu Dziś. */
export const PROCUREMENT_SUPPLIER_DEFAULT_COLLAPSE_MIN_GROUPS = 3;

export type ProcurementSupplierCollapseOverrides = ReadonlyMap<string, boolean>;

/** Blok z nagłówkiem dostawcy (2+ handlowców). */
export function isProcurementSupplierBlockCollapsible(
  block: ProcurementSupplierBlock
): boolean {
  return showProcurementSupplierBlockHeader(block);
}

/** Domyślnie zwinięty: 3+ grupy i brak nieprzeczytanych. */
export function shouldDefaultCollapseProcurementBlock(
  block: ProcurementSupplierBlock
): boolean {
  if (!isProcurementSupplierBlockCollapsible(block)) return false;
  if (block.hasUnseen) return false;
  return block.requestGroups.length >= PROCUREMENT_SUPPLIER_DEFAULT_COLLAPSE_MIN_GROUPS;
}

export function listCollapsibleProcurementBlocks(
  blocks: ProcurementSupplierBlock[]
): ProcurementSupplierBlock[] {
  return blocks.filter(isProcurementSupplierBlockCollapsible);
}

/** Czy blok jest zwinięty — nowe prośby zawsze rozwijają (serwer lub lokalny tracker). */
export function isProcurementSupplierBlockCollapsed(
  block: ProcurementSupplierBlock,
  manualOverrides: ProcurementSupplierCollapseOverrides,
  forceExpandedSupplierIds: ReadonlySet<string> = new Set()
): boolean {
  if (!isProcurementSupplierBlockCollapsible(block)) return false;
  if (block.hasUnseen || forceExpandedSupplierIds.has(block.supplierId)) return false;

  const manual = manualOverrides.get(block.supplierId);
  if (manual !== undefined) return manual;

  return shouldDefaultCollapseProcurementBlock(block);
}

export function collapsedProcurementSupplierIds(
  blocks: ProcurementSupplierBlock[],
  manualOverrides: ProcurementSupplierCollapseOverrides,
  forceExpandedSupplierIds: ReadonlySet<string> = new Set()
): Set<string> {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (
      isProcurementSupplierBlockCollapsed(
        block,
        manualOverrides,
        forceExpandedSupplierIds
      )
    ) {
      ids.add(block.supplierId);
    }
  }
  return ids;
}

/** Wszystkie zwijalne bloki rozwinięte (z uwzględnieniem wymuszenia przez „Nowa”). */
export function allCollapsibleProcurementBlocksExpanded(
  blocks: ProcurementSupplierBlock[],
  manualOverrides: ProcurementSupplierCollapseOverrides,
  forceExpandedSupplierIds: ReadonlySet<string> = new Set()
): boolean {
  const collapsible = listCollapsibleProcurementBlocks(blocks);
  if (!collapsible.length) return true;
  return collapsible.every(
    (block) =>
      !isProcurementSupplierBlockCollapsed(
        block,
        manualOverrides,
        forceExpandedSupplierIds
      )
  );
}

export function procurementSupplierCollapseStorageKey(): string {
  return "procurement-supplier-collapse-v1";
}

export function readProcurementSupplierCollapseOverrides(): Map<string, boolean> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(procurementSupplierCollapseStorageKey());
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

export function writeProcurementSupplierCollapseOverrides(
  overrides: ProcurementSupplierCollapseOverrides
): void {
  if (typeof window === "undefined") return;
  try {
    const obj = Object.fromEntries([...overrides.entries()]);
    localStorage.setItem(procurementSupplierCollapseStorageKey(), JSON.stringify(obj));
  } catch {
    /* ignore quota / private mode */
  }
}
