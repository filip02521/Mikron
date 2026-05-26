import { describe, expect, it } from "vitest";
import {
  defaultCollapsedSupplierKeys,
  isSupplierGroupExpanded,
  toggleSupplierGroupCollapsed,
} from "./supplier-group-collapse";
import type { SupplierOrderGroup } from "./queue-supplier-groups";

describe("supplier group collapse", () => {
  const groups: SupplierOrderGroup[] = [
    { supplierKey: "A", orders: [{ id: "1" } as never] },
    { supplierKey: "B", orders: [{ id: "2" } as never, { id: "3" } as never] },
  ];

  it("zwija wszystkie grupy domyślnie", () => {
    const collapsed = defaultCollapsedSupplierKeys(groups);
    expect(collapsed.has("A")).toBe(true);
    expect(collapsed.has("B")).toBe(true);
    expect(isSupplierGroupExpanded("A", collapsed)).toBe(false);
    expect(isSupplierGroupExpanded("B", collapsed)).toBe(false);
  });

  it("toggle rozwija zwiniętą grupę", () => {
    let c = defaultCollapsedSupplierKeys(groups);
    c = toggleSupplierGroupCollapsed(c, "B");
    expect(isSupplierGroupExpanded("B", c)).toBe(true);
  });
});
