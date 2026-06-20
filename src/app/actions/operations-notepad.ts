"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { getSessionUser, getSessionUserForMutation } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-roles";
import { departmentsForRole } from "@/lib/operations/notepad-department";
import { OPERATIONS_NOTE_SELECT } from "@/lib/data/operations-notepad";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  OperationsDepartment,
  OperationsNote,
  OperationsNoteVisibility,
  SalesNoteColor,
} from "@/types/database";

function revalidateOperationsNotepad() {
  revalidatePath("/notatki");
  revalidatePath("/", "layout");
}

async function userIdForMutation(): Promise<string> {
  const user = await getSessionUserForMutation();
  return user.id;
}

async function assertNoteAccess(
  noteId: string,
  userId: string
): Promise<{ id: string; created_by: string; department: OperationsDepartment; visibility: OperationsNoteVisibility; archived_at: string | null }> {
  const user = await getSessionUser();
  if (!user?.id) throw new Error("Zaloguj się ponownie.");

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("operations_notes")
    .select("id, created_by, department, visibility, archived_at")
    .eq("id", noteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("Nie znaleziono notatki.");

  assertDepartmentAccess(row.department, user.role);

  if (row.created_by !== userId && !isAdmin(user.role)) {
    throw new Error("Brak uprawnień do tej notatki.");
  }

  return row as {
    id: string;
    created_by: string;
    department: OperationsDepartment;
    visibility: OperationsNoteVisibility;
    archived_at: string | null;
  };
}

function assertDepartmentAccess(
  department: OperationsDepartment,
  role: string | undefined
): void {
  const allowed = departmentsForRole((role ?? "sales") as import("@/types/database").UserRole);
  if (!allowed.includes(department)) {
    throw new Error("Brak dostępu do tego działu.");
  }
}

export async function actionCreateOperationsNote(
  department: OperationsDepartment,
  visibility: OperationsNoteVisibility,
  body: string,
  options?: { title?: string | null; color?: SalesNoteColor; follow_up_at?: string | null }
) {
  const user = await getSessionUserForMutation();
  assertDepartmentAccess(department, user.role);

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Notatka nie może być pusta.");

  const followUp = options?.follow_up_at?.trim().slice(0, 10) || null;
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

  const sortOrder = (topNote?.sort_order ?? 0) - 1;

  const { data, error } = await supabase
    .from("operations_notes")
    .insert({
      department,
      visibility,
      created_by: user.id,
      title: options?.title?.trim() || null,
      body: trimmed,
      color: options?.color ?? "default",
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
  }
) {
  const userId = await userIdForMutation();
  await assertNoteAccess(noteId, userId);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.body !== undefined) {
    const trimmed = payload.body.trim();
    if (!trimmed) throw new Error("Notatka nie może być pusta.");
    patch.body = trimmed;
  }
  if (payload.title !== undefined) patch.title = payload.title?.trim() || null;
  if (payload.color !== undefined) patch.color = payload.color;
  if (payload.pinned !== undefined) patch.pinned = payload.pinned;
  if (payload.follow_up_at !== undefined) {
    patch.follow_up_at = payload.follow_up_at?.trim().slice(0, 10) || null;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("operations_notes").update(patch).eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidateOperationsNotepad();
  return { success: true };
}

export async function actionReorderOperationsNotes(
  department: OperationsDepartment,
  visibility: OperationsNoteVisibility,
  noteIds: string[]
) {
  const userId = await userIdForMutation();
  const user = await getSessionUser();
  assertDepartmentAccess(department, user?.role);
  if (!noteIds.length) return { success: true };

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

  for (const row of rows) {
    if (row.archived_at) throw new Error("Nie można zmieniać kolejności zarchiwizowanych notatek.");
    if (row.department !== department || row.visibility !== visibility) {
      throw new Error("Notatki muszą być z tej samej sekcji.");
    }
    if (row.visibility === "private" && row.created_by !== userId && !isAdmin(user?.role ?? "sales")) {
      throw new Error("Brak uprawnień do tej notatki.");
    }
  }

  if (visibility === "public" && !isAdmin(user?.role ?? "sales")) {
    throw new Error("Kolejność tablicy publicznej może zmieniać tylko administrator.");
  }

  for (let i = 0; i < uniqueIds.length; i++) {
    const { error } = await supabase
      .from("operations_notes")
      .update({ sort_order: i, updated_at: new Date().toISOString() })
      .eq("id", uniqueIds[i]!);
    if (error) throw new Error(error.message);
  }

  revalidateOperationsNotepad();
  return { success: true };
}

export async function actionArchiveOperationsNote(noteId: string) {
  const userId = await userIdForMutation();
  await assertNoteAccess(noteId, userId);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("operations_notes")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", noteId);

  if (error) throw new Error(error.message);
  revalidateOperationsNotepad();
  return { success: true };
}

export async function actionRestoreOperationsNote(noteId: string) {
  const userId = await userIdForMutation();
  await assertNoteAccess(noteId, userId);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("operations_notes")
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .select(OPERATIONS_NOTE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  revalidateOperationsNotepad();
  return { note: data as OperationsNote };
}
