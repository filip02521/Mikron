import { describe, expect, it } from "vitest";
import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";
import { inboxNavBadgesFromLoadedData, type SalesInboxLoadedData } from "@/lib/sales/fetch-sales-inbox";

function boardAttention(
  overrides: Partial<SalesBoardAttentionSnapshot> = {}
): SalesBoardAttentionSnapshot {
  return {
    unreadAnnouncementCount: 0,
    unreadAnnouncementLatestTitle: null,
    unreadAnnouncementBannerCount: 0,
    unreadAnnouncementBannerLatestTitle: null,
    unreadAnnouncementBannerLatestId: null,
    unseenAnswerCount: 5,
    unseenOwnAnswerCount: 2,
    latestOwnAnswerActivityAt: null,
    unseenAnswerPreview: null,
    unseenQuestionIds: ["a", "b", "c", "d", "e"],
    unseenOwnQuestionIds: ["a", "b"],
    pinnedAnnouncements: [],
    navBadgeCount: 2,
    ...overrides,
  };
}

describe("inboxNavBadgesFromLoadedData", () => {
  it("badge Tablicy liczy tylko własne pytania z nową odpowiedzią, nie wszystkie wątki", () => {
    const data: SalesInboxLoadedData = {
      orders: [],
      statsRows: [],
      notepadSlice: { zkWatches: [], notes: [] },
      boardAttention: boardAttention(),
    };

    expect(inboxNavBadgesFromLoadedData(data).boardNavBadge).toBe(2);
  });

  it("gdy brak uwagi tablicy — badge Tablicy = 0", () => {
    const data: SalesInboxLoadedData = {
      orders: [],
      statsRows: [],
      notepadSlice: { zkWatches: [], notes: [] },
      boardAttention: null,
    };

    expect(inboxNavBadgesFromLoadedData(data).boardNavBadge).toBe(0);
  });
});
