import { describe, expect, it } from "vitest";
import {
  clientsMatchForZk,
  computeZkWatchOrderHints,
  filterZkWatchesByClientQuery,
  mergeZkLineChecksFromDeliveredOrders,
  productMatchesZkLine,
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
    status: "Zamowione",
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
  it("zaznacza pozycję ZK po dostawie prośby", () => {
    const w = watch({ id: "w1" });
    const lineViews = w.subiekt_snapshot!.dok_Pozycja!;
    const line = {
      key: "ob:1",
      product: "Implant X",
      symbol: "ABC",
      quantityLabel: "2 szt.",
      subiektTwId: 100,
      arrived: false,
    };
    expect(productMatchesZkLine(linkOrder({ id: "o1", status: "Zrealizowane" }), line)).toBe(
      true
    );

    const { checks, changed } = mergeZkLineChecksFromDeliveredOrders(w, [
      linkOrder({ id: "o1", status: "Zrealizowane" }),
    ]);
    expect(changed).toBe(true);
    expect(checks.find((c) => c.key === "ob:1")?.arrived).toBe(true);
  });
});

describe("computeZkWatchOrderHints", () => {
  it("liczy aktywne prośby i dopasowane linie", () => {
    const w = watch({ id: "w1" });
    const hints = computeZkWatchOrderHints(w, [
      linkOrder({ id: "open", status: "Zamowione" }),
      linkOrder({ id: "done", status: "Zrealizowane" }),
    ]);
    expect(hints.matchingOpenRequestCount).toBe(1);
    expect(hints.matchedDeliveredLineKeys).toContain("ob:1");
    expect(hints.allLinesMatchedByOrders).toBe(true);
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
    expect(hints.matchedDeliveredLineKeys).toEqual([]);
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
});
