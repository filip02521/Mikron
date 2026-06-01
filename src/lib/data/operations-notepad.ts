import { createAdminClient } from "@/lib/supabase/admin";
import { isFollowUpDue } from "@/lib/sales/notepad-follow-up";
import type { OperationsDepartment, OperationsNote } from "@/types/database";
import { sortOperationsNotes } from "@/lib/operations/operations-note-sort";

export const OPERATIONS_NOTE_SELECT = "*, author:profiles!created_by(email)";

export type OperationsNotepadData = {
  privateNotes: OperationsNote[];
  publicNotes: OperationsNote[];
  archivedNotes: OperationsNote[];
};

const NOTE_SELECT = OPERATIONS_NOTE_SELECT;

export async function fetchOperationsNotepad(
  department: OperationsDepartment,
  userId: string
): Promise<OperationsNotepadData> {
  const supabase = createAdminClient();

  const [privateRes, publicRes, archivedPrivateRes, archivedPublicRes] = await Promise.all([
    supabase
      .from("operations_notes")
      .select(NOTE_SELECT)
      .eq("department", department)
      .eq("visibility", "private")
      .eq("created_by", userId)
      .is("archived_at", null),
    supabase
      .from("operations_notes")
      .select(NOTE_SELECT)
      .eq("department", department)
      .eq("visibility", "public")
      .is("archived_at", null),
    supabase
      .from("operations_notes")
      .select(NOTE_SELECT)
      .eq("department", department)
      .eq("visibility", "private")
      .eq("created_by", userId)
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(80),
    supabase
      .from("operations_notes")
      .select(NOTE_SELECT)
      .eq("department", department)
      .eq("visibility", "public")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(80),
  ]);

  for (const res of [privateRes, publicRes, archivedPrivateRes, archivedPublicRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const archivedNotes = sortOperationsNotes([
    ...((archivedPrivateRes.data ?? []) as OperationsNote[]),
    ...((archivedPublicRes.data ?? []) as OperationsNote[]),
  ]).sort((a, b) => (b.archived_at ?? "").localeCompare(a.archived_at ?? ""));

  return {
    privateNotes: sortOperationsNotes((privateRes.data ?? []) as OperationsNote[]),
    publicNotes: sortOperationsNotes((publicRes.data ?? []) as OperationsNote[]),
    archivedNotes,
  };
}

/** Badge: przypomnienia na dziś (prywatne + publiczne w dziale użytkownika). */
export async function countOperationsNotepadBadge(
  userId: string,
  departments: OperationsDepartment[]
): Promise<number> {
  if (!departments.length) return 0;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("operations_notes")
    .select("id, visibility, created_by, follow_up_at, archived_at")
    .in("department", departments)
    .is("archived_at", null)
    .not("follow_up_at", "is", null);

  if (error) return 0;

  return (data ?? []).filter((row) => {
    if (!isFollowUpDue(row.follow_up_at)) return false;
    if (row.visibility === "public") return true;
    return row.created_by === userId;
  }).length;
}

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
