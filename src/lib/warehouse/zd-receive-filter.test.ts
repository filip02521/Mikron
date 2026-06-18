import { describe, expect, it } from "vitest";
import type { IndividualOrder } from "@/types/database";
import type { SubiektDocument } from "@/lib/subiekt/types";
import {
  buildZdMatchProfileFromDocument,
  countZdMatches,
  filterReceiveQueueBySupplierAndZd,
  matchOrderToZdProfile,
  resolveSupplierForZdDocument,
  zdFilterUnmatchedLinesLabel,
} from "./zd-receive-filter";

function order(
  partial: Partial<IndividualOrder> & Pick<IndividualOrder, "id">
): IndividualOrder {
  return {
    supplier_id: "s1",
    sales_person_id: "p1",
    symbol: "SYM-A",
    products: "Produkt",
    quantity: "1",
    delivered_quantity: "-",
    order_type: "Glowne",
    status: "Zamowione",
    action_at: "2026-01-01",
    delivery_at: null,
    ordered_at: null,
    request_kind: "zamowienie",
    ...partial,
  } as IndividualOrder;
}

const sampleDoc: SubiektDocument = {
  dok_Id: 42,
  dok_NrPelny: "ZD/123/2026",
  dok_Pozycja: [
    { ob_TowId: 100, tw_Symbol: "IV-A", tw_Nazwa: "Ivoclar A" },
    { ob_TowId: 200, tw_Symbol: "IV-B", tw_Nazwa: "Ivoclar B" },
  ],
};

describe("matchOrderToZdProfile", () => {
  const profile = buildZdMatchProfileFromDocument(sampleDoc);

  it("dopasowuje po subiekt_tw_id (priorytet)", () => {
    expect(
      matchOrderToZdProfile(order({ id: "1", subiekt_tw_id: 100, symbol: "INNY" }), profile)
    ).toBe(true);
  });

  it("dopasowuje po symbolu (fallback, bez rozróżniania wielkości liter)", () => {
    expect(
      matchOrderToZdProfile(order({ id: "2", subiekt_tw_id: null, symbol: "iv-b" }), profile)
    ).toBe(true);
  });

  it("nie dopasowuje gdy brak tw_Id i symbolu", () => {
    expect(
      matchOrderToZdProfile(order({ id: "3", subiekt_tw_id: null, symbol: "BRAK" }), profile)
    ).toBe(false);
  });

  it("ignoruje pusty symbol „-”", () => {
    expect(
      matchOrderToZdProfile(order({ id: "4", subiekt_tw_id: null, symbol: "-" }), profile)
    ).toBe(false);
  });
});

describe("buildZdMatchProfileFromDocument", () => {
  it("zbiera unikalne tw_Id i symbole z linii", () => {
    const profile = buildZdMatchProfileFromDocument(sampleDoc);
    expect(profile.docNumber).toBe("ZD/123/2026");
    expect(profile.lineCount).toBe(2);
    expect(profile.twIds).toEqual([100, 200]);
    expect(profile.symbols).toEqual(["iv-a", "iv-b"]);
  });
});

describe("filterReceiveQueueBySupplierAndZd", () => {
  const ivoclar = { id: "s1", name: "Ivoclar" } as never;
  const other = { id: "s2", name: "Inny" } as never;
  const profile = buildZdMatchProfileFromDocument(sampleDoc);

  const rows = [
    order({
      id: "m1",
      supplier: ivoclar,
      subiekt_tw_id: 100,
    }),
    order({
      id: "m2",
      supplier: ivoclar,
      symbol: "IV-B",
      subiekt_tw_id: null,
    }),
    order({
      id: "m3",
      supplier: ivoclar,
      symbol: "X",
      subiekt_tw_id: null,
    }),
    order({
      id: "o1",
      supplier: other,
      subiekt_tw_id: 100,
    }),
  ];

  it("łączy filtr dostawcy i ZD (AND)", () => {
    const result = filterReceiveQueueBySupplierAndZd(rows, "Ivoclar", profile);
    expect(result.map((r) => r.id)).toEqual(["m1", "m2"]);
  });

  it("bez filtra ZD zwraca tylko wynik dostawcy", () => {
    const result = filterReceiveQueueBySupplierAndZd(rows, "Ivoclar", null);
    expect(result).toHaveLength(3);
  });

  it("liczy dopasowania w kolejce", () => {
    expect(countZdMatches(rows, profile)).toBe(3);
  });
});

describe("zdFilterUnmatchedLinesLabel", () => {
  it("zwraca null dla zera", () => {
    expect(zdFilterUnmatchedLinesLabel(0)).toBeNull();
  });

  it("formatuje liczbę linii bez dopasowania", () => {
    expect(zdFilterUnmatchedLinesLabel(1)).toContain("1 linia ZD");
    expect(zdFilterUnmatchedLinesLabel(4)).toContain("4 linii ZD");
  });
});

describe("resolveSupplierForZdDocument", () => {
  const suppliers = [
    { id: "s1", name: "Ivoclar", subiektKhId: 688 },
    { id: "s2", name: "Inny", subiektKhId: 999 },
  ] as const;

  it("preferuje supplier_id z indeksu ZD", () => {
    const doc = { dok_Id: 1, dok_OdbiorcaId: 999 } as const;
    expect(resolveSupplierForZdDocument(doc, [...suppliers], "s1")?.id).toBe("s1");
  });

  it("dopasowuje dostawcę po kh_Id z dokumentu", () => {
    const doc = { dok_Id: 1, dok_OdbiorcaId: 688 } as const;
    expect(resolveSupplierForZdDocument(doc, [...suppliers], null)?.name).toBe("Ivoclar");
  });
});
