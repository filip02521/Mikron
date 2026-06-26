import { describe, expect, it } from "vitest";
import {
  classifyZkWatchPendingAckKinds,
  collectZkWatchPendingAckItems,
  collectZkWatchPendingAckOrderIds,
  isOrderPendingAckForZkClose,
} from "./zk-watch-close-pending";
import type { ZkLinkableOrder } from "./zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";

function linkOrder(
  partial: Partial<ZkLinkableOrder> & Pick<ZkLinkableOrder, "id">
): ZkLinkableOrder {
  return {
    sales_person_id: "sp1",
    sales_client_kh_id: 42,
    sales_client_name: "Klinika Smile",
    source_zk_watch_id: "watch-1",
    source_zk_number: "ZK/2026/0142",
    subiekt_tw_id: 100,
    symbol: "ABC",
    products: "Implant X",
    mikran_code: null,
    quantity: "2",
    delivered_quantity: "2",
    status: "Zrealizowane",
    request_kind: "zamowienie",
    ordered_at: null,
    action_at: "2026-06-01T08:00:00Z",
    delivery_at: null,
    zd_fulfillment_deadline: null,
    zd_fulfillment_deadline_changed_at: null,
    zd_fulfillment_previous_deadline: null,
    zd_fulfillment_deadline_change_seen_at: null,
    sales_acknowledged_at: null,
    sales_cancelled_at: null,
    ...partial,
  };
}

function watch(): SalesZkWatch {
  return {
    id: "watch-1",
    sales_person_id: "sp1",
    subiekt_dok_id: 1,
    zk_number: "ZK/2026/0142",
    client_label: "Klinika Smile",
    client_kh_id: 42,
    amount_net: null,
    amount_gross: null,
    zk_issued_at: null,
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
    prosba_scope_lines: null,
    note: null,
    follow_up_at: null,
    closed_at: null,
    archived_at: null,
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-01T08:00:00Z",
  };
}

describe("collectZkWatchPendingAckItems", () => {
  it("zbiera odbiór z magazynu powiązany z ZK", () => {
    const items = collectZkWatchPendingAckItems(watch(), [
      linkOrder({ id: "o1", status: "Zrealizowane", sales_acknowledged_at: null }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      orderId: "o1",
      kind: "pickup",
      productLabel: "Implant X",
      statusLabel: "Gotowe do odbioru z magazynu",
    });
  });

  it("pomija prośby już potwierdzone", () => {
    expect(
      collectZkWatchPendingAckItems(watch(), [
        linkOrder({
          id: "o1",
          status: "Zrealizowane",
          sales_acknowledged_at: "2026-06-10T08:00:00Z",
        }),
      ])
    ).toEqual([]);
  });

  it("pomija prośby innego klienta bez powiązania z ZK", () => {
    expect(
      collectZkWatchPendingAckItems(watch(), [
        linkOrder({
          id: "o1",
          source_zk_watch_id: null,
          source_zk_number: null,
          sales_client_kh_id: 99,
          sales_client_name: "Inny klient",
        }),
      ])
    ).toEqual([]);
  });

  it("zbiera informację gotową do potwierdzenia", () => {
    const items = collectZkWatchPendingAckItems(watch(), [
      linkOrder({
        id: "o-info",
        request_kind: "informacja",
        status: "Zrealizowane",
      }),
    ]);
    expect(items[0]?.kind).toBe("availability");
  });

  it("zbiera zmianę terminu ZD obok odbioru", () => {
    const recentChangeAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const items = collectZkWatchPendingAckItems(watch(), [
      linkOrder({
        id: "o-zd",
        status: "Zamowione",
        zd_fulfillment_deadline: "2026-07-15",
        zd_fulfillment_previous_deadline: "2026-07-01",
        zd_fulfillment_deadline_changed_at: recentChangeAt,
        zd_fulfillment_deadline_change_seen_at: null,
      }),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["zd_deadline"]);
  });

  it("collectZkWatchPendingAckOrderIds zwraca unikalne ID", () => {
    const recentChangeAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const orders = [
      linkOrder({
        id: "o-zd",
        status: "Zrealizowane",
        zd_fulfillment_deadline: "2026-07-15",
        zd_fulfillment_previous_deadline: "2026-07-01",
        zd_fulfillment_deadline_changed_at: recentChangeAt,
      }),
    ];
    expect(collectZkWatchPendingAckOrderIds(watch(), orders)).toEqual(["o-zd"]);
    expect(classifyZkWatchPendingAckKinds(orders[0])).toEqual(["pickup", "zd_deadline"]);
  });

  it("pomija niepotwierdzoną prośbę tego samego klienta bez dopasowania towaru do ZK", () => {
    expect(
      collectZkWatchPendingAckItems(watch(), [
        linkOrder({
          id: "o-other",
          source_zk_watch_id: null,
          source_zk_number: null,
          subiekt_tw_id: 999,
          symbol: "INNY",
          products: "Inny produkt",
          status: "Zrealizowane",
        }),
      ])
    ).toEqual([]);
  });

  it("zbiera rezygnację do potwierdzenia powiązaną z ZK", () => {
    const items = collectZkWatchPendingAckItems(watch(), [
      linkOrder({
        id: "o-cancel",
        status: "Zamowione",
        sales_cancelled_at: "2026-06-15T08:00:00Z",
        delivered_quantity: "1",
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("cancel_notice");
  });

  it("zbiera prośbę klienta bez kh dopasowaną po nazwie gdy ZK ma kh", () => {
    const items = collectZkWatchPendingAckItems(watch(), [
      linkOrder({
        id: "o-label",
        source_zk_watch_id: null,
        source_zk_number: null,
        sales_client_kh_id: null,
        sales_client_name: "Klinika Smile",
        status: "Zrealizowane",
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.orderId).toBe("o-label");
  });

  it("isOrderPendingAckForZkClose wymaga jawnego powiązania lub dopasowania towaru", () => {
    const w = watch();
    const explicit = linkOrder({ id: "e1", status: "Zrealizowane" });
    const matched = linkOrder({
      id: "m1",
      source_zk_watch_id: null,
      source_zk_number: null,
      status: "Zrealizowane",
    });
    const unrelated = linkOrder({
      id: "u1",
      source_zk_watch_id: null,
      source_zk_number: null,
      subiekt_tw_id: 999,
      symbol: "INNY",
      products: "Inny produkt",
      status: "Zrealizowane",
    });
    expect(isOrderPendingAckForZkClose(explicit, w)).toBe(true);
    expect(isOrderPendingAckForZkClose(matched, w)).toBe(true);
    expect(isOrderPendingAckForZkClose(unrelated, w)).toBe(false);
  });
});
