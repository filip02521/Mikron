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

  it("tryb all zwija wszystkie grupy", () => {
    const collapsed = defaultCollapsedSupplierKeys(groups, "all");
    expect(isSupplierGroupExpanded("A", collapsed)).toBe(false);
    expect(isSupplierGroupExpanded("B", collapsed)).toBe(false);
  });

  it("rozwija małe grupy, zwija większe przy wielu dostawcach", () => {
    const collapsed = defaultCollapsedSupplierKeys(groups);
    expect(isSupplierGroupExpanded("A", collapsed)).toBe(true);
    expect(isSupplierGroupExpanded("B", collapsed)).toBe(true);
  });

  it("rozwija jedyną grupę dostawcy", () => {
    const single = defaultCollapsedSupplierKeys([groups[0]!]);
    expect(isSupplierGroupExpanded("A", single)).toBe(true);
  });

  it("toggle rozwija zwiniętą grupę", () => {
    const big: SupplierOrderGroup[] = [
      { supplierKey: "A", orders: Array.from({ length: 5 }, (_, i) => ({ id: `a${i}` } as never)) },
      { supplierKey: "B", orders: Array.from({ length: 5 }, (_, i) => ({ id: `b${i}` } as never)) },
    ];
    let c = defaultCollapsedSupplierKeys(big);
    expect(isSupplierGroupExpanded("B", c)).toBe(false);
    c = toggleSupplierGroupCollapsed(c, "B");
    expect(isSupplierGroupExpanded("B", c)).toBe(true);
  });
});
