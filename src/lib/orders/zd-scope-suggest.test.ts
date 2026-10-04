import { describe, expect, it } from "vitest";
import {
  buildZdScopeInsights,
  type ZdScopeName,
  type ZdScopeRef,
  type ZdSupplierProductRow,
} from "@/lib/orders/zd-scope-suggest";

const row = (
  supplierId: string,
  twId: number,
  grupaId: number | null,
  cechaIds: number[] = []
): ZdSupplierProductRow => ({ supplierId, twId, grupaId, cechaIds });

const names = new Map<string, ZdScopeName>([
  ["grupa:1", { name: "Grupa A", productCount: 500 }],
  ["grupa:2", { name: "Grupa B", productCount: 40 }],
  ["cecha:10", { name: "Cecha X", productCount: 30 }],
]);

describe("buildZdScopeInsights", () => {
  it("bez zakresu: cecha z samymi towarami dostawcy wygrywa z szeroką grupą", () => {
    const rows = [
      row("s1", 1, 1, [10]),
      row("s1", 2, 1, [10]),
      row("s1", 3, 1, [10]),
      // Grupa A to głównie towary innego dostawcy.
      row("s2", 4, 1),
      row("s2", 5, 1),
      row("s2", 6, 1),
      row("s2", 7, 1),
    ];
    const res = buildZdScopeInsights({ rows, currentScopes: new Map(), names });
    const s1 = res.get("s1")!;
    expect(s1).toEqual(
      expect.objectContaining({ totalProducts: 3, coveredProducts: 0 })
    );
    expect(s1.suggestions[0]).toEqual(
      expect.objectContaining({
        mode: "cecha",
        id: 10,
        name: "Cecha X",
        newHits: 3,
        purity: 1,
        otherSupplierCount: 0,
      })
    );
    // Grupa A: 3 z 7 towarów z ZD → czystość 0,43 — w podpowiedziach, ale niżej.
    expect(s1.suggestions[1]).toEqual(
      expect.objectContaining({ mode: "grupa", id: 1, otherSupplierCount: 1 })
    );
  });

  it("z zakresem: pokrycie i podpowiedź tylko dla brakujących towarów", () => {
    const rows = [
      row("s1", 1, 1),
      row("s1", 2, 1),
      row("s1", 3, 2),
      row("s1", 4, 2),
    ];
    const currentScopes = new Map<string, ZdScopeRef[]>([["s1", [{ mode: "grupa", id: 1 }]]]);
    const s1 = buildZdScopeInsights({ rows, currentScopes, names }).get("s1")!;
    expect(s1.coveredProducts).toBe(2);
    expect(s1.suggestions.map((s) => [s.mode, s.id, s.newHits])).toEqual([["grupa", 2, 2]]);
  });

  it("zakres zdominowany przez innych dostawców nie jest podpowiadany", () => {
    const rows = [
      row("s1", 1, 1),
      row("s2", 2, 1),
      row("s2", 3, 1),
      row("s2", 4, 1),
      row("s2", 5, 1),
    ];
    const s1 = buildZdScopeInsights({ rows, currentScopes: new Map(), names }).get("s1")!;
    expect(s1.suggestions).toEqual([]);
  });

  it("dostawca z zakresem, ale bez historii ZD - widoczny z zerowym pokryciem", () => {
    const res = buildZdScopeInsights({
      rows: [],
      currentScopes: new Map([["s9", [{ mode: "cecha", id: 10 }]]]),
      names,
    });
    expect(res.get("s9")).toEqual({
      supplierId: "s9",
      totalProducts: 0,
      coveredProducts: 0,
      currentScopeHits: [{ mode: "cecha", id: 10, hits: 0 }],
      suggestions: [],
    });
  });
});

describe("buildZdScopeInsights - błędne mapowanie", () => {
  it("zakres bez żadnego towaru z ZD dostawcy ma 0 trafień (np. Polkard BIS na cesze Polkard)", () => {
    const rows = [
      row("polkard", 1, null, [2717]),
      row("polkard", 2, null, [2717]),
      row("bis", 3, null, [2718]),
      row("bis", 4, null, [2718]),
    ];
    const currentScopes = new Map<string, ZdScopeRef[]>([
      ["polkard", [{ mode: "cecha", id: 2717 }]],
      ["bis", [{ mode: "cecha", id: 2717 }]],
    ]);
    const bis = buildZdScopeInsights({ rows, currentScopes, names }).get("bis")!;
    expect(bis.currentScopeHits).toEqual([{ mode: "cecha", id: 2717, hits: 0 }]);
    expect(bis.suggestions[0]).toEqual(expect.objectContaining({ mode: "cecha", id: 2718, newHits: 2 }));
  });
});
