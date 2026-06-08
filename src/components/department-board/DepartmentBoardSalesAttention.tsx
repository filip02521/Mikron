import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";
import { DepartmentBoardUnreadBanner } from "@/components/department-board/DepartmentBoardUnreadBanner";
import { DepartmentBoardAnswersBanner } from "@/components/department-board/DepartmentBoardAnswersBanner";
import { DepartmentBoardPinnedStrip } from "@/components/department-board/DepartmentBoardPinnedStrip";

export function DepartmentBoardSalesAttention({
  attention,
  showPinned = true,
}: {
  attention: SalesBoardAttentionSnapshot;
  /** Na /moje pasek przypiętych jest też globalnie w AppShell — unikamy duplikatu. */
  showPinned?: boolean;
}) {
  const hasPinned = showPinned && attention.pinnedAnnouncements.length > 0;
  const hasUnread = attention.unreadAnnouncementCount > 0;
  const hasAnswers = attention.unseenAnswerCount > 0;

  if (!hasPinned && !hasUnread && !hasAnswers) return null;

  return (
    <div className="space-y-0">
      {hasPinned ? (
        <DepartmentBoardPinnedStrip pinned={attention.pinnedAnnouncements} />
      ) : null}
      {hasUnread ? (
        <DepartmentBoardUnreadBanner
          unreadCount={attention.unreadAnnouncementCount}
          latestTitle={attention.unreadAnnouncementLatestTitle}
        />
      ) : null}
      {hasAnswers ? (
        <DepartmentBoardAnswersBanner
          count={attention.unseenAnswerCount}
          preview={attention.unseenAnswerPreview}
        />
      ) : null}
    </div>
  );
}
