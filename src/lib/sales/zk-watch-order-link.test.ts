import { describe, expect, it } from "vitest";
import {
  clientsMatchForZk,
  computeZkWatchOrderHints,
  filterZkWatchesByClientQuery,
  isOrderRelevantToZkWatch,
  isZkLineFullyDeliveredByOrders,
  mergeZkLineChecksFromDeliveredOrders,
  productMatchesZkLine,
  resolveZkWatchIdsForOrderSync,
  type ZkLinkableOrder,
} from "./zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";

function linkOrder(
  partial: Partial<ZkLinkableOrder> & Pick<ZkLinkableOrder, "id">
): ZkLinkableOrder {
  return {
    sales_person_id: "sp1",
    sales_client_kh_id: 42,
    sales_client_name: "Klinika Smile",
    source_zk_watch_id: null,
    source_zk_number: null,
    subiekt_tw_id: 100,
    symbol: "ABC",
    products: "Implant X",
    mikran_code: null,
    quantity: "2",
    delivered_quantity: "2",
    status: "Zamowione",
    request_kind: "zamowienie",
    sales_acknowledged_at: null,
    sales_cancelled_at: null,
    ...partial,
  };
}

function watch(partial: Partial<SalesZkWatch> & Pick<SalesZkWatch, "id">): SalesZkWatch {
  return {
    sales_person_id: "sp1",
    subiekt_dok_id: 1,
    zk_number: "ZK/1",
    client_label: "Klinika Smile",
    client_kh_id: 42,
    amount_net: null,
    amount_gross: null,
    zk_issued_at: null,
    note: null,
    line_summary: null,
    subiekt_snapshot: {
      dok_Pozycja: [
        {
          ob_Id: 1,
          ob_TowId: 100,
          tw_Symbol: "ABC",
          tw_Nazwa: "Implant X",
          ob_Ilosc: 2,
        },
      ],
    },
    line_checks: [],
    follow_up_at: null,
    closed_at: null,
    archived_at: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...partial,
  };
}

describe("clientsMatchForZk", () => {
  it("dopasowuje po kh_Id", () => {
    expect(
      clientsMatchForZk(
        watch({ id: "w1", client_kh_id: 42, client_label: "A" }),
        { sales_client_kh_id: 42, sales_client_name: "Inna nazwa" }
      )
    ).toBe(true);
  });

  it("dopasowuje po nazwie gdy brak kh", () => {
    expect(
      clientsMatchForZk(
        watch({ id: "w1", client_kh_id: null, client_label: "Klinika Smile" }),
        { sales_client_kh_id: null, sales_client_name: "klinika smile" }
      )
    ).toBe(true);
  });

  it("nie dopasowuje po zawieraniu gdy ZK ma kh a prośba nie", () => {
    expect(
      clientsMatchForZk(
        watch({ id: "w1", client_kh_id: 42, client_label: "Klinika Smile" }),
        { sales_client_kh_id: null, sales_client_name: "Klinika Smile Extra" }
      )
    ).toBe(false);
  });

  it("dopasowuje po dokładnej nazwie gdy tylko ZK ma kh", () => {
    expect(
      clientsMatchForZk(
        watch({ id: "w1", client_kh_id: 42, client_label: "Klinika Smile" }),
        { sales_client_kh_id: null, sales_client_name: "klinika smile" }
      )
    ).toBe(true);
  });
});

describe("productMatchesZkLine + merge checks", () => {
  it("nie auto-odhacza po dostawie prośby (odbiór = Moje)", () => {
    const w = watch({ id: "w1" });
    const line = {
      key: "ob:1",
      product: "Implant X",
      symbol: "ABC",
      quantityLabel: "2 szt.",
      quantity: 2,
      subiektTwId: 100,
      arrived: false,
    };
    expect(
      productMatchesZkLine(
        linkOrder({ id: "o1", status: "Zrealizowane", quantity: "2", delivered_quantity: "2" }),
        line
      )
    ).toBe(true);

    expect(
      productMatchesZkLine(
        linkOrder({
          id: "o2",
          status: "Zrealizowane",
          products: "Filtr XYZ",
          symbol: "FIL-XYZ",
          subiekt_tw_id: 999,
        }),
        {
          ...line,
          product: "Filtr",
          symbol: "FIL",
          subiektTwId: 200,
        }
      )
    ).toBe(false);

    const { checks, changed } = mergeZkLineChecksFromDeliveredOrders(w, [
      linkOrder({ id: "o1", status: "Zrealizowane", quantity: "2", delivered_quantity: "2" }),
    ]);
    expect(changed).toBe(true);
    expect(checks.find((c) => c.key === "ob:1")?.arrived).toBe(false);
  });

  it("nie odhacza przy częściowej dostawie mniejszej niż ilość ZK", () => {
    const w = watch({
      id: "w1",
      subiekt_snapshot: {
        dok_Pozycja: [
          {
            ob_Id: 1,
            ob_TowId: 100,
            tw_Symbol: "ABC",
            tw_Nazwa: "Implant X",
            ob_Ilosc: 3,
          },
        ],
      },
    });
    const { checks, changed } = mergeZkLineChecksFromDeliveredOrders(w, [
      linkOrder({
        id: "o1",
        status: "Czesciowo_zrealizowane",
        quantity: "3",
        delivered_quantity: "2",
      }),
    ]);
    expect(changed).toBe(true);
    expect(checks.find((c) => c.key === "ob:1")?.arrived).toBeFalsy();
  });

  it("nie auto-odhacza gdy suma częściowych dostaw pokrywa ilość ZK", () => {
    const w = watch({
      id: "w1",
      subiekt_snapshot: {
        dok_Pozycja: [
          {
            ob_Id: 1,
            ob_TowId: 100,
            tw_Symbol: "ABC",
            tw_Nazwa: "Implant X",
            ob_Ilosc: 3,
          },
        ],
      },
    });
    const { checks, changed } = mergeZkLineChecksFromDeliveredOrders(w, [
      linkOrder({
        id: "o1",
        status: "Czesciowo_zrealizowane",
        quantity: "2",
        delivered_quantity: "2",
      }),
      linkOrder({
        id: "o2",
        status: "Zrealizowane",
        quantity: "1",
        delivered_quantity: "1",
      }),
    ]);
    expect(changed).toBe(true);
    expect(checks.find((c) => c.key === "ob:1")?.arrived).toBeFalsy();
  });

  it("zachowuje ręczne odhaczenie u klienta po cofnięciu dostawy do Zamowione", () => {
    const w = watch({
      id: "w1",
      line_checks: [{ key: "ob:1", arrived: true, completed_manually: true }],
    });
    const { checks, changed } = mergeZkLineChecksFromDeliveredOrders(w, [
      linkOrder({
        id: "o1",
        status: "Zamowione",
        quantity: "2",
        delivered_quantity: "0",
      }),
    ]);
    expect(changed).toBe(false);
    expect(checks.find((c) => c.key === "ob:1")?.arrived).toBe(true);
  });

  it("zachowuje ręczne odhaczenie linii bez powiązanej prośby", () => {
    const w = watch({
      id: "w1",
      line_checks: [{ key: "ob:1", arrived: true, completed_manually: true }],
    });
    const { checks, changed } = mergeZkLineChecksFromDeliveredOrders(w, [
      linkOrder({
        id: "o1",
        status: "Zrealizowane",
        quantity: "2",
        delivered_quantity: "2",
        subiekt_tw_id: 999,
        symbol: "INNY",
        products: "Inny produkt",
      }),
    ]);
    expect(changed).toBe(false);
    expect(checks.find((c) => c.key === "ob:1")?.arrived).toBe(true);
  });

  it("czyści legacy arrived po odbiorze w Moje bez ręcznego zakończenia", () => {
    const w = watch({
      id: "w1",
      line_checks: [{ key: "ob:1", arrived: true }],
    });
    const { checks, changed } = mergeZkLineChecksFromDeliveredOrders(w, [
      linkOrder({
        id: "o1",
        status: "Zrealizowane",
        quantity: "2",
        delivered_quantity: "2",
        sales_acknowledged_at: "2026-06-01T10:00:00Z",
      }),
    ]);
    expect(changed).toBe(true);
    expect(checks.find((c) => c.key === "ob:1")?.arrived).toBe(false);
  });

  it("czyści shelf_marked gdy towar zniknął z regału", () => {
    const w = watch({
      id: "w1",
      line_checks: [{ key: "ob:1", arrived: false, shelf_marked: true }],
    });
    const { checks, changed } = mergeZkLineChecksFromDeliveredOrders(w, [
      linkOrder({ id: "o1", status: "Zamowione" }),
    ]);
    expect(changed).toBe(true);
    expect(checks.find((c) => c.key === "ob:1")?.shelf_marked).toBeFalsy();
  });
});

describe("computeZkWatchOrderHints", () => {
  it("liczy aktywne prośby i dopasowane linie", () => {
    const w = watch({ id: "w1" });
    const hints = computeZkWatchOrderHints(w, [
      linkOrder({ id: "open", status: "Zamowione" }),
      linkOrder({ id: "done", status: "Zrealizowane", quantity: "2", delivered_quantity: "2" }),
    ]);
    expect(hints.matchingOpenRequestCount).toBe(1);
    expect(hints.matchingOpenRequestIds).toEqual(["open"]);
    expect(hints.matchedDeliveredLineKeys).toContain("ob:1");
    expect(hints.allLinesMatchedByOrders).toBe(true);
    expect(hints.lineCoverageByKey["ob:1"]).toBe("delivered");
    expect(hints.uncoveredLineKeys).toEqual([]);
  });

  it("oznacza niepokryte pozycje ZK", () => {
    const w = watch({
      id: "w2",
      subiekt_snapshot: {
        dok_Pozycja: [
          {
            ob_Id: 1,
            ob_TowId: 100,
            tw_Symbol: "ABC",
            tw_Nazwa: "Implant X",
            ob_Ilosc: 2,
          },
          {
            ob_Id: 2,
            ob_TowId: 200,
            tw_Symbol: "DEF",
            tw_Nazwa: "Filtr",
            ob_Ilosc: 1,
          },
        ],
      },
    });
    const hints = computeZkWatchOrderHints(w, [
      linkOrder({ id: "open", status: "Zamowione", subiekt_tw_id: 100 }),
    ]);
    expect(hints.uncoveredLineKeys).toEqual(["ob:2"]);
    expect(hints.openProsbaCoveredLineKeys).toContain("ob:1");
    expect(hints.lineCoverageByKey["ob:2"]).toBe("uncovered");
  });

  it("nie uznaje podobnej nazwy za pokrycie innej pozycji ZK", () => {
    const w = watch({
      id: "w-similar",
      subiekt_snapshot: {
        dok_Pozycja: [
          {
            ob_Id: 1,
            ob_TowId: 100,
            tw_Symbol: "FIL",
            tw_Nazwa: "Filtr",
            ob_Ilosc: 1,
          },
          {
            ob_Id: 2,
            ob_TowId: 200,
            tw_Symbol: "FIL-XYZ",
            tw_Nazwa: "Filtr XYZ",
            ob_Ilosc: 1,
          },
        ],
      },
    });
    const hints = computeZkWatchOrderHints(w, [
      linkOrder({
        id: "partial-name",
        status: "Zamowione",
        subiekt_tw_id: null,
        symbol: "FIL-XYZ",
        products: "Filtr XYZ",
      }),
    ]);
    expect(hints.uncoveredLineKeys).toEqual(["ob:1"]);
    expect(hints.openProsbaCoveredLineKeys).toEqual(["ob:2"]);
  });

  it("nie zostawia niepokrytych pozycji gdy wszystko jest dostarczone", () => {
    const w = watch({ id: "w-delivered" });
    const hints = computeZkWatchOrderHints(w, [
      linkOrder({ id: "done", status: "Zrealizowane", quantity: "2", delivered_quantity: "2" }),
    ]);
    expect(hints.uncoveredLineKeys).toEqual([]);
    expect(hints.matchingOpenRequestCount).toBe(0);
    expect(hints.lineCoverageByKey["ob:1"]).toBe("delivered");
  });

  it("liczy otwartą prośbę powiązaną po source_zk_watch_id bez dopasowania towaru", () => {
    const w = watch({ id: "w-zk" });
    const hints = computeZkWatchOrderHints(w, [
      linkOrder({
        id: "from-zk-btn",
        status: "Weryfikacja",
        source_zk_watch_id: "w-zk",
        source_zk_number: "ZK/1",
        subiekt_tw_id: null,
        symbol: "INNY",
        products: "Inny produkt",
      }),
    ]);
    expect(hints.matchingOpenRequestCount).toBe(1);
    expect(hints.matchingOpenRequestIds).toEqual(["from-zk-btn"]);
    expect(hints.matchedDeliveredLineKeys).toEqual([]);
    expect(hints.uncoveredLineKeys).toContain("ob:1");
  });

  it("pokrywa linię ZK luźnym dopasowaniem tylko dla jawnej otwartej prośby ZK", () => {
    const w = watch({ id: "w-zk" });
    const hints = computeZkWatchOrderHints(w, [
      linkOrder({
        id: "from-zk-btn",
        status: "Weryfikacja",
        source_zk_watch_id: "w-zk",
        source_zk_number: "ZK/1",
        subiekt_tw_id: null,
        symbol: "ABC",
        products: "Implant X dodatkowy opis",
      }),
    ]);
    expect(hints.uncoveredLineKeys).toEqual([]);
    expect(hints.openProsbaCoveredLineKeys).toContain("ob:1");
  });

  it("informacja Zrealizowane — Dostępne (nie Na regale) i auto shelf_marked", () => {
    const w = watch({
      id: "w-info",
      line_checks: [{ key: "ob:1", arrived: false, needs_prosba: false }],
    });
    const order = linkOrder({
      id: "info-done",
      request_kind: "informacja",
      status: "Zrealizowane",
      quantity: "-",
      delivered_quantity: "-",
      source_zk_watch_id: "w-info",
    });
    const hints = computeZkWatchOrderHints(w, [order]);
    expect(hints.lineCoverageByKey["ob:1"]).not.toBe("delivered");
    expect(hints.regalWaitingLineKeys).not.toContain("ob:1");
    expect(hints.informacjaReadyLineKeys).toContain("ob:1");

    const { checks, changed } = mergeZkLineChecksFromDeliveredOrders(w, [order]);
    expect(changed).toBe(true);
    expect(checks.find((c) => c.key === "ob:1")?.shelf_marked).toBe(true);
  });

  it("informacja po potwierdzeniu w Moje — Zakończone, nie Odebrane z regału", () => {
    const w = watch({
      id: "w-info-ack",
      line_checks: [{ key: "ob:1", arrived: false, needs_prosba: false }],
    });
    const order = linkOrder({
      id: "info-acked",
      request_kind: "informacja",
      status: "Zrealizowane",
      quantity: "-",
      delivered_quantity: "-",
      source_zk_watch_id: "w-info-ack",
      sales_acknowledged_at: "2026-06-18T10:00:00Z",
    });
    const hints = computeZkWatchOrderHints(w, [order]);
    expect(hints.informacjaReadyLineKeys).not.toContain("ob:1");
    expect(hints.informacjaAcknowledgedLineKeys).toContain("ob:1");
    expect(hints.inStockLineKeys).not.toContain("ob:1");
    expect(hints.regalWaitingLineKeys).not.toContain("ob:1");
  });

  it("legacy informacja bez request_kind — nie traktuj jako Na regale", () => {
    const w = watch({ id: "w-legacy" });
    const order = linkOrder({
      id: "legacy-info",
      request_kind: null,
      status: "Zrealizowane",
      quantity: "-",
      delivered_quantity: "-",
    });
    const hints = computeZkWatchOrderHints(w, [order]);
    expect(hints.informacjaReadyLineKeys).toContain("ob:1");
    expect(hints.regalWaitingLineKeys).not.toContain("ob:1");
    expect(hints.lineCoverageByKey["ob:1"]).not.toBe("delivered");
  });

  it("mieszana linia: otwarte zamówienie + informacja ready → W prośbie", () => {
    const w = watch({ id: "w-mix" });
    const hints = computeZkWatchOrderHints(w, [
      linkOrder({
        id: "open-order",
        request_kind: "zamowienie",
        status: "Zamowione",
        quantity: "2",
      }),
      linkOrder({
        id: "info-ready",
        request_kind: "informacja",
        status: "Zrealizowane",
        quantity: "-",
        delivered_quantity: "-",
      }),
    ]);
    expect(hints.openProsbaCoveredLineKeys).toContain("ob:1");
    expect(hints.informacjaReadyLineKeys).toContain("ob:1");
    expect(hints.lineCoverageByKey["ob:1"]).toBe("open");
  });

  it("inStockLineKeys po odbiorze w Moje; regalWaiting bez potwierdzenia", () => {
    const w = watch({
      id: "w-scope",
      line_checks: [{ key: "ob:1", arrived: false, needs_prosba: false }],
    });
    const hintsExcluded = computeZkWatchOrderHints(w, []);
    expect(hintsExcluded.scopeExcludedLineKeys).toContain("ob:1");
    expect(hintsExcluded.inStockLineKeys).toEqual([]);

    const wDelivered = watch({
      id: "w-delivered-stock",
      line_checks: [{ key: "ob:1", arrived: false, needs_prosba: true }],
    });
    const orderDelivered = linkOrder({
      id: "done",
      status: "Zrealizowane",
      quantity: "2",
      delivered_quantity: "2",
    });
    const hintsWaiting = computeZkWatchOrderHints(wDelivered, [orderDelivered]);
    expect(hintsWaiting.regalWaitingLineKeys).toContain("ob:1");
    expect(hintsWaiting.inStockLineKeys).toEqual([]);

    const hintsPicked = computeZkWatchOrderHints(wDelivered, [
      { ...orderDelivered, sales_acknowledged_at: "2026-06-01T10:00:00Z" },
    ]);
    expect(hintsPicked.inStockLineKeys).toContain("ob:1");
    expect(hintsPicked.regalWaitingLineKeys).toEqual([]);
  });
});

describe("filterZkWatchesByClientQuery", () => {
  it("filtruje po kliencie i numerze ZK", () => {
    const rows = [
      watch({ id: "a", client_label: "Alfa", zk_number: "ZK/1" }),
      watch({ id: "b", client_label: "Beta", zk_number: "ZK/2" }),
    ];
    expect(filterZkWatchesByClientQuery(rows, "alfa").map((r) => r.id)).toEqual(["a"]);
    expect(filterZkWatchesByClientQuery(rows, "zk/2").map((r) => r.id)).toEqual(["b"]);
  });

  it("filtruje po skrócie produktu", () => {
    const rows = [
      watch({ id: "a", client_label: "Alfa", zk_number: "ZK/1", line_summary: "Implant tytan" }),
      watch({ id: "b", client_label: "Beta", zk_number: "ZK/2", line_summary: "Śruba" }),
    ];
    expect(filterZkWatchesByClientQuery(rows, "implant").map((r) => r.id)).toEqual(["a"]);
  });
});

describe("mergeZkLineChecksFromDeliveredOrders — izolacja ZK", () => {
  it("nie odhacza innego ZK tego klienta gdy prośba ma source_zk_watch_id", () => {
    const watchA = watch({ id: "w-a", zk_number: "234/M/03/2026" });
    const watchB = watch({ id: "w-b", zk_number: "235/M/03/2026" });
    const delivered = linkOrder({
      id: "o1",
      status: "Zrealizowane",
      quantity: "2",
      delivered_quantity: "2",
      source_zk_watch_id: "w-a",
      source_zk_number: "234/M/03/2026",
    });

    const mergeA = mergeZkLineChecksFromDeliveredOrders(watchA, [delivered]);
    const mergeB = mergeZkLineChecksFromDeliveredOrders(watchB, [delivered]);

    expect(mergeA.changed).toBe(true);
    expect(mergeA.checks.find((c) => c.key === "ob:1")?.arrived).toBe(false);
    expect(mergeB.changed).toBe(true);
    expect(mergeB.checks.find((c) => c.key === "ob:1")?.arrived).toBe(false);
  });
});

describe("resolveZkWatchIdsForOrderSync", () => {
  it("sync tylko wskazanego ZK gdy prośba ma source_zk_watch_id", () => {
    const watchA = watch({ id: "w-a", zk_number: "234/M/03/2026" });
    const watchB = watch({ id: "w-b", zk_number: "235/M/03/2026" });
    const order = linkOrder({
      id: "o1",
      source_zk_watch_id: "w-a",
      source_zk_number: "234/M/03/2026",
    });

    expect(resolveZkWatchIdsForOrderSync(order, [watchA, watchB])).toEqual(["w-a"]);
  });

  it("sync wszystkich ZK czekających bez jawnego powiązania", () => {
    const watchA = watch({ id: "w-a", client_kh_id: 42, zk_number: "ZK/1" });
    const watchB = watch({ id: "w-b", client_kh_id: 42, zk_number: "ZK/2" });
    const watchOther = watch({ id: "w-c", client_kh_id: 99, zk_number: "ZK/3" });
    const order = linkOrder({ id: "o1", sales_client_kh_id: 42 });

    expect(resolveZkWatchIdsForOrderSync(order, [watchA, watchB, watchOther])).toEqual([
      "w-a",
      "w-b",
    ]);
  });

  it("pomija zamknięte i zarchiwizowane ZK", () => {
    const open = watch({ id: "w-open", client_kh_id: 42 });
    const closed = watch({ id: "w-closed", client_kh_id: 42, closed_at: "2026-06-01T00:00:00Z" });
    const archived = watch({
      id: "w-arch",
      client_kh_id: 42,
      archived_at: "2026-06-01T00:00:00Z",
    });
    const order = linkOrder({ id: "o1", sales_client_kh_id: 42 });

    expect(resolveZkWatchIdsForOrderSync(order, [open, closed, archived])).toEqual(["w-open"]);
  });

  it("sync tylko ZK wskazanego numerem (bez id karty)", () => {
    const watchA = watch({ id: "w-a", zk_number: "ZK 153157/M/04/2026" });
    const watchB = watch({ id: "w-b", zk_number: "153158/M/04/2026" });
    const order = linkOrder({
      id: "o1",
      source_zk_watch_id: null,
      source_zk_number: "153157/M/04/2026",
    });

    expect(resolveZkWatchIdsForOrderSync(order, [watchA, watchB])).toEqual(["w-a"]);
  });

  it("nie sync innego ZK czekającego gdy prośba ma jawny numer ZK", () => {
    const watchA = watch({ id: "w-a", client_kh_id: 42, zk_number: "234/M/03/2026" });
    const watchB = watch({ id: "w-b", client_kh_id: 42, zk_number: "235/M/03/2026" });
    const order = linkOrder({
      id: "o1",
      source_zk_watch_id: null,
      source_zk_number: "234/M/03/2026",
    });

    expect(resolveZkWatchIdsForOrderSync(order, [watchA, watchB])).toEqual(["w-a"]);
  });

  it("dopasowuje ZK bez kh po nazwie klienta", () => {
    const byName = watch({
      id: "w-name",
      client_kh_id: null,
      client_label: "Klinika Smile",
    });
    const other = watch({
      id: "w-other",
      client_kh_id: null,
      client_label: "Inna klinika",
    });
    const order = linkOrder({
      id: "o1",
      sales_client_kh_id: null,
      sales_client_name: "klinika smile",
    });

    expect(resolveZkWatchIdsForOrderSync(order, [byName, other])).toEqual(["w-name"]);
  });

  it("dopasowuje ZK z kh gdy prośba ma tylko nazwę (exact label)", () => {
    const withKh = watch({
      id: "w-kh",
      client_kh_id: 42,
      client_label: "Klinika Smile",
    });
    const order = linkOrder({
      id: "o1",
      sales_client_kh_id: null,
      sales_client_name: "Klinika Smile",
    });

    expect(isOrderRelevantToZkWatch(order, withKh)).toBe(true);
    expect(resolveZkWatchIdsForOrderSync(order, [withKh])).toEqual(["w-kh"]);
  });
});

describe("isZkLineFullyDeliveredByOrders", () => {
  it("wymaga pełnej ilości przy częściowej dostawie", () => {
    const w = watch({
      id: "w1",
      subiekt_snapshot: {
        dok_Pozycja: [
          {
            ob_Id: 1,
            ob_TowId: 100,
            tw_Symbol: "ABC",
            tw_Nazwa: "Implant X",
            ob_Ilosc: 5,
          },
        ],
      },
    });
    const line = buildLineFromWatch(w);
    expect(
      isZkLineFullyDeliveredByOrders(
        [
          linkOrder({
            id: "o1",
            status: "Czesciowo_zrealizowane",
            quantity: "5",
            delivered_quantity: "3",
          }),
        ],
        line
      )
    ).toBe(false);
    expect(
      isZkLineFullyDeliveredByOrders(
        [
          linkOrder({
            id: "o1",
            status: "Czesciowo_zrealizowane",
            quantity: "5",
            delivered_quantity: "3",
          }),
          linkOrder({
            id: "o2",
            status: "Zrealizowane",
            quantity: "2",
            delivered_quantity: "2",
          }),
        ],
        line
      )
    ).toBe(true);
  });
});

function buildLineFromWatch(w: SalesZkWatch) {
  const pos = w.subiekt_snapshot!.dok_Pozycja![0]!;
  return {
    key: "ob:1",
    product: pos.tw_Nazwa!,
    symbol: pos.tw_Symbol ?? null,
    quantityLabel: "5 szt.",
    quantity: 5,
    subiektTwId: pos.ob_TowId ?? null,
    arrived: false,
  };
}
