import { describe, expect, it } from "vitest";
import {
  assertNoInformacjaDuplicatesInList,
  findInformacjaDuplicate,
  formatInformacjaDuplicateMessage,
  informacjaClientsMatch,
  informacjaProductsMatch,
  isActiveInformacjaOrder,
} from "./informacja-duplicate";

describe("informacja-duplicate", () => {
  it("dopasowuje produkty po subiekt_tw_id", () => {
    expect(
      informacjaProductsMatch(
        { subiektTwId: 42, symbol: "A", product: "Inna nazwa" },
        { subiektTwId: 42, symbol: "B", product: "Nazwa" }
      )
    ).toBe(true);
  });

  it("dopasowuje produkty po symbolu i kodzie Mikran", () => {
    expect(informacjaProductsMatch({ symbol: "SYM-1" }, { symbol: "sym-1" })).toBe(true);
    expect(informacjaProductsMatch({ mikranCode: "896" }, { mikranCode: "896" })).toBe(true);
  });

  it("nie myli różnych produktów", () => {
    expect(
      informacjaProductsMatch(
        { symbol: "SYM-1", product: "Implant A" },
        { symbol: "SYM-2", product: "Implant B" }
      )
    ).toBe(false);
  });

  it("traktuje brak klienta jako ten sam kontekst", () => {
    expect(informacjaClientsMatch({}, {})).toBe(true);
    expect(
      informacjaClientsMatch(
        { clientName: "Klinika Smile", clientKhId: 10 },
        { clientName: "Klinika Smile", clientKhId: 10 }
      )
    ).toBe(true);
    expect(
      informacjaClientsMatch(
        { clientName: "Klinika Smile", clientKhId: 10 },
        { clientName: "Gabinet Dr Kowalski", clientKhId: 20 }
      )
    ).toBe(false);
  });

  it("rozpoznaje aktywną prośbę informacyjną", () => {
    expect(
      isActiveInformacjaOrder({
        request_kind: "informacja",
        status: "Nowe",
        sales_acknowledged_at: null,
        sales_cancelled_at: null,
        informacja_stock_out_reorder: false,
      })
    ).toBe(true);
    expect(
      isActiveInformacjaOrder({
        request_kind: "informacja",
        status: "Zrealizowane",
        sales_acknowledged_at: null,
        sales_cancelled_at: null,
        informacja_stock_out_reorder: false,
      })
    ).toBe(true);
    expect(
      isActiveInformacjaOrder({
        request_kind: "informacja",
        status: "Zrealizowane",
        sales_acknowledged_at: "2026-01-01T00:00:00Z",
        sales_cancelled_at: null,
        informacja_stock_out_reorder: false,
      })
    ).toBe(false);
    expect(
      isActiveInformacjaOrder({
        request_kind: "informacja",
        status: "Anulowane",
        sales_acknowledged_at: null,
        sales_cancelled_at: null,
        informacja_stock_out_reorder: false,
      })
    ).toBe(false);
  });

  it("dopasowuje produkty po subiekt_tw_id nawet gdy druga strona ma tylko symbol", () => {
    expect(
      informacjaProductsMatch(
        { subiektTwId: 42, symbol: null, product: "Nazwa A" },
        { subiektTwId: null, symbol: "SYM-42", product: "Nazwa B" }
      )
    ).toBe(false);

    expect(
      informacjaProductsMatch(
        { subiektTwId: 42, symbol: "SYM-42", product: "Nazwa A" },
        { subiektTwId: 42, symbol: null, product: "Nazwa B" }
      )
    ).toBe(true);
  });

  it("znajduje duplikat dla tego samego klienta i produktu", () => {
    const existing = [
      {
        id: "o1",
        salesPersonId: "sp1",
        clientName: "Klinika Smile",
        clientKhId: 10,
        subiektTwId: 99,
        symbol: "SYM-1",
        product: "Implant",
        status: "Nowe",
        request_kind: "informacja",
        sales_acknowledged_at: null,
        sales_cancelled_at: null,
        informacja_stock_out_reorder: false,
      },
    ];

    const duplicate = findInformacjaDuplicate(
      {
        salesPersonId: "sp1",
        clientName: "Klinika Smile",
        clientKhId: 10,
        subiektTwId: 99,
        symbol: "SYM-1",
        product: "Implant",
      },
      existing
    );

    expect(duplicate?.id).toBe("o1");
  });

  it("nie traktuje tego samego produktu dla innego klienta jako duplikat", () => {
    const existing = [
      {
        id: "o1",
        salesPersonId: "sp1",
        clientName: "Klinika Smile",
        clientKhId: 10,
        subiektTwId: 99,
        symbol: "SYM-1",
        product: "Implant",
        status: "Nowe",
        request_kind: "informacja",
        sales_acknowledged_at: null,
        sales_cancelled_at: null,
        informacja_stock_out_reorder: false,
      },
    ];

    expect(
      findInformacjaDuplicate(
        {
          salesPersonId: "sp1",
          clientName: "Gabinet Dr Kowalski",
          clientKhId: 20,
          subiektTwId: 99,
          symbol: "SYM-1",
          product: "Implant",
        },
        existing
      )
    ).toBeNull();
  });

  it("blokuje duplikat w tej samej paczce", () => {
    expect(() =>
      assertNoInformacjaDuplicatesInList(
        [
          {
            salesPersonId: "sp1",
            clientName: "Klinika Smile",
            subiektTwId: 5,
            product: "Implant",
          },
          {
            salesPersonId: "sp1",
            clientName: "Klinika Smile",
            subiektTwId: 5,
            product: "Implant",
          },
        ],
        []
      )
    ).toThrow(/w tej samej prośbie/i);
  });

  it("pozwala edytować istniejącą pozycję bez fałszywego duplikatu", () => {
    expect(() =>
      assertNoInformacjaDuplicatesInList(
        [
          {
            salesPersonId: "sp1",
            clientName: "Klinika Smile",
            subiektTwId: 5,
            product: "Implant",
          },
        ],
        [
          {
            id: "o1",
            salesPersonId: "sp1",
            clientName: "Klinika Smile",
            subiektTwId: 5,
            product: "Implant",
            status: "Nowe",
            request_kind: "informacja",
            sales_acknowledged_at: null,
            sales_cancelled_at: null,
            informacja_stock_out_reorder: false,
          },
        ],
        { excludeIds: ["o1"] }
      )
    ).not.toThrow();
  });

  it("formatuje komunikat z klientem", () => {
    expect(
      formatInformacjaDuplicateMessage({
        clientName: "Klinika Smile",
        symbol: "SYM-1",
        product: "Implant",
      })
    ).toContain("już istnieje");
    expect(
      formatInformacjaDuplicateMessage({
        symbol: "SYM-1",
        product: "Implant",
      })
    ).toContain("SYM-1 — Implant");
  });
});
