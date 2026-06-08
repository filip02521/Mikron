import type { DepartmentBoardData } from "@/lib/data/department-board";

export function countUnreadAnnouncements(data: DepartmentBoardData): number {
  const readSet = new Set(data.readAnnouncementIds);
  return data.announcements.filter((a) => !readSet.has(a.id)).length;
}
