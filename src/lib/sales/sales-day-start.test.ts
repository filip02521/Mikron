import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";
import {
  buildSalesDayStartSnapshot,
  salesDayStartNavCount,
  salesDayStartPanelDescription,
  sliceSalesDayStartItems,
} from "./sales-day-start";

function row(partial: Partial<MyOrderRow> & Pick<MyOrderRow, "id">): MyOrderRow {
  return {
    id: partial.id,
    kind: partial.kind ?? "zamowienie",
    supplierName: partial.supplierName ?? "Mikran",
    statusTitle: partial.statusTitle ?? "Zrealizowane",
    acknowledgeMode: partial.acknowledgeMode ?? "none",
    pickupPendingIds: partial.pickupPendingIds ?? [],
    lines: partial.lines ?? [],
    ...partial,
  } as MyOrderRow;
}

describe("buildSalesDayStartSnapshot", () => {
  it("łączy wiele pozycji odbioru w jedno powiadomienie zbiorcze", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "a",
          supplierName: "Mikran",
          acknowledgeMode: "pickup",
          pickupPendingIds: ["o1", "o2"],
          pickupPendingCount: 2,
        }),
        row({
          id: "b",
          supplierName: "Mikran",
          acknowledgeMode: "pickup",
          pickupPendingIds: ["o3"],
          pickupPendingCount: 1,
        }),
        row({
          id: "c",
          supplierName: "Inne",
          acknowledgeMode: "pickup",
          pickupPendingIds: ["o4"],
          pickupPendingCount: 1,
        }),
      ],
    });

    const pickupItems = snapshot.items.filter((i) => i.source === "pickup");
    expect(pickupItems).toHaveLength(1);
    expect(pickupItems[0]?.id).toBe("pickup-ready");
    expect(pickupItems[0]?.count).toBe(4);
    expect(pickupItems[0]?.title).toBe("Potwierdź odbiór z regału (4)");
    expect(pickupItems[0]?.ctaLabel).toBe("Przejdź");
    expect(pickupItems[0]?.scrollTarget).toBe("moje-section-action");
    expect(snapshot.totalActionCount).toBe(3);
  });

  it("pokazuje dostawcę gdy jest tylko jedna pozycja odbioru", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "a",
          supplierName: "Mikran",
          acknowledgeMode: "pickup",
          pickupPendingIds: ["o1"],
          pickupPendingCount: 1,
        }),
      ],
    });

    const pickupItems = snapshot.items.filter((i) => i.source === "pickup");
    expect(pickupItems).toHaveLength(1);
    expect(pickupItems[0]?.title).toBe("Mikran");
    expect(pickupItems[0]?.ctaLabel).toBe("Potwierdź");
  });

  it("łączy notatnik i tablicę w totalActionCount", () => {
    const board: SalesBoardAttentionSnapshot = {
      unreadAnnouncementCount: 1,
      unreadAnnouncementLatestTitle: "Urlop",
      unreadAnnouncementBannerCount: 1,
      unreadAnnouncementBannerLatestTitle: "Urlop",
      unreadAnnouncementBannerLatestId: "ann-1",
      unseenAnswerCount: 1,
      unseenAnswerPreview: {
        threadId: "t1",
        title: "Termin",
        isOwnQuestion: true,
      },
      unseenQuestionIds: ["t1"],
      pinnedAnnouncements: [],
      navBadgeCount: 2,
    };

    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "x",
          acknowledgeMode: "cancelled",
        }),
      ],
      watches: [
        {
          id: "w1",
          sales_person_id: "sp1",
          subiekt_dok_id: 1,
          zk_number: "ZK/1",
          client_label: "Klient",
          follow_up_at: new Date().toISOString().slice(0, 10),
          closed_at: null,
          archived_at: null,
          created_at: "",
          updated_at: "",
        } as never,
      ],
      boardAttention: board,
    });

    expect(snapshot.totalActionCount).toBe(4);
    const announcementItem = snapshot.items.find((i) => i.source === "board_announcement");
    expect(announcementItem?.href).toContain("watek=ann-1");
  });

  it("linkuje przypomnienie ZK do /zk z focusWatch", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [],
      watches: [
        {
          id: "w1",
          sales_person_id: "sp1",
          subiekt_dok_id: 1,
          zk_number: "ZK/1",
          client_label: "Klient",
          follow_up_at: new Date().toISOString().slice(0, 10),
          closed_at: null,
          archived_at: null,
          created_at: "",
          updated_at: "",
        } as never,
      ],
    });

    const zkItem = snapshot.items.find((i) => i.source === "zk_follow_up");
    expect(zkItem?.href).toBe("/zk?focusWatch=w1#watch-w1");
    expect(zkItem?.ctaLabel).toBe("ZK czekające");
  });

  it("linkuje przyjście towaru ZK do /zk z focusWatch", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [],
      watches: [
        {
          id: "w-wh",
          sales_person_id: "sp1",
          subiekt_dok_id: 2,
          zk_number: "ZK/2",
          client_label: "Klient",
          follow_up_at: null,
          closed_at: null,
          archived_at: null,
          line_checks: [{ key: "ob:1", arrived: true }],
          created_at: "",
          updated_at: "",
        } as never,
      ],
      unseenWarehouseWatchIds: ["w-wh"],
    });

    const item = snapshot.items.find((i) => i.id.startsWith("zk-warehouse-arrival"));
    expect(item?.href).toBe("/zk?focusWatch=w-wh#watch-w-wh");
    expect(item?.ctaLabel).toBe("ZK czekające");
    expect(item?.source).toBe("zk_warehouse");
  });

  it("kieruje potwierdzenie informacji do sekcji informacji na dole listy", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "inf",
          kind: "informacja",
          acknowledgeMode: "availability",
          pickupPendingCount: 1,
          pickupPendingIds: ["o-inf"],
          orderIds: ["o-inf"],
        }),
      ],
    });

    const item = snapshot.items.find((i) => i.source === "informacja_ready");
    expect(item?.scrollTarget).toBe("moje-section-informacja");
    expect(item?.href).toContain("moje-section-informacja");
    expect(item?.href).toContain("focusOrders=o-inf");
  });

  it("cleared gdy brak akcji", () => {
    const snapshot = buildSalesDayStartSnapshot({ rows: [] });
    expect(snapshot.cleared).toBe(true);
    expect(snapshot.items).toHaveLength(0);
  });
});

describe("salesDayStartNavCount", () => {
  it("sumuje wszystkie źródła badge", () => {
    expect(
      salesDayStartNavCount(
        {
          pickupCount: 2,
          cancelAckCount: 1,
          informacjaReadyCount: 0,
          partialReadyCount: 0,
          overdueCount: 0,
          verificationCount: 0,
          przedZamowieniemCount: 0,
          zamowioneCount: 0,
          availabilityPendingCount: 0,
        },
        1,
        2
      )
    ).toBe(6);
  });
});

describe("sliceSalesDayStartItems", () => {
  it("ogranicza listę przed rozwinięciem", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      source: "pickup" as const,
      priority: 1,
      title: `Item ${i}`,
      href: "/moje",
      ctaLabel: "Go",
    }));
    const sliced = sliceSalesDayStartItems(items, false, 6);
    expect(sliced.visible).toHaveLength(6);
    expect(sliced.hiddenCount).toBe(2);
  });
});

describe("salesDayStartPanelDescription", () => {
  it("opisuje wszystkie typy zadań, nie tylko odbiór", () => {
    expect(salesDayStartPanelDescription(1)).toContain("1 pilna sprawa");
    expect(salesDayStartPanelDescription(8)).toContain("8 pilnych spraw");
    expect(salesDayStartPanelDescription(8)).not.toContain("regału");
  });
});
