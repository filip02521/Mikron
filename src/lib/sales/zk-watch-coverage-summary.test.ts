import { describe, expect, it } from "vitest";
import { computeZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { formatZkProsbaCoverageSummary } from "@/lib/sales/zk-watch-coverage-summary";
import type { SalesZkWatch } from "@/types/database";

function watch(partial: Partial<SalesZkWatch>): SalesZkWatch {
  return {
    id: "w1",
    sales_person_id: "sp1",
    subiekt_dok_id: 1,
    zk_number: "ZK/1",
    client_label: "Klient",
    client_kh_id: 42,
    amount_net: null,
    amount_gross: null,
    zk_issued_at: null,
    note: null,
    line_summary: null,
    subiekt_snapshot: {
      dok_Pozycja: [
        { ob_Id: 1, ob_TowId: 100, tw_Symbol: "ABC", tw_Nazwa: "Implant X", ob_Ilosc: 2 },
        { ob_Id: 2, ob_TowId: 200, tw_Symbol: "DEF", tw_Nazwa: "Filtr", ob_Ilosc: 1 },
      ],
    },
    line_checks: [],
    follow_up_at: null,
    closed_at: null,
    archived_at: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("formatZkProsbaCoverageSummary", () => {
  it("składa czytelne podsumowanie pokrycia pozycji", () => {
    const hints = computeZkWatchOrderHints(watch({ id: "w1" }), [
      {
        id: "open",
        sales_person_id: "sp1",
        sales_client_kh_id: 42,
        sales_client_name: "Klient",
        source_zk_watch_id: "w1",
        source_zk_number: "ZK/1",
        subiekt_tw_id: 100,
        symbol: "ABC",
        products: "Implant X",
        mikran_code: null,
        quantity: "2",
        delivered_quantity: "0",
        status: "Zamowione",
        sales_acknowledged_at: null,
        sales_cancelled_at: null,
      },
      {
        id: "done",
        sales_person_id: "sp1",
        sales_client_kh_id: 42,
        sales_client_name: "Klient",
        source_zk_watch_id: "w1",
        source_zk_number: "ZK/1",
        subiekt_tw_id: 200,
        symbol: "DEF",
        products: "Filtr",
        mikran_code: null,
        quantity: "1",
        delivered_quantity: "1",
        status: "Zrealizowane",
        sales_acknowledged_at: null,
        sales_cancelled_at: null,
      },
    ]);

    expect(formatZkProsbaCoverageSummary(hints)).toBe(
      "1 pozycja w prośbie w toku · 1 pozycja dostarczona"
    );
  });
});
