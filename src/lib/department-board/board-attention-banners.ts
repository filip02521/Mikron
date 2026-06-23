import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";

export type DepartmentBoardAttentionBanners = Pick<
  SalesBoardAttentionSnapshot,
  "unseenAnswerCount" | "unseenAnswerPreview"
>;

export function shouldShowBoardAnswersBanner(
  attention: DepartmentBoardAttentionBanners
): boolean {
  return attention.unseenAnswerCount > 0;
}
