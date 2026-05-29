"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesAccount } from "@/lib/auth-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveZkByNumber } from "@/lib/subiekt/resolve-zk-document";
import type { SalesNote, SalesNoteColor, SalesPaymentWatch } from "@/types/database";

async function salesPersonIdForAction(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Wymagane logowanie");
  if (!isSalesAccount(user.role)) {
    throw new Error("Brak uprawnień do tej operacji.");
  }
  const resolved = await resolveSalesPersonForUser(user);
  if (!resolved) {
    throw new Error("Konto nie jest powiązane z kartą handlowca.");
  }
  return resolved.id;
}

function revalidateNotepad() {
  revalidatePath("/notatnik");
  revalidatePath("/", "layout");
}

function isDuplicateKeyError(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

/** Wpisz numer ZK — od razu dodaje obserwację z klientem i pełnym numerem. */
export async function actionAddPaymentWatchByZkNumber(
  zkQuery: string
): Promise<{ watch: SalesPaymentWatch }> {
  const salesPersonId = await salesPersonIdForAction();
  const resolved = await resolveZkByNumber(zkQuery);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("sales_payment_watches")
    .select("id, settled_at, archived_at")
    .eq("sales_person_id", salesPersonId)
    .eq("subiekt_dok_id", resolved.subiektDokId)
    .maybeSingle();

  if (existing && !existing.settled_at && !existing.archived_at) {
    throw new Error(`ZK ${resolved.zkNumber} jest już na liście oczekujących.`);
  }

  const row = {
    sales_person_id: salesPersonId,
    subiekt_dok_id: resolved.subiektDokId,
    zk_number: resolved.zkNumber,
    client_label: resolved.clientLabel,
    client_kh_id: resolved.clientKhId,
    amount_net: resolved.amountNet,
    amount_gross: resolved.amountGross,
    zk_issued_at: resolved.issuedAt,
    due_at: resolved.dueAt,
    line_summary: resolved.lineSummary,
    subiekt_snapshot: resolved.snapshot as unknown as Record<string, unknown>,
    settled_at: null,
    archived_at: null,
    updated_at: now,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("sales_payment_watches")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    revalidateNotepad();
    return { watch: data as SalesPaymentWatch };
  }

  const { data, error } = await supabase
    .from("sales_payment_watches")
    .insert({ ...row, created_at: now })
    .select("*")
    .single();

  if (error) {
    if (isDuplicateKeyError(error)) {
      throw new Error(`ZK ${resolved.zkNumber} jest już na liście oczekujących.`);
    }
    throw new Error(error.message);
  }

  revalidateNotepad();
  return { watch: data as SalesPaymentWatch };
}

export async function actionSettlePaymentWatch(watchId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error: fetchError } = await supabase
    .from("sales_payment_watches")
    .select("id, sales_person_id, settled_at")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (row.settled_at) throw new Error("Ten ZK został już oznaczony jako opłacony.");

  const { error } = await supabase
    .from("sales_payment_watches")
    .update({ settled_at: now, updated_at: now })
    .eq("id", watchId);

  if (error) throw new Error(error.message);
  revalidateNotepad();
  return { success: true };
}

export async function actionUpdatePaymentWatchNote(watchId: string, note: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const trimmed = note.trim() || null;

  const { data: row, error: fetchError } = await supabase
    .from("sales_payment_watches")
    .select("id, sales_person_id")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }

  const { error } = await supabase
    .from("sales_payment_watches")
    .update({ note: trimmed, updated_at: new Date().toISOString() })
    .eq("id", watchId);

  if (error) throw new Error(error.message);
  revalidateNotepad();
  return { success: true };
}

export async function actionCreateSalesNote(
  body: string,
  options?: { title?: string | null; color?: SalesNoteColor }
) {
  const salesPersonId = await salesPersonIdForAction();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Notatka nie może być pusta.");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_notes")
    .insert({
      sales_person_id: salesPersonId,
      title: options?.title?.trim() || null,
      body: trimmed,
      color: options?.color ?? "default",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateNotepad();
  return { note: data as SalesNote };
}

export async function actionUpdateSalesNote(
  noteId: string,
  payload: { body?: string; title?: string | null; color?: SalesNoteColor; pinned?: boolean }
) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();

  const { data: row, error: fetchError } = await supabase
    .from("sales_notes")
    .select("id, sales_person_id")
    .eq("id", noteId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono notatki.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tej notatki.");
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.body !== undefined) {
    const trimmed = payload.body.trim();
    if (!trimmed) throw new Error("Notatka nie może być pusta.");
    patch.body = trimmed;
  }
  if (payload.title !== undefined) patch.title = payload.title?.trim() || null;
  if (payload.color !== undefined) patch.color = payload.color;
  if (payload.pinned !== undefined) patch.pinned = payload.pinned;

  const { error } = await supabase.from("sales_notes").update(patch).eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidateNotepad();
  return { success: true };
}

export async function actionArchiveSalesNote(noteId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error: fetchError } = await supabase
    .from("sales_notes")
    .select("id, sales_person_id")
    .eq("id", noteId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono notatki.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tej notatki.");
  }

  const { error } = await supabase
    .from("sales_notes")
    .update({ archived_at: now, updated_at: now })
    .eq("id", noteId);

  if (error) throw new Error(error.message);
  revalidateNotepad();
  return { success: true };
}

export async function actionRestoreSalesNote(noteId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error: fetchError } = await supabase
    .from("sales_notes")
    .select("id, sales_person_id, archived_at")
    .eq("id", noteId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono notatki.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tej notatki.");
  }
  if (!row.archived_at) throw new Error("Notatka nie jest w archiwum.");

  const { data, error } = await supabase
    .from("sales_notes")
    .update({ archived_at: null, updated_at: now })
    .eq("id", noteId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateNotepad();
  return { note: data as SalesNote };
}
