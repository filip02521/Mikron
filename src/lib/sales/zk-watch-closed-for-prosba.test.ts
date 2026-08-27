import { describe, expect, it } from "vitest";
import {
  assertZkWatchOpenForProsba,
  nullIfZkWatchClosedForProsba,
  ZK_WATCH_CLOSED_FOR_PROSBA_MESSAGE,
} from "@/lib/sales/zk-watch-closed-for-prosba";
import {
  assertZkLinkedZamowienieStillUncovered,
  ZK_PROSBA_LINES_ALREADY_COVERED_MESSAGE,
  ZK_PROSBA_LINES_PARTIAL_COVERED_MESSAGE,
  ZK_PROSBA_NO_UNCOVERED_LINES_MESSAGE,
} from "@/lib/sales/zk-prosba-coverage-guard";
import type { SalesZkWatch } from "@/types/database";
import type { ZkLinkableOrder } from "@/lib/sales/zk-watch-order-link";

function baseWatch(overrides: Partial<SalesZkWatch> = {}): SalesZkWatch {
  return {
    id: "w1",
    sales_person_id: "sp1",
    subiekt_dok_id: 1,
    zk_number: "ZK 1",
    client_label: "Klient",
    client_kh_id: 10,
    amount_net: null,
    amount_gross: null,
    zk_issued_at: null,
    note: null,
    line_summary: null,
    include_note_in_prosba: false,
    line_checks: null,
    teeth_drafts: null,
    follow_up_at: null,
    closed_at: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    subiekt_snapshot: {
      dok_Pozycja: [
        {
          ob_Id: 1,
          ob_TowId: 101,
          tw_Symbol: "A",
          tw_Nazwa: "Towar A",
          ob_Ilosc: 2,
        },
        {
          ob_Id: 2,
          ob_TowId: 102,
          tw_Symbol: "B",
          tw_Nazwa: "Towar B",
          ob_Ilosc: 1,
        },
      ],
    },
    ...overrides,
  } as SalesZkWatch;
}

function openOrder(partial: Partial<ZkLinkableOrder> & Pick<ZkLinkableOrder, "id">): ZkLinkableOrder {
  return {
    sales_person_id: "sp1",
    sales_client_kh_id: 10,
    sales_client_name: "Klient",
    source_zk_watch_id: "w1",
    source_zk_number: "ZK 1",
    subiekt_tw_id: 101,
    symbol: "A",
    products: "Towar A",
    mikran_code: null,
    quantity: "2",
    delivered_quantity: "0",
    status: "Nowe",
    request_kind: "zamowienie",
    ordered_at: null,
    action_at: "2026-01-02T00:00:00Z",
    delivery_at: null,
    zd_fulfillment_deadline: null,
    zd_fulfillment_deadline_changed_at: null,
    sales_acknowledged_at: null,
    sales_cancelled_at: null,
    is_teeth: false,
    ...partial,
  };
}

describe("zk-watch-closed-for-prosba", () => {
  it("assert rzuca dla closed", () => {
    expect(() =>
      assertZkWatchOpenForProsba(baseWatch({ closed_at: "2026-01-02" }))
    ).toThrow(ZK_WATCH_CLOSED_FOR_PROSBA_MESSAGE);
  });

  it("assert rzuca dla archived", () => {
    expect(() =>
      assertZkWatchOpenForProsba(baseWatch({ archived_at: "2026-01-02" }))
    ).toThrow(ZK_WATCH_CLOSED_FOR_PROSBA_MESSAGE);
  });

  it("nullIf zwraca null gdy zamknięte", () => {
    expect(
      nullIfZkWatchClosedForProsba(baseWatch({ closed_at: "2026-01-02" }))
    ).toBeNull();
    expect(nullIfZkWatchClosedForProsba(baseWatch())).toMatchObject({ id: "w1" });
  });
});

describe("assertZkLinkedZamowienieStillUncovered", () => {
  it("nie rzuca dla orphan keys poza snapshotem", async () => {
    await expect(
      assertZkLinkedZamowienieStillUncovered({
        watch: baseWatch(),
        entries: [
          {
            requestKind: "zamowienie",
            sourceZkLineKeys: ["ob:missing"],
          },
        ],
        orders: [],
      })
    ).resolves.toBeUndefined();
  });

  it("nie rzuca gdy wszystkie requested są uncovered", async () => {
    await expect(
      assertZkLinkedZamowienieStillUncovered({
        watch: baseWatch(),
        entries: [
          {
            requestKind: "zamowienie",
            sourceZkLineKeys: ["ob:1", "ob:2"],
          },
        ],
        orders: [],
      })
    ).resolves.toBeUndefined();
  });

  it("rzuca gdy wszystkie requested są w otwartej prośbie", async () => {
    await expect(
      assertZkLinkedZamowienieStillUncovered({
        watch: baseWatch(),
        entries: [
          {
            requestKind: "zamowienie",
            sourceZkLineKeys: ["ob:1", "ob:2"],
          },
        ],
        orders: [
          openOrder({ id: "a", subiekt_tw_id: 101, symbol: "A", products: "Towar A" }),
          openOrder({ id: "b", subiekt_tw_id: 102, symbol: "B", products: "Towar B" }),
        ],
      })
    ).rejects.toThrow(ZK_PROSBA_LINES_ALREADY_COVERED_MESSAGE);
  });

  it("rzuca przy mix covered + uncovered", async () => {
    await expect(
      assertZkLinkedZamowienieStillUncovered({
        watch: baseWatch(),
        entries: [
          {
            requestKind: "zamowienie",
            sourceZkLineKeys: ["ob:1", "ob:2"],
          },
        ],
        orders: [openOrder({ id: "a", subiekt_tw_id: 101 })],
      })
    ).rejects.toThrow(ZK_PROSBA_LINES_PARTIAL_COVERED_MESSAGE);
  });

  it("rzuca gdy requested są dostarczone (brak uncovered)", async () => {
    await expect(
      assertZkLinkedZamowienieStillUncovered({
        watch: baseWatch(),
        entries: [
          {
            requestKind: "zamowienie",
            sourceZkLineKeys: ["ob:1"],
          },
        ],
        orders: [
          openOrder({
            id: "done",
            status: "Zrealizowane",
            subiekt_tw_id: 101,
            quantity: "2",
            delivered_quantity: "2",
          }),
        ],
      })
    ).rejects.toThrow(ZK_PROSBA_NO_UNCOVERED_LINES_MESSAGE);
  });

  it("pomija informacja", async () => {
    await expect(
      assertZkLinkedZamowienieStillUncovered({
        watch: baseWatch(),
        entries: [
          {
            requestKind: "informacja",
            sourceZkLineKeys: ["ob:1"],
          },
        ],
        orders: [openOrder({ id: "a", subiekt_tw_id: 101 })],
      })
    ).resolves.toBeUndefined();
  });
});
