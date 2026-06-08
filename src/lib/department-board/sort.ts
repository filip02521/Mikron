import type { DepartmentBoardStatus, DepartmentBoardThread } from "@/types/database";

/** Ogłoszenia: przypięte na górze, potem data publikacji malejąco. */
export function sortAnnouncements<T extends Pick<DepartmentBoardThread, "pinned" | "published_at">>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.published_at.localeCompare(a.published_at);
  });
}

const STATUS_RANK: Record<DepartmentBoardStatus, number> = {
  open: 0,
  answered: 1,
  archived: 2,
};

/** Pytania: najpierw otwarte, potem data utworzenia malejąco. */
export function sortQuestions<
  T extends Pick<DepartmentBoardThread, "status" | "created_at">,
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    return b.created_at.localeCompare(a.created_at);
  });
}
