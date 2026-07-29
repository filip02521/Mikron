/** Helpery notatnika operacji — bezpieczne dla klienta (bez I/O Supabase). */

import { isFollowUpDue } from "@/lib/sales/notepad-follow-up";
import type { OperationsNote } from "@/types/database";
import { sortOperationsNotes } from "@/lib/operations/operations-note-sort";

export type OperationsNotepadData = {
  privateNotes: OperationsNote[];
  publicNotes: OperationsNote[];
  archivedNotes: OperationsNote[];
};

export function collectOperationsTodayTasks(
  privateNotes: OperationsNote[],
  publicNotes: OperationsNote[],
  userId: string
): OperationsNote[] {
  const due = [...privateNotes, ...publicNotes].filter((n) => {
    if (!isFollowUpDue(n.follow_up_at)) return false;
    if (n.visibility === "public") return true;
    return n.created_by === userId;
  });
  return sortOperationsNotes(due);
}
