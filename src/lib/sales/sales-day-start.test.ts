import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";
import {
  buildSalesDayStartSnapshot,
  salesDayStartNavCount,
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
  it("grupuje odbiór po dostawcy i sumuje priorytety", () => {
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

    expect(snapshot.items.filter((i) => i.source === "pickup")).toHaveLength(2);
    expect(snapshot.items[0]?.source).toBe("pickup");
    expect(snapshot.items[0]?.count).toBe(3);
    expect(snapshot.items[0]?.title).toBe("Mikran");
    expect(snapshot.totalActionCount).toBe(3);
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

  it("cleared gdy brak akcji", () => {
    const snapshot = buildSalesDayStartSnapshot({ rows: [] });
    expect(snapshot.cleared).toBe(true);
    expect(snapshot.items).toHaveLength(0);
  });

  it("udostępnia przypięte ogłoszenia z tablicy", () => {
    const snapshot = buildSalesDayStartSnapshot({
      rows: [],
      boardAttention: {
        unreadAnnouncementCount: 0,
        unreadAnnouncementLatestTitle: null,
        unreadAnnouncementBannerCount: 0,
        unreadAnnouncementBannerLatestTitle: null,
        unreadAnnouncementBannerLatestId: null,
        unseenAnswerCount: 0,
        unseenAnswerPreview: null,
        unseenQuestionIds: [],
        pinnedAnnouncements: [
          {
            id: "a1",
            title: "Urlop w zakupach",
            body: "Biuro zamknięte w piątek",
            kind: "announcement",
            pinned: true,
          } as never,
          {
            id: "a2",
            title: "Nowy dostawca",
            body: "Procedura zamówień",
            kind: "announcement",
            pinned: true,
          } as never,
        ],
        navBadgeCount: 0,
      },
    });

    expect(snapshot.pinnedAnnouncements).toHaveLength(2);
    expect(snapshot.pinnedAnnouncements[0]?.title).toBe("Urlop w zakupach");
    expect(snapshot.pinnedAnnouncementOverflow).toBe(0);
  });

  it("ogranicza liczbę przypiętych ogłoszeń", () => {
    const pinned = Array.from({ length: 5 }, (_, i) => ({
      id: `a${i}`,
      title: `Ogłoszenie ${i}`,
      body: "Treść",
      kind: "announcement",
      pinned: true,
    }));

    const snapshot = buildSalesDayStartSnapshot({
      rows: [],
      boardAttention: {
        unreadAnnouncementCount: 0,
        unreadAnnouncementLatestTitle: null,
        unreadAnnouncementBannerCount: 0,
        unreadAnnouncementBannerLatestTitle: null,
        unreadAnnouncementBannerLatestId: null,
        unseenAnswerCount: 0,
        unseenAnswerPreview: null,
        unseenQuestionIds: [],
        pinnedAnnouncements: pinned as never,
        navBadgeCount: 0,
      },
    });

    expect(snapshot.pinnedAnnouncements).toHaveLength(3);
    expect(snapshot.pinnedAnnouncementOverflow).toBe(2);
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
