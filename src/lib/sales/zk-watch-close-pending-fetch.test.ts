import { describe, expect, it } from "vitest";
import { collectZkWatchPendingAckItems, type ZkWatchPendingAckItem } from "./zk-watch-close-pending";
import type { ZkLinkableOrder } from "./zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";

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

describe("zk-watch-close-pending-fetch integration", () => {
  it("collectZkWatchPendingAckItems filtruje tylko pending kandydatów", () => {
    const items = collectZkWatchPendingAckItems(watch(), [
      linkOrder({ id: "pending", status: "Zrealizowane" }),
      linkOrder({
        id: "done",
        status: "Zrealizowane",
        sales_acknowledged_at: "2026-06-10T08:00:00Z",
      }),
    ]);
    expect(items.map((item: ZkWatchPendingAckItem) => item.orderId)).toEqual(["pending"]);
  });
});
