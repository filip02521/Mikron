import { describe, expect, it } from "vitest";
import type { ZdSharedScopeProduct } from "@/lib/data/zd-scope-order";
import {
  zdSplitApplyHistory,
  zdSplitAlignablePairs,
  zdSplitAlignPairs,
  zdSplitAssign,
  zdSplitHistoryFillCount,
  zdSplitImpact,
  zdSplitPairMismatch,
  zdSplitPairMismatchCount,
  zdSplitSorted,
  zdSplitChanged,
  zdSplitCounts,
  zdSplitDraftFrom,
  zdSplitRangeSelect,
  zdSplitShortName,
  zdSplitShortNames,
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
    assignedAt: null,
    assignedBy: null,
    pair: null,
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
    const ctx = { byTw: new Map(products.map((p) => [p.subiektTwId, p])), scopeSupplierIds: [A] };
    const ids = (f: Parameters<typeof zdSplitVisible>[2], q = "") =>
      zdSplitVisible(products, draft, f, q, ctx).map((p) => p.subiektTwId);
    expect(ids({ kind: "unassigned" })).toEqual([1, 3]);
    expect(ids({ kind: "conflict" })).toEqual([1, 4]);
    expect(ids({ kind: "supplier", supplierId: B })).toEqual([2, 4]);
    expect(ids({ kind: "all" }, "frez")).toEqual([3]);
    expect(ids({ kind: "outside" })).toEqual([2, 4]);
    expect(ids({ kind: "all" }, "sym-2")).toEqual([2]);
  });

  it("historia ZD nadpisuje tylko towary z podpowiedzią i tylko zaznaczone", () => {
    const draft = zdSplitDraftFrom(products);
    expect(zdSplitApplyHistory(draft, products)).toEqual({ 1: A, 2: B, 3: "", 4: A });
    expect(zdSplitApplyHistory(draft, products, new Set([4]))).toEqual({ 1: "", 2: B, 3: "", 4: A });
    // „Dla wszystkich” nie nadpisuje zapisanych decyzji (4 zostaje u B).
    expect(zdSplitApplyHistory({}, products, undefined, { onlyUnassigned: true })).toEqual({ 1: A });
    expect(zdSplitHistoryFillCount(products, {})).toBe(1);
    // Jawne zdjęcie zapisanego przypisania (2: B → "") nie jest nadpisywane historią.
    expect(zdSplitApplyHistory({ 2: "" }, products, undefined, { onlyUnassigned: true })).toEqual({ 1: A, 2: "" });
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
    expect(zdSplitShortName("Dental Med sp. z o.o. sp.k.")).toBe("Dental Med");
    expect(zdSplitShortName("Komet GmbH")).toBe("Komet");
    expect(zdSplitShortName("Hager & Meisinger GmbH")).toBe("Hager & Meisinger");
    expect(zdSplitShortName("Hager & Meisingerowie Dental")).toBe("Hager");
    expect(zdSplitShortName("Superlongsuppliername International")).toBe("Superlongsuppliername");
  });

  it("sortowanie: liczba ZD i ostatnie ZD, remis po symbolu", () => {
    const list = [
      product(1, { twSymbol: "B", orderCountBySupplier: { [A]: 1 }, lastOrderAt: "2026-05-01T00:00:00Z" }),
      product(2, { twSymbol: "A", orderCountBySupplier: { [A]: 2, [B]: 3 }, lastOrderAt: "2026-01-01T00:00:00Z" }),
      product(3, { twSymbol: "C" }),
    ];
    expect(zdSplitSorted(list, "symbol").map((p) => p.subiektTwId)).toEqual([2, 1, 3]);
    expect(zdSplitSorted(list, "orders").map((p) => p.subiektTwId)).toEqual([2, 1, 3]);
    expect(zdSplitSorted(list, "recent").map((p) => p.subiektTwId)).toEqual([1, 2, 3]);
  });

  it("skutek zapisu: tylko zmienione liczniki", () => {
    const draft = zdSplitAssign(zdSplitDraftFrom(products), [1, 3], A);
    expect(zdSplitImpact(products, draft)).toEqual([
      { value: "", before: 2, after: 0 },
      { value: A, before: 0, after: 2 },
    ]);
    expect(zdSplitImpact(products, zdSplitDraftFrom(products))).toEqual([]);
  });

  it("pary: niespójny wybór i wyrównanie sztuki do paczki", () => {
    const pack = product(10, { pair: { role: "pack", otherTwId: 11, otherSymbol: "S-11", otherAssignedSupplierId: null } });
    const piece = product(11, { pair: { role: "piece", otherTwId: 10, otherSymbol: "S-10", otherAssignedSupplierId: null } });
    const lone = product(12, {
      assignedSupplierId: A,
      pair: { role: "pack", otherTwId: 99, otherSymbol: "S-99", otherAssignedSupplierId: B },
    });
    const list = [pack, piece, lone];
    const byTw = new Map(list.map((p) => [p.subiektTwId, p]));
    let draft: Record<number, string> = {};
    expect(zdSplitPairMismatch(pack, draft, byTw)).toBe(false);
    draft = zdSplitAssign(draft, [10], A);
    expect(zdSplitPairMismatch(pack, draft, byTw)).toBe(true);
    expect(zdSplitPairMismatch(piece, draft, byTw)).toBe(true);
    // Druga strona spoza listy — porównanie z zapisanym przypisaniem.
    expect(zdSplitPairMismatch(lone, draft, byTw)).toBe(true);
    const ctx = { byTw, scopeSupplierIds: [A, B] };
    expect(zdSplitVisible(list, draft, { kind: "pair" }, "", ctx).map((p) => p.subiektTwId)).toEqual([10, 11, 12]);
    // Para 10/11 liczona raz, 12 z drugą stroną spoza listy osobno; wyrównać da się tylko 10/11.
    expect(zdSplitPairMismatchCount(list, draft, byTw)).toBe(2);
    expect(zdSplitAlignablePairs(list, draft, byTw, [A, B])).toBe(1);
    const aligned = zdSplitAlignPairs(list, draft, byTw, [A, B]);
    expect(aligned[11]).toBe(A);
    expect(zdSplitPairMismatch(piece, aligned, byTw)).toBe(false);
    expect(aligned[99]).toBeUndefined();
  });

  it("wyrównanie: paczka bez przypisania przejmuje dostawcę sztuk, nie kasuje go", () => {
    const pack = product(20, { pair: { role: "pack", otherTwId: 21, otherSymbol: null, otherAssignedSupplierId: B } });
    const piece = product(21, {
      assignedSupplierId: B,
      pair: { role: "piece", otherTwId: 20, otherSymbol: null, otherAssignedSupplierId: null },
    });
    const list = [pack, piece];
    const byTw = new Map(list.map((p) => [p.subiektTwId, p]));
    const aligned = zdSplitAlignPairs(list, {}, byTw, [A, B]);
    expect(aligned).toEqual({ 20: B });
  });

  it("wyrównanie pomija dostawcę spoza zakresu (serwer by go odrzucił)", () => {
    const C = "cccccccc-0000-0000-0000-000000000003";
    const pack = product(30, {
      assignedSupplierId: C,
      pair: { role: "pack", otherTwId: 31, otherSymbol: null, otherAssignedSupplierId: null },
    });
    const piece = product(31, { pair: { role: "piece", otherTwId: 30, otherSymbol: null, otherAssignedSupplierId: C } });
    const list = [pack, piece];
    const byTw = new Map(list.map((p) => [p.subiektTwId, p]));
    expect(zdSplitAlignPairs(list, {}, byTw, [A, B])).toEqual({});
    expect(zdSplitAlignablePairs(list, {}, byTw, [A, B])).toBe(0);
  });

  it("krótkie nazwy: kolizja skrótu daje pełne nazwy", () => {
    expect(
      zdSplitShortNames(["Dentsply Sirona Polska Sp. z o.o.", "Dentsply Sirona Deutschland GmbH", "Komet"])
    ).toEqual(["Dentsply Sirona Polska Sp. z o.o.", "Dentsply Sirona Deutschland GmbH", "Komet"]);
  });
});
