"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { getSessionUserForMutation } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-roles";
import { canMutateOperationsNote } from "@/lib/operations/operations-note-access";
import {
  OPERATIONS_NOTE_ARCHIVED_MUTATE_MESSAGE,
  OPERATIONS_NOTE_CONFLICT_MESSAGE,
  parseOperationsNoteColor,
  parseOperationsNoteFollowUpAt,
} from "@/lib/operations/operations-note-payload";
import { departmentsForRole } from "@/lib/operations/notepad-department";
import { OPERATIONS_NOTE_SELECT } from "@/lib/data/operations-notepad";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  OperationsDepartment,
  OperationsNote,
  OperationsNoteVisibility,
  SalesNoteColor,
  UserRole,
  Workspace,
} from "@/types/database";
import { UNDO_WINDOW_MS, undoExpiredServerMessage } from "@/lib/orders/daily-panel-undo";
import {
  resolveNoteCreateFields,
  resolveNoteUpdateContentFields,
} from "@/lib/sales/note-content";

function revalidateOperationsNotepad() {
  revalidatePath("/notatki");
  revalidatePath("/", "layout");
}

type NoteAccessRow = {
  id: string;
  created_by: string;
  department: OperationsDepartment;
  visibility: OperationsNoteVisibility;
  archived_at: string | null;
  updated_at: string;
  title: string | null;
};

function assertDepartmentAccess(
  department: OperationsDepartment,
  role: string | undefined,
  workspaces?: Workspace[]
): void {
  const allowed = departmentsForRole((role ?? "sales") as UserRole, workspaces);
  if (!allowed.includes(department)) {
    throw new Error("Brak dostępu do tego działu.");
  }
}

async function assertNoteAccess(noteId: string): Promise<NoteAccessRow & { userId: string; role: UserRole }> {
  const user = await getSessionUserForMutation();

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("operations_notes")
    .select("id, created_by, department, visibility, archived_at, updated_at, title")
    .eq("id", noteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("Nie znaleziono notatki.");

  assertDepartmentAccess(row.department, user.role, user.assignedWorkspaces);

  if (
    !canMutateOperationsNote({
      visibility: row.visibility as OperationsNoteVisibility,
      createdBy: row.created_by,
      userId: user.id,
      isAdmin: isAdmin(user.role),
    })
  ) {
    throw new Error("Brak uprawnień do tej notatki.");
  }

  return {
    ...(row as NoteAccessRow),
    userId: user.id,
    role: user.role,
  };
}

async function nextSortOrderForSection(
  department: OperationsDepartment,
  visibility: OperationsNoteVisibility
): Promise<number> {
  const supabase = createAdminClient();
  const { data: topNote } = await supabase
    .from("operations_notes")
    .select("sort_order")
    .eq("department", department)
    .eq("visibility", visibility)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (topNote?.sort_order ?? 0) - 1;
}

export async function actionCreateOperationsNote(
  department: OperationsDepartment,
  visibility: OperationsNoteVisibility,
  body: string,
  options?: { title?: string | null; color?: SalesNoteColor; follow_up_at?: string | null }
) {
  const user = await getSessionUserForMutation();
  assertDepartmentAccess(department, user.role, user.assignedWorkspaces);

  const { title, body: normalizedBody } = resolveNoteCreateFields({
    body,
    title: options?.title,
  });

  const color = options?.color !== undefined ? parseOperationsNoteColor(options.color) : "default";
  const followUp = parseOperationsNoteFollowUpAt(options?.follow_up_at);
  const sortOrder = await nextSortOrderForSection(department, visibility);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("operations_notes")
    .insert({
      department,
      visibility,
      created_by: user.id,
      title,
      body: normalizedBody,
      color,
      follow_up_at: followUp,
      sort_order: sortOrder,
    })
    .select(OPERATIONS_NOTE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  revalidateOperationsNotepad();
  return { note: data as OperationsNote };
}

export async function actionUpdateOperationsNote(
  noteId: string,
  payload: {
    body?: string;
    title?: string | null;
    color?: SalesNoteColor;
    pinned?: boolean;
    follow_up_at?: string | null;
    /** Wymagane przy zapisie treści — ochrona przed nadpisaniem cudzej edycji. */
    expectedUpdatedAt?: string;
  }
) {
  const row = await assertNoteAccess(noteId);
  if (row.archived_at) {
    throw new Error(OPERATIONS_NOTE_ARCHIVED_MUTATE_MESSAGE);
  }

  const contentPatch = resolveNoteUpdateContentFields({
    currentTitle: row.title,
    title: payload.title,
    body: payload.body,
  });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (contentPatch.title !== undefined) patch.title = contentPatch.title;
  if (contentPatch.body !== undefined) patch.body = contentPatch.body;
  if (payload.color !== undefined) patch.color = parseOperationsNoteColor(payload.color);
  if (payload.pinned !== undefined) patch.pinned = payload.pinned;
  if (payload.follow_up_at !== undefined) {
    patch.follow_up_at = parseOperationsNoteFollowUpAt(payload.follow_up_at);
  }

  const touchesContent =
    payload.body !== undefined ||
    payload.title !== undefined ||
    payload.color !== undefined ||
    payload.pinned !== undefined ||
    payload.follow_up_at !== undefined;

  const expectedUpdatedAt = payload.expectedUpdatedAt?.trim() || null;
  if (touchesContent && !expectedUpdatedAt) {
    throw new Error(OPERATIONS_NOTE_CONFLICT_MESSAGE);
  }

  const supabase = createAdminClient();
  let query = supabase.from("operations_notes").update(patch).eq("id", noteId).is("archived_at", null);
  if (expectedUpdatedAt) {
    query = query.eq("updated_at", expectedUpdatedAt);
  }

  const { data, error } = await query.select(OPERATIONS_NOTE_SELECT).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(OPERATIONS_NOTE_CONFLICT_MESSAGE);

  revalidateOperationsNotepad();
  return { note: data as OperationsNote };
}

export async function actionReorderOperationsNotes(
  department: OperationsDepartment,
  visibility: OperationsNoteVisibility,
  noteIds: string[],
  options?: { undoPerformedAt?: number }
) {
  const user = await getSessionUserForMutation();
  assertDepartmentAccess(department, user.role, user.assignedWorkspaces);
  if (!noteIds.length) return { success: true };

  if (options?.undoPerformedAt != null) {
    if (Date.now() - options.undoPerformedAt > UNDO_WINDOW_MS) {
      throw new Error(undoExpiredServerMessage("przy cofaniu kolejności notatek"));
    }
  }

  const uniqueIds = [...new Set(noteIds)];
  const supabase = createAdminClient();

  const { data: rows, error: fetchError } = await supabase
    .from("operations_notes")
    .select("id, created_by, department, visibility, archived_at")
    .in("id", uniqueIds);

  if (fetchError) throw new Error(fetchError.message);
  if (!rows || rows.length !== uniqueIds.length) {
    throw new Error("Nie znaleziono wszystkich notatek do zmiany kolejności.");
  }

  const admin = isAdmin(user.role);
  for (const row of rows) {
    if (row.archived_at) throw new Error("Nie można zmieniać kolejności zarchiwizowanych notatek.");
    if (row.department !== department || row.visibility !== visibility) {
      throw new Error("Notatki muszą być z tej samej sekcji.");
    }
    if (
      !canMutateOperationsNote({
        visibility: row.visibility as OperationsNoteVisibility,
        createdBy: row.created_by,
        userId: user.id,
        isAdmin: admin,
      })
    ) {
      throw new Error("Brak uprawnień do tej notatki.");
    }
  }

  const { count: activeCount, error: countError } = await supabase
    .from("operations_notes")
    .select("id", { count: "exact", head: true })
    .eq("department", department)
    .eq("visibility", visibility)
    .is("archived_at", null);

  if (countError) throw new Error(countError.message);
  if (activeCount !== uniqueIds.length) {
    throw new Error("Niekompletna lista notatek — odśwież stronę i spróbuj ponownie.");
  }

  const now = new Date().toISOString();
  for (let i = 0; i < uniqueIds.length; i++) {
    const { error } = await supabase
      .from("operations_notes")
      .update({ sort_order: i, updated_at: now })
      .eq("id", uniqueIds[i]!);
    if (error) throw new Error(error.message);
  }

  revalidateOperationsNotepad();
  return { success: true };
}

export async function actionArchiveOperationsNote(noteId: string) {
  const row = await assertNoteAccess(noteId);
  if (row.archived_at) {
    throw new Error("Notatka jest już w archiwum.");
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("operations_notes")
    .update({ archived_at: now, updated_at: now })
    .eq("id", noteId)
    .is("archived_at", null)
    .select(OPERATIONS_NOTE_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(OPERATIONS_NOTE_CONFLICT_MESSAGE);

  revalidateOperationsNotepad();
  return { note: data as OperationsNote };
}

export async function actionRestoreOperationsNote(
  noteId: string,
  options?: { enforceUndoWindow?: boolean }
) {
  const row = await assertNoteAccess(noteId);
  if (!row.archived_at) {
    throw new Error("Notatka nie jest w archiwum.");
  }

  if (options?.enforceUndoWindow) {
    const archivedAt = new Date(row.archived_at).getTime();
    if (Date.now() - archivedAt > UNDO_WINDOW_MS) {
      throw new Error(undoExpiredServerMessage("przy cofaniu archiwizacji notatki"));
    }
  }

  const sortOrder = await nextSortOrderForSection(row.department, row.visibility);
  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("operations_notes")
    .update({ archived_at: null, updated_at: now, sort_order: sortOrder })
    .eq("id", noteId)
    .not("archived_at", "is", null)
    .select(OPERATIONS_NOTE_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(OPERATIONS_NOTE_CONFLICT_MESSAGE);

  revalidateOperationsNotepad();
  return { note: data as OperationsNote };
}
