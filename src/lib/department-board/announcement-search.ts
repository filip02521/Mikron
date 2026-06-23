import type { DepartmentBoardThreadRow } from "@/lib/data/department-board";
import { authorLabelFromProfile } from "@/lib/department-board/format";

export function departmentBoardAnnouncementSearchHaystack(
  thread: DepartmentBoardThreadRow
): string {
  const parts = [thread.title, thread.body, authorLabelFromProfile(thread.author)];
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function filterDepartmentBoardAnnouncementsByQuery(
  announcements: DepartmentBoardThreadRow[],
  query: string
): DepartmentBoardThreadRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return announcements;
  return announcements.filter((thread) =>
    departmentBoardAnnouncementSearchHaystack(thread).includes(needle)
  );
}
