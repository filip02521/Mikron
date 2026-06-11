import { describe, expect, it } from "vitest";
import {
  shouldShowBoardAnswersBanner,
  shouldShowBoardUnreadBanner,
} from "@/lib/department-board/board-attention-banners";

const attention = {
  unseenAnswerCount: 2,
  unseenAnswerPreview: null,
  unreadAnnouncementBannerCount: 1,
  unreadAnnouncementBannerLatestTitle: "Test",
};

describe("board attention banners", () => {
  it("shows unread banner only off announcements tab", () => {
    expect(shouldShowBoardUnreadBanner(attention, "questions")).toBe(true);
    expect(shouldShowBoardUnreadBanner(attention, "announcements")).toBe(false);
    expect(
      shouldShowBoardUnreadBanner(
        { ...attention, unreadAnnouncementBannerCount: 0 },
        "questions"
      )
    ).toBe(false);
  });

  it("shows answers banner only off questions tab", () => {
    expect(shouldShowBoardAnswersBanner(attention, "announcements")).toBe(true);
    expect(shouldShowBoardAnswersBanner(attention, "questions")).toBe(false);
    expect(
      shouldShowBoardAnswersBanner({ ...attention, unseenAnswerCount: 0 }, "announcements")
    ).toBe(false);
  });
});
