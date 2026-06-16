import { describe, expect, it } from "vitest";
import {
  filterMyOrderRowsByClientKh,
  filterMyOrderRowsBySearch,
  myOrderRowSearchText,
  rowMatchesSearchQuery,
  rowSearchHighlightsProductLines,
  rowSearchMatchesProductHeader,
  rowSearchMatchesSupplierOnly,
  shouldAutoExpandOrderLinesForSearch,
} from "./my-order-search";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

function row(partial: Partial<MyOrderRow>): MyOrderRow {
  return {
    id: "r1",
    kind: "zamowienie",
    lineCount: 1,
    lines: [],
    submittedLabel: "",
    supplierName: "Straumann",
    product: "Implant TLX",
    symbol: "STR-001",
    quantityLabel: "2",
    progressLabel: null,
    statusTitle: "Zamówione",
    statusDetail: null,
    timingLabel: null,
    badgeVariant: "info",
    rowColor: "",
    orderIds: ["o1"],
    acknowledgeMode: "none",
    pickupPendingCount: 0,
    pickupPendingIds: [],
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    canCancelBySales: false,
    salesCancelPhase: null,
    salesCancelOrderIds: [],
    cancelNoticeOrderIds: [],
    cancelledAckOrderIds: [],
    clientLabel: "Klinika Alfa",
    requestNote: null,
    procurementCancelNote: null,
    supplierId: "s1",
    salesPersonId: "sp1",
    requestKind: "zamowienie",
    canEditBySales: true,
    ...partial,
  };
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
        {
          id: "l1",
          product: "X",
          symbol: null,
          subiektTwId: null,
          mikranCode: null,
          quantity: "1",
          quantityLabel: "1",
          progressLabel: null,
          stockStatus: "waiting",
          canAcknowledgePickup: false,
          clientKhId: null,
          clientName: "Dr Kowalski",
        },
      ],
    });
    expect(rowMatchesSearchQuery(r, "kowalski")).toBe(true);
  });

  it("pasuje po symbolu i kodzie Mikran", () => {
    const r = row({
      symbol: null,
      lines: [
        {
          id: "l1",
          product: "Y",
          symbol: "ABC",
          subiektTwId: null,
          mikranCode: "M123",
          quantity: "1",
          quantityLabel: "1",
          progressLabel: null,
          stockStatus: "waiting",
          canAcknowledgePickup: false,
          clientKhId: null,
          clientName: null,
        },
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
        {
          id: "l1",
          product: "Implant",
          symbol: null,
          subiektTwId: null,
          mikranCode: null,
          quantity: "1",
          quantityLabel: "1",
          progressLabel: null,
          stockStatus: "waiting",
          canAcknowledgePickup: false,
          clientKhId: null,
          clientName: null,
        },
      ],
    });
    expect(rowSearchMatchesSupplierOnly(r, "straumann")).toBe(true);
    expect(shouldAutoExpandOrderLinesForSearch(r, "straumann")).toBe(false);
  });

  it("rozwija przy trafieniu w nagłówku towaru", () => {
    const r = row({
      product: "Implant grupowy",
      lines: [
        {
          id: "l1",
          product: "Inny",
          symbol: null,
          subiektTwId: null,
          mikranCode: null,
          quantity: "1",
          quantityLabel: "1",
          progressLabel: null,
          stockStatus: "waiting",
          canAcknowledgePickup: false,
          clientKhId: null,
          clientName: null,
        },
      ],
    });
    expect(rowSearchMatchesProductHeader(r, "implant")).toBe(true);
    expect(shouldAutoExpandOrderLinesForSearch(r, "implant")).toBe(true);
  });

  it("rozwija pojedynczą pozycję gdy zapytanie pasuje do wiersza", () => {
    const r = row({
      product: "Implant TLX",
      lines: [
        {
          id: "l1",
          product: "Implant TLX",
          symbol: null,
          subiektTwId: null,
          mikranCode: null,
          quantity: "1",
          quantityLabel: "1",
          progressLabel: null,
          stockStatus: "waiting",
          canAcknowledgePickup: false,
          clientKhId: null,
          clientName: null,
        },
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
        {
          id: "l1",
          product: "Implant tytanowy",
          symbol: null,
          subiektTwId: null,
          mikranCode: null,
          quantity: "1",
          quantityLabel: "1",
          progressLabel: null,
          stockStatus: "waiting",
          canAcknowledgePickup: false,
          clientKhId: null,
          clientName: null,
        },
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
          {
            id: "l1",
            product: "P",
            symbol: null,
            subiektTwId: null,
            mikranCode: null,
            quantity: "1",
            quantityLabel: "1",
            progressLabel: null,
            stockStatus: "waiting",
            canAcknowledgePickup: false,
            clientName: "Alfa",
            clientKhId: 10,
          },
        ],
      }),
      row({
        id: "b",
        lines: [
          {
            id: "l2",
            product: "Q",
            symbol: null,
            subiektTwId: null,
            mikranCode: null,
            quantity: "1",
            quantityLabel: "1",
            progressLabel: null,
            stockStatus: "waiting",
            canAcknowledgePickup: false,
            clientName: "Beta",
            clientKhId: 20,
          },
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
          {
            id: "l1",
            product: "P",
            symbol: null,
            subiektTwId: null,
            mikranCode: null,
            quantity: "1",
            quantityLabel: "1",
            progressLabel: null,
            stockStatus: "waiting",
            canAcknowledgePickup: false,
            clientName: "Klinika Smile",
            clientKhId: null,
          },
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
