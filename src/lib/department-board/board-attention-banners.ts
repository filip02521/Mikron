import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";

export type DepartmentBoardAttentionBanners = Pick<
  SalesBoardAttentionSnapshot,
  | "unseenAnswerCount"
  | "unseenAnswerPreview"
  | "unreadAnnouncementBannerCount"
  | "unreadAnnouncementBannerLatestTitle"
>;

export function shouldShowBoardAnswersBanner(
  attention: DepartmentBoardAttentionBanners,
  activeTab: "announcements" | "questions"
): boolean {
  return attention.unseenAnswerCount > 0 && activeTab !== "questions";
}

export function shouldShowBoardUnreadBanner(
  attention: DepartmentBoardAttentionBanners,
  activeTab: "announcements" | "questions"
): boolean {
  return attention.unreadAnnouncementBannerCount > 0 && activeTab !== "announcements";
}
