import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";
import {
  buildSalesDayStartSnapshot,
  salesDayStartNavCount,
  salesDayStartPanelDescription,
  sliceSalesDayStartItems,
  snapshotActionWeight,
} from "./sales-day-start";

function row(partial: Partial<MyOrderRow> & Pick<MyOrderRow, "id">): MyOrderRow {
  return {
    kind: "zamowienie",
    supplierName: "Mikran",
    statusTitle: "Zrealizowane",
    acknowledgeMode: "none",
    pickupPendingIds: [],
    lines: [],
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

  it("łączy odbiór zębów w jedno powiadomienie zbiorcze", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "t1",
          supplierName: "Lab Zęby",
          acknowledgeMode: "teeth_handover",
          pickupPendingIds: ["o1", "o2"],
          pickupPendingCount: 2,
        }),
      ],
    });

    const teethItems = snapshot.items.filter((i) => i.source === "teeth_handover");
    expect(teethItems).toHaveLength(1);
    expect(teethItems[0]?.title).toBe("Potwierdź odbiór zębów (2)");
    expect(teethItems[0]?.scrollTarget).toBe("moje-section-teeth");
    expect(teethItems[0]?.href).toBe("/moje#moje-section-teeth");
    expect(snapshotActionWeight(snapshot)).toBe(2);
    expect(snapshot.totalActionCount).toBe(1);
  });

  it("łączy mieszany odbiór zębów i towaru w jedno powiadomienie", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "m1",
          supplierName: "Lab Mix",
          acknowledgeMode: "mixed_pickup",
          pickupPendingIds: ["t1", "r1"],
          pickupPendingCount: 2,
          pickupTeethPendingIds: ["t1"],
          pickupShelfPendingIds: ["r1"],
        }),
      ],
    });

    const mixedItems = snapshot.items.filter((i) => i.source === "mixed_pickup");
    expect(mixedItems).toHaveLength(1);
    expect(mixedItems[0]?.title).toBe("Potwierdź odbiór zębów i towaru (2)");
    expect(mixedItems[0]?.scrollTarget).toBe("moje-section-mixed-pickup");
    expect(mixedItems[0]?.href).toBe("/moje#moje-section-mixed-pickup");
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

  it("łączy notatnik i własne odpowiedzi tablicy w totalActionCount (bez ogłoszeń)", () => {
    const board: SalesBoardAttentionSnapshot = {
      unreadAnnouncementCount: 1,
      unreadAnnouncementLatestTitle: "Urlop",
      unreadAnnouncementBannerCount: 1,
      unreadAnnouncementBannerLatestTitle: "Urlop",
      unreadAnnouncementBannerLatestId: "ann-1",
      unseenAnswerCount: 2,
      unseenOwnAnswerCount: 1,
      unseenAnswerPreview: {
        threadId: "t1",
        title: "Termin",
        isOwnQuestion: true,
      },
      unseenQuestionIds: ["t1", "t2"],
      unseenOwnQuestionIds: ["t1"],
      pinnedAnnouncements: [],
      navBadgeCount: 1,
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

    expect(snapshot.totalActionCount).toBe(3);
    expect(snapshot.items.find((i) => i.source === "board_announcement")).toBeUndefined();
    const answerItem = snapshot.items.find((i) => i.source === "board_answer");
    expect(answerItem?.title).toContain("Twoje pytanie");
    expect(answerItem?.count).toBe(1);
    expect(answerItem?.href).toContain("watek=t1");
  });

  it("linkuje do filtra własnych odpowiedzi gdy kilka nieprzeczytanych", () => {
    const board: SalesBoardAttentionSnapshot = {
      unreadAnnouncementCount: 0,
      unreadAnnouncementLatestTitle: null,
      unreadAnnouncementBannerCount: 0,
      unreadAnnouncementBannerLatestTitle: null,
      unreadAnnouncementBannerLatestId: null,
      unseenAnswerCount: 3,
      unseenOwnAnswerCount: 2,
      unseenAnswerPreview: {
        threadId: "t1",
        title: "Termin",
        isOwnQuestion: true,
      },
      unseenQuestionIds: ["t1", "t2", "t3"],
      unseenOwnQuestionIds: ["t1", "t3"],
      pinnedAnnouncements: [],
      navBadgeCount: 2,
    };

    const snapshot = buildSalesDayStartSnapshot({
      rows: [],
      boardAttention: board,
    });

    const answerItem = snapshot.items.find((i) => i.source === "board_answer");
    expect(answerItem?.title).toContain("(2)");
    expect(answerItem?.href).toContain("filtr=own_unseen");
  });

  it("linkuje do wątku gdy jedna własna odpowiedź", () => {
    const board: SalesBoardAttentionSnapshot = {
      unreadAnnouncementCount: 0,
      unreadAnnouncementLatestTitle: null,
      unreadAnnouncementBannerCount: 0,
      unreadAnnouncementBannerLatestTitle: null,
      unreadAnnouncementBannerLatestId: null,
      unseenAnswerCount: 1,
      unseenOwnAnswerCount: 1,
      unseenAnswerPreview: {
        threadId: "t-own",
        title: "Moje pytanie",
        isOwnQuestion: true,
      },
      unseenQuestionIds: ["t-own"],
      unseenOwnQuestionIds: ["t-own"],
      pinnedAnnouncements: [],
      navBadgeCount: 1,
    };

    const snapshot = buildSalesDayStartSnapshot({
      rows: [],
      boardAttention: board,
    });

    const answerItem = snapshot.items.find((i) => i.source === "board_answer");
    expect(answerItem?.href).toContain("watek=t-own");
    expect(answerItem?.href).not.toContain("filtr=");
  });

  it("nie pokazuje odpowiedzi tablicy w start dnia gdy to pytanie kolegi", () => {
    const board: SalesBoardAttentionSnapshot = {
      unreadAnnouncementCount: 0,
      unreadAnnouncementLatestTitle: null,
      unreadAnnouncementBannerCount: 0,
      unreadAnnouncementBannerLatestTitle: null,
      unreadAnnouncementBannerLatestId: null,
      unseenAnswerCount: 1,
      unseenOwnAnswerCount: 0,
      unseenAnswerPreview: {
        threadId: "t2",
        title: "Pytanie kolegi",
        isOwnQuestion: false,
      },
      unseenQuestionIds: ["t2"],
      unseenOwnQuestionIds: [],
      pinnedAnnouncements: [],
      navBadgeCount: 0,
    };

    const snapshot = buildSalesDayStartSnapshot({
      rows: [],
      boardAttention: board,
    });

    expect(snapshot.items.find((i) => i.source === "board_answer")).toBeUndefined();
    expect(snapshot.cleared).toBe(true);
  });

  it("nie duplikuje ogłoszeń zakupów w start dnia", () => {
    const board: SalesBoardAttentionSnapshot = {
      unreadAnnouncementCount: 2,
      unreadAnnouncementLatestTitle: "Urlop",
      unreadAnnouncementBannerCount: 2,
      unreadAnnouncementBannerLatestTitle: "Urlop",
      unreadAnnouncementBannerLatestId: "ann-1",
      unseenAnswerCount: 0,
      unseenOwnAnswerCount: 0,
      unseenAnswerPreview: null,
      unseenQuestionIds: [],
      unseenOwnQuestionIds: [],
      pinnedAnnouncements: [],
      navBadgeCount: 0,
    };

    const snapshot = buildSalesDayStartSnapshot({
      rows: [],
      boardAttention: board,
    });

    expect(snapshot.items.find((i) => i.source === "board_announcement")).toBeUndefined();
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

  it("pokazuje powiadomienie o uwagach zakupów gdy maxNoteUpdatedAt ustawione", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "n1",
          supplierName: "Mikran",
          requestNote: "Pilne — sprawdź termin",
          maxNoteUpdatedAt: "2025-01-01T00:00:00Z",
          orderIds: ["o-n1"],
        }),
      ],
    });

    const item = snapshot.items.find((i) => i.source === "note_from_procurement");
    expect(item).toBeDefined();
    expect(item?.count).toBe(1);
    expect(item?.title).toBe("Mikran");
    expect(item?.subtitle).toBe("Pilne — sprawdź termin");
    expect(item?.scrollTarget).toBe("moje-section-action");
    expect(item?.href).toContain("focusOrders=o-n1");
  });

  it("nie pokazuje powiadomienia o uwagach gdy brak maxNoteUpdatedAt", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "n2",
          requestNote: "Uwaga bez timestampu",
          orderIds: ["o-n2"],
        }),
      ],
    });

    expect(snapshot.items.find((i) => i.source === "note_from_procurement")).toBeUndefined();
  });

  it("agreguje ≥2 wiersze z uwagami w jedno powiadomienie zbiorcze", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "n3",
          requestNote: "Uwaga 1",
          maxNoteUpdatedAt: "2025-01-01T00:00:00Z",
          orderIds: ["o-n3"],
        }),
        row({
          id: "n4",
          requestNote: "Uwaga 2",
          maxNoteUpdatedAt: "2025-01-02T00:00:00Z",
          orderIds: ["o-n4"],
        }),
      ],
    });

    const items = snapshot.items.filter((i) => i.source === "note_from_procurement");
    expect(items).toHaveLength(1);
    expect(items[0]?.count).toBe(2);
    expect(items[0]?.title).toBe("Zakupy dodały uwagi do 2 próśb");
    expect(items[0]?.subtitle).toBe("Sprawdź uwagi przy poszczególnych pozycjach");
  });

  it("nie duplikuje powiadomienia o uwagach gdy wiersz jest już w cancel_ack", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "n5",
          acknowledgeMode: "cancelled",
          statusTitle: "Anulowane",
          procurementCancelNote: "Anulowane — brak na stanie",
          maxNoteUpdatedAt: "2025-01-01T00:00:00Z",
          orderIds: ["o-n5"],
        }),
      ],
    });

    expect(snapshot.items.find((i) => i.source === "note_from_procurement")).toBeUndefined();
    expect(snapshot.items.find((i) => i.source === "cancel_ack")).toBeDefined();
  });

  it("uwzględnia note_from_procurement w totalActionCount", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "n6",
          requestNote: "Uwaga",
          maxNoteUpdatedAt: "2025-01-01T00:00:00Z",
          orderIds: ["o-n6"],
        }),
      ],
    });

    expect(snapshot.totalActionCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.cleared).toBe(false);
  });

  it("pokazuje subtitle fallback gdy notatka to agregat różnych notatek", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [
        row({
          id: "n7",
          supplierName: "Mikran",
          requestNote: "2 różnych notatek",
          maxNoteUpdatedAt: "2025-01-01T00:00:00Z",
          orderIds: ["o-n7"],
        }),
      ],
    });

    const item = snapshot.items.find((i) => i.source === "note_from_procurement");
    expect(item).toBeDefined();
    expect(item?.subtitle).toBe("Zakupy dodały uwagi — sprawdź przy pozycji");
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
