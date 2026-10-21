import { describe, expect, it } from "vitest";
import type { ZdSharedScopeProduct } from "@/lib/data/zd-scope-order";
import {
  zdSplitApplyHistory,
  zdSplitAssign,
  zdSplitChanged,
  zdSplitCounts,
  zdSplitDraftFrom,
  zdSplitRangeSelect,
  zdSplitShortName,
  zdSplitVisible,
} from "@/lib/orders/zd-shared-scope-split";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";

function product(
  tw: number,
  patch: Partial<ZdSharedScopeProduct> = {}
): ZdSharedScopeProduct {
  return {
    subiektTwId: tw,
    twSymbol: `SYM-${tw}`,
    twNazwa: `Wiertło diamentowe ${tw}`,
    orderCountBySupplier: {},
    suggestedSupplierId: null,
    assignedSupplierId: null,
    lastOrderAt: null,
    ...patch,
  };
}

const products = [
  product(1, { suggestedSupplierId: A, orderCountBySupplier: { [A]: 3 } }),
  product(2, { suggestedSupplierId: B, assignedSupplierId: B, orderCountBySupplier: { [B]: 1 } }),
  product(3, { twNazwa: "Frez węglikowy" }),
  product(4, { suggestedSupplierId: A, assignedSupplierId: B }),
];

describe("zd-shared-scope-split", () => {
  it("szkic startuje z zapisanych przypisań, zmiany to tylko różnice", () => {
    const draft = zdSplitDraftFrom(products);
    expect(draft).toEqual({ 1: "", 2: B, 3: "", 4: B });
    expect(zdSplitChanged(products, draft)).toEqual([]);
    const next = zdSplitAssign(draft, [1, 2], B);
    expect(zdSplitChanged(products, next).map((p) => p.subiektTwId)).toEqual([1]);
  });

  it("filtry: bez przypisania, niezgodne z historią, dostawca, fraza", () => {
    const draft = zdSplitDraftFrom(products);
    const ids = (f: Parameters<typeof zdSplitVisible>[2], q = "") =>
      zdSplitVisible(products, draft, f, q).map((p) => p.subiektTwId);
    expect(ids({ kind: "unassigned" })).toEqual([1, 3]);
    expect(ids({ kind: "conflict" })).toEqual([1, 4]);
    expect(ids({ kind: "supplier", supplierId: B })).toEqual([2, 4]);
    expect(ids({ kind: "all" }, "frez")).toEqual([3]);
    expect(ids({ kind: "all" }, "sym-2")).toEqual([2]);
  });

  it("historia ZD nadpisuje tylko towary z podpowiedzią i tylko zaznaczone", () => {
    const draft = zdSplitDraftFrom(products);
    expect(zdSplitApplyHistory(draft, products)).toEqual({ 1: A, 2: B, 3: "", 4: A });
    expect(zdSplitApplyHistory(draft, products, new Set([4]))).toEqual({ 1: "", 2: B, 3: "", 4: A });
  });

  it("liczniki per dostawca", () => {
    const counts = zdSplitCounts(products, zdSplitDraftFrom(products));
    expect(counts.get("")).toBe(2);
    expect(counts.get(B)).toBe(2);
  });

  it("Shift+klik zaznacza i odznacza zakres w obu kierunkach", () => {
    const order = [10, 20, 30, 40, 50];
    expect([...zdSplitRangeSelect(order, new Set(), 20, 40, true)].sort()).toEqual([20, 30, 40]);
    expect([...zdSplitRangeSelect(order, new Set(order), 50, 30, false)].sort()).toEqual([10, 20]);
    expect([...zdSplitRangeSelect(order, new Set(), 99, 30, true)]).toEqual([30]);
    expect([...zdSplitRangeSelect(order, new Set(), null, 10, true)]).toEqual([10]);
  });

  it("krótka nazwa: bez formy prawnej, całe słowa, bez wielokropka", () => {
    expect(zdSplitShortName("Ivoclar Vivadent Sp. z o.o.")).toBe("Ivoclar Vivadent");
    expect(zdSplitShortName("Dentsply Sirona Polska S.A.")).toBe("Dentsply Sirona");
    expect(zdSplitShortName("Komet")).toBe("Komet");
    expect(zdSplitShortName("Hager & Meisinger GmbH")).toBe("Hager & Meisinger");
    expect(zdSplitShortName("Hager & Meisingerowie Dental")).toBe("Hager");
    expect(zdSplitShortName("Superlongsuppliername International")).toBe("Superlongsuppliername");
  });
});
