import { describe, expect, it } from "vitest";
import {
  filterMyOrderRowsByClientKh,
  filterMyOrderRowsBySearch,
  myOrderRowSearchText,
  resolveSingleMyOrderSearchScrollTarget,
  rowMatchesSearchQuery,
  rowSearchHighlightsProductLines,
  rowSearchMatchesProductHeader,
  rowSearchMatchesSupplierOnly,
  shouldAutoExpandOrderLinesForSearch,
} from "./my-order-search";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { createTestMyOrderLine, createTestMyOrderRow } from "./test-fixtures";

function row(partial: Partial<MyOrderRow>): MyOrderRow {
  return createTestMyOrderRow({
    supplierName: "Straumann",
    product: "Implant TLX",
    symbol: "STR-001",
    clientLabel: "Klinika Alfa",
    ...partial,
  });
}

describe("rowMatchesSearchQuery", () => {
  it("pasuje po dostawcy", () => {
    expect(rowMatchesSearchQuery(row({}), "straumann")).toBe(true);
  });

  it("pasuje po produkcie", () => {
    expect(rowMatchesSearchQuery(row({}), "implant")).toBe(true);
  });

  it("pasuje po kliencie z etykiety grupy", () => {
    expect(rowMatchesSearchQuery(row({}), "alfa")).toBe(true);
  });

  it("pasuje po kliencie z linii", () => {
    const r = row({
      clientLabel: null,
      lines: [
        createTestMyOrderLine({
          id: "l1",
          product: "X",
          clientName: "Dr Kowalski",
          clientKhId: null,
        }),
      ],
    });
    expect(rowMatchesSearchQuery(r, "kowalski")).toBe(true);
  });

  it("pasuje po symbolu i kodzie Mikran", () => {
    const r = row({
      symbol: null,
      lines: [
        createTestMyOrderLine({
          id: "l1",
          product: "Y",
          symbol: "ABC",
          mikranCode: "M123",
          clientKhId: null,
          clientName: null,
        }),
      ],
    });
    expect(rowMatchesSearchQuery(r, "abc")).toBe(true);
    expect(rowMatchesSearchQuery(r, "m123")).toBe(true);
  });

  it("nie pasuje przy pustym zapytaniu zawsze true", () => {
    expect(rowMatchesSearchQuery(row({}), "")).toBe(true);
    expect(rowMatchesSearchQuery(row({}), "   ")).toBe(true);
  });

  it("ignoruje polskie znaki diakrytyczne", () => {
    expect(rowMatchesSearchQuery(row({ clientLabel: "Łódź Dent" }), "lodz")).toBe(true);
    expect(rowMatchesSearchQuery(row({ supplierName: "Straumann" }), "strausman")).toBe(false);
  });

  it("wymaga dopasowania każdego słowa zapytania", () => {
    expect(
      rowMatchesSearchQuery(row({ supplierName: "Alpha", product: "Implant" }), "alpha implant")
    ).toBe(true);
    expect(
      rowMatchesSearchQuery(row({ supplierName: "Alpha", product: "Implant" }), "alpha screw")
    ).toBe(false);
  });
});

describe("shouldAutoExpandOrderLinesForSearch", () => {
  it("nie rozwija przy trafieniu tylko w dostawcy", () => {
    const r = row({
      lines: [
        createTestMyOrderLine({
          id: "l1",
          product: "Implant",
          clientKhId: null,
          clientName: null,
        }),
      ],
    });
    expect(rowSearchMatchesSupplierOnly(r, "straumann")).toBe(true);
    expect(shouldAutoExpandOrderLinesForSearch(r, "straumann")).toBe(false);
  });

  it("rozwija przy trafieniu w nagłówku towaru", () => {
    const r = row({
      product: "Implant grupowy",
      lines: [
        createTestMyOrderLine({
          id: "l1",
          product: "Inny",
          clientKhId: null,
          clientName: null,
        }),
      ],
    });
    expect(rowSearchMatchesProductHeader(r, "implant")).toBe(true);
    expect(shouldAutoExpandOrderLinesForSearch(r, "implant")).toBe(true);
  });

  it("rozwija pojedynczą pozycję gdy zapytanie pasuje do wiersza", () => {
    const r = row({
      product: "Implant TLX",
      lines: [
        createTestMyOrderLine({
          id: "l1",
          product: "Implant TLX",
          clientKhId: null,
          clientName: null,
        }),
      ],
    });
    expect(shouldAutoExpandOrderLinesForSearch(r, "tlx")).toBe(true);
  });
});

describe("rowSearchHighlightsProductLines", () => {
  it("wykrywa trafienie w linii produktu", () => {
    const r = row({
      product: "Grupa",
      lines: [
        createTestMyOrderLine({
          id: "l1",
          product: "Implant tytanowy",
          clientKhId: null,
          clientName: null,
        }),
      ],
    });
    expect(rowSearchHighlightsProductLines(r, "implant")).toBe(true);
    expect(rowSearchHighlightsProductLines(r, "straumann")).toBe(false);
    expect(shouldAutoExpandOrderLinesForSearch(r, "implant")).toBe(true);
  });
});

describe("filterMyOrderRowsBySearch", () => {
  it("zwraca podzbiór wierszy", () => {
    const rows = [
      row({ id: "a", supplierName: "A" }),
      row({ id: "b", supplierName: "B" }),
    ];
    expect(filterMyOrderRowsBySearch(rows, "b").map((r) => r.id)).toEqual(["b"]);
  });

  it("uwzględnia notatkę do zakupów", () => {
    const rows = [
      row({ id: "a", requestNote: "pilny termin piątek" }),
      row({ id: "b", requestNote: null }),
    ];
    expect(filterMyOrderRowsBySearch(rows, "piątek").map((r) => r.id)).toEqual(["a"]);
  });

  it("uwzględnia wiadomość od zakupów przy anulowaniu", () => {
    const rows = [
      row({ id: "a", procurementCancelNote: "brak towaru u dostawcy" }),
      row({ id: "b", procurementCancelNote: null }),
    ];
    expect(filterMyOrderRowsBySearch(rows, "dostawcy").map((r) => r.id)).toEqual(["a"]);
  });
});

describe("filterMyOrderRowsByClientKh", () => {
  it("filtruje wiersze po kh_Id klienta na pozycji", () => {
    const rows = [
      row({
        id: "a",
        lines: [
          createTestMyOrderLine({
            id: "l1",
            product: "P",
            clientName: "Alfa",
            clientKhId: 10,
          }),
        ],
      }),
      row({
        id: "b",
        lines: [
          createTestMyOrderLine({
            id: "l2",
            product: "Q",
            clientName: "Beta",
            clientKhId: 20,
          }),
        ],
      }),
    ];
    expect(filterMyOrderRowsByClientKh(rows, 10).map((r) => r.id)).toEqual(["a"]);
    expect(filterMyOrderRowsByClientKh(rows, null)).toEqual(rows);
  });

  it("łączy kh z etykietą klienta (link z ZK)", () => {
    const rows = [
      row({
        id: "a",
        lines: [
          createTestMyOrderLine({
            id: "l1",
            product: "P",
            clientName: "Klinika Smile",
            clientKhId: null,
          }),
        ],
      }),
    ];
    expect(
      filterMyOrderRowsByClientKh(rows, 42, { clientLabel: "Klinika Smile" }).map((r) => r.id)
    ).toEqual(["a"]);
  });
});

describe("myOrderRowSearchText", () => {
  it("łączy pola w jeden ciąg", () => {
    expect(myOrderRowSearchText(row({ supplierName: "X", product: "Y" }))).toContain("x");
    expect(myOrderRowSearchText(row({ supplierName: "X", product: "Y" }))).toContain("y");
  });

  it("indeksuje przyjazną etykietę statusu", () => {
    const text = myOrderRowSearchText(row({ statusTitle: "W dziale dostaw" }));
    expect(text).toContain("sprawdzamy twoja prosbe");
  });
});

describe("filterMyOrderRowsBySearch friendly status", () => {
  it("znajduje po przyjaznej etykiecie statusu", () => {
    const rows = [row({ id: "v", statusTitle: "W dziale dostaw", supplierName: "Acme" })];
    expect(filterMyOrderRowsBySearch(rows, "sprawdzamy").map((r) => r.id)).toEqual(["v"]);
  });
});

describe("resolveSingleMyOrderSearchScrollTarget", () => {
  it("zwraca jedyny aktywny wynik", () => {
    const active = [row({ id: "a1" }), row({ id: "a2" })];
    expect(
      resolveSingleMyOrderSearchScrollTarget({
        searchActive: true,
        searchTrimmed: "implant",
        searchMatchCount: 1,
        archiveMatchCount: 0,
        activeRows: [active[0]!],
        archiveRecentRows: [],
        archiveExtendedRows: [],
      })
    ).toEqual({
      rowId: "a1",
      kind: "active",
      scrollKey: "implant:active:a1",
    });
  });

  it("preferuje aktywną listę gdy jest dokładnie jeden wynik", () => {
    expect(
      resolveSingleMyOrderSearchScrollTarget({
        searchActive: true,
        searchTrimmed: "alfa",
        searchMatchCount: 1,
        archiveMatchCount: 3,
        activeRows: [row({ id: "live" })],
        archiveRecentRows: [row({ id: "arch" })],
        archiveExtendedRows: [],
      })?.rowId
    ).toBe("live");
  });

  it("zwraca jedyny wynik z archiwum", () => {
    expect(
      resolveSingleMyOrderSearchScrollTarget({
        searchActive: true,
        searchTrimmed: "stary",
        searchMatchCount: 0,
        archiveMatchCount: 1,
        activeRows: [],
        archiveRecentRows: [row({ id: "arch-1" })],
        archiveExtendedRows: [row({ id: "arch-1" })],
      })
    ).toEqual({
      rowId: "arch-1",
      kind: "archive",
      scrollKey: "stary:archive:arch-1",
    });
  });

  it("nie przewija przy wielu wynikach", () => {
    expect(
      resolveSingleMyOrderSearchScrollTarget({
        searchActive: true,
        searchTrimmed: "x",
        searchMatchCount: 2,
        archiveMatchCount: 0,
        activeRows: [row({ id: "a1" }), row({ id: "a2" })],
        archiveRecentRows: [],
        archiveExtendedRows: [],
      })
    ).toBeNull();
  });
});
