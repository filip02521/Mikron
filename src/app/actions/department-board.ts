"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import {
  assertAdminNotInReadOnlyPanelPreview,
  assertAdminPanelAllowsProcurementBoardMutations,
} from "@/lib/auth/guard-admin-panel-preview";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { canAccessOperations, isSalesAccount } from "@/lib/auth-roles";
import {
  DEPARTMENT_BOARD_POST_SELECT,
  DEPARTMENT_BOARD_THREAD_SELECT,
  type DepartmentBoardThreadRow,
} from "@/lib/data/department-board";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SalesNoteColor } from "@/types/database";
import {
  normalizeBoardQuestionProductInput,
  type BoardQuestionProductInput,
} from "@/lib/department-board/question-product";

function revalidateDepartmentBoard() {
  revalidatePath("/tablica");
  revalidatePath("/zakupy/tablica");
  revalidatePath("/moje");
  revalidatePath("/", "layout");
}

function trimTitle(title: string): string {
  return title.trim().slice(0, 200);
}

function trimBody(body: string): string {
  return body.trim().slice(0, 8000);
}

async function assertProcurementAccess(): Promise<string> {
  const user = await getSessionUser();
  if (!user?.id) throw new Error("Zaloguj się ponownie.");
  if (!canAccessOperations(user.role, user.assignedWorkspaces)) {
    throw new Error("Brak uprawnień do tablicy zakupów.");
  }
  await assertAdminPanelAllowsProcurementBoardMutations(user);
  return user.id;
}

async function assertSalesAccess(): Promise<{ userId: string; salesPersonId: string }> {
  const user = await getSessionUser();
  if (!user?.id) throw new Error("Zaloguj się ponownie.");
  if (!isSalesAccount(user.role)) {
    throw new Error("Brak uprawnień do tablicy.");
  }
  await assertAdminNotInReadOnlyPanelPreview(user);
  const salesPerson = await resolveSalesPersonForUser(user);
  if (!salesPerson?.id) {
    throw new Error(
      "Twoje konto nie jest przypisane do profilu handlowca. Poproś administratora o przypisanie."
    );
  }
  return { userId: user.id, salesPersonId: salesPerson.id };
}

async function fetchThread(threadId: string): Promise<DepartmentBoardThreadRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("department_board_threads")
    .select(DEPARTMENT_BOARD_THREAD_SELECT)
    .eq("id", threadId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nie znaleziono wpisu na tablicy.");
  return data as unknown as DepartmentBoardThreadRow;
}

export async function actionCreateAnnouncement(
  title: string,
  body: string,
  options?: {
    color?: SalesNoteColor;
    pinned?: boolean;
    expires_at?: string | null;
  }
) {
  const userId = await assertProcurementAccess();
  const trimmedTitle = trimTitle(title);
  const trimmedBody = trimBody(body);
  if (!trimmedTitle) throw new Error("Podaj tytuł ogłoszenia.");
  if (!trimmedBody) throw new Error("Treść ogłoszenia nie może być pusta.");

  const expiresRaw = options?.expires_at?.trim().slice(0, 10) || null;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("department_board_threads")
    .insert({
      kind: "announcement",
      status: "open",
      created_by: userId,
      sales_person_id: null,
      title: trimmedTitle,
      body: trimmedBody,
      color: options?.color ?? "default",
      pinned: options?.pinned ?? false,
      expires_at: expiresRaw ? `${expiresRaw}T23:59:59.999Z` : null,
    })
    .select(DEPARTMENT_BOARD_THREAD_SELECT)
    .single();

  if (error) throw new Error(error.message);
  revalidateDepartmentBoard();
  return { thread: data as unknown as DepartmentBoardThreadRow };
}

export async function actionArchiveAnnouncement(threadId: string) {
  await assertProcurementAccess();
  const thread = await fetchThread(threadId);
  if (thread.kind !== "announcement") {
    throw new Error("Można archiwizować tylko ogłoszenia.");
  }
  if (thread.archived_at) return { thread };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("department_board_threads")
    .update({
      archived_at: new Date().toISOString(),
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId)
    .select(DEPARTMENT_BOARD_THREAD_SELECT)
    .single();

  if (error) throw new Error(error.message);
  revalidateDepartmentBoard();
  return { thread: data as unknown as DepartmentBoardThreadRow };
}

export async function actionMarkAnnouncementRead(threadId: string) {
  const { userId } = await assertSalesAccess();
  const thread = await fetchThread(threadId);
  if (thread.kind !== "announcement") {
    throw new Error("Oznaczenie odczytu dotyczy tylko ogłoszeń.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("department_board_reads").upsert(
    {
      thread_id: threadId,
      profile_id: userId,
      read_at: new Date().toISOString(),
    },
    { onConflict: "thread_id,profile_id" }
  );

  if (error) throw new Error(error.message);
  revalidateDepartmentBoard();
  return { ok: true as const };
}

export async function actionMarkQuestionThreadSeen(threadId: string) {
  const { userId } = await assertSalesAccess();
  const thread = await fetchThread(threadId);
  if (thread.kind !== "question") {
    throw new Error("Oznaczenie odczytu dotyczy wątków pytań.");
  }
  if (thread.status !== "answered") {
    return { ok: true as const };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("department_board_reads").upsert(
    {
      thread_id: threadId,
      profile_id: userId,
      read_at: new Date().toISOString(),
    },
    { onConflict: "thread_id,profile_id" }
  );

  if (error) throw new Error(error.message);
  revalidateDepartmentBoard();
  return { ok: true as const };
}

export async function actionCreateQuestion(
  title: string,
  body: string,
  product?: BoardQuestionProductInput | null
) {
  const { userId, salesPersonId } = await assertSalesAccess();
  const trimmedTitle = trimTitle(title);
  const trimmedBody = trimBody(body);
  if (!trimmedTitle) throw new Error("Podaj temat pytania.");
  if (!trimmedBody) throw new Error("Treść pytania nie może być pusta.");

  const productFields = normalizeBoardQuestionProductInput(product);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("department_board_threads")
    .insert({
      kind: "question",
      status: "open",
      created_by: userId,
      sales_person_id: salesPersonId,
      title: trimmedTitle,
      body: trimmedBody,
      ...(productFields ?? {
        product_symbol: null,
        product_name: null,
        subiekt_tw_id: null,
        mikran_code: null,
      }),
    })
    .select(DEPARTMENT_BOARD_THREAD_SELECT)
    .single();

  if (error) throw new Error(error.message);
  revalidateDepartmentBoard();
  return { thread: data as unknown as DepartmentBoardThreadRow };
}

export async function actionReplyToQuestion(threadId: string, body: string) {
  const user = await getSessionUser();
  if (!user?.id) throw new Error("Zaloguj się ponownie.");

  const isProcurement = canAccessOperations(user.role, user.assignedWorkspaces);
  const isSales = isSalesAccount(user.role);
  if (!isProcurement && !isSales) {
    throw new Error("Brak uprawnień do tablicy.");
  }

  if (isSales) {
    await assertAdminNotInReadOnlyPanelPreview(user);
    const salesPerson = await resolveSalesPersonForUser(user);
    if (!salesPerson?.id) {
      throw new Error(
        "Twoje konto nie jest przypisane do profilu handlowca. Poproś administratora o przypisanie."
      );
    }
  }

  const trimmedBody = trimBody(body);
  if (!trimmedBody) throw new Error("Wiadomość nie może być pusta.");

  const thread = await fetchThread(threadId);
  if (thread.kind !== "question") {
    throw new Error("Odpowiedź można dodać tylko do pytania.");
  }
  if (thread.archived_at) {
    throw new Error("Ten wątek jest zakończony i nie można na niego odpowiadać.");
  }

  if (isSales && thread.created_by !== user.id) {
    throw new Error("Możesz odpowiadać tylko we własnych pytaniach.");
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: post, error: postError } = await supabase
    .from("department_board_posts")
    .insert({
      thread_id: threadId,
      created_by: user.id,
      body: trimmedBody,
    })
    .select(DEPARTMENT_BOARD_POST_SELECT)
    .single();

  if (postError) throw new Error(postError.message);

  // Procurement reply → answered; Sales reply (doprecyzowanie) → open
  const nextStatus = isProcurement ? "answered" as const : "open" as const;
  const firstProcurementReply = isProcurement && thread.status === "open";

  const { error: threadError } = await supabase
    .from("department_board_threads")
    .update({
      status: nextStatus,
      ...(firstProcurementReply ? { answered_at: now } : {}),
      updated_at: now,
    })
    .eq("id", threadId);

  if (threadError) throw new Error(threadError.message);

  revalidateDepartmentBoard();
  return { post };
}

export async function actionArchiveQuestion(threadId: string) {
  const userId = await assertProcurementAccess();
  const thread = await fetchThread(threadId);
  if (thread.kind !== "question") {
    throw new Error("Można archiwizować tylko pytania.");
  }
  if (thread.archived_at) return { thread };

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("department_board_threads")
    .update({
      archived_at: now,
      closed_by: userId,
      status: "archived",
      updated_at: now,
    })
    .eq("id", threadId)
    .select(DEPARTMENT_BOARD_THREAD_SELECT)
    .single();

  if (error) throw new Error(error.message);
  revalidateDepartmentBoard();
  return { thread: data as unknown as DepartmentBoardThreadRow };
}

export async function actionCloseQuestion(threadId: string) {
  const { userId } = await assertSalesAccess();
  const thread = await fetchThread(threadId);
  if (thread.kind !== "question") {
    throw new Error("Zamykanie dotyczy tylko pytań.");
  }
  if (thread.archived_at) return { thread };
  if (thread.created_by !== userId) {
    throw new Error("Możesz zamknąć tylko własne pytanie.");
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("department_board_threads")
    .update({
      archived_at: now,
      closed_by: userId,
      status: "archived",
      updated_at: now,
    })
    .eq("id", threadId)
    .select(DEPARTMENT_BOARD_THREAD_SELECT)
    .single();

  if (error) throw new Error(error.message);
  revalidateDepartmentBoard();
  return { thread: data as unknown as DepartmentBoardThreadRow };
}

export async function actionReopenQuestion(threadId: string) {
  const user = await getSessionUser();
  if (!user?.id) throw new Error("Zaloguj się ponownie.");

  const isProcurement = canAccessOperations(user.role, user.assignedWorkspaces);
  const isSales = isSalesAccount(user.role);
  if (!isProcurement && !isSales) {
    throw new Error("Brak uprawnień do tablicy.");
  }

  const thread = await fetchThread(threadId);
  if (thread.kind !== "question") {
    throw new Error("Ponowne otwarcie dotyczy tylko pytań.");
  }
  if (!thread.archived_at) return { thread };

  if (isSales && thread.created_by !== user.id) {
    throw new Error("Możesz otworzyć ponownie tylko własne pytanie.");
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const hasReplies = await supabase
    .from("department_board_posts")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);

  const nextStatus = (hasReplies.count ?? 0) > 0 ? "answered" as const : "open" as const;

  const { data, error } = await supabase
    .from("department_board_threads")
    .update({
      archived_at: null,
      closed_by: null,
      status: nextStatus,
      updated_at: now,
    })
    .eq("id", threadId)
    .select(DEPARTMENT_BOARD_THREAD_SELECT)
    .single();

  if (error) throw new Error(error.message);
  revalidateDepartmentBoard();
  return { thread: data as unknown as DepartmentBoardThreadRow };
}

export async function actionToggleAnnouncementPin(threadId: string, pinned: boolean) {
  await assertProcurementAccess();
  const thread = await fetchThread(threadId);
  if (thread.kind !== "announcement") {
    throw new Error("Przypięcie dotyczy tylko ogłoszeń.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("department_board_threads")
    .update({ pinned, updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .select(DEPARTMENT_BOARD_THREAD_SELECT)
    .single();

  if (error) throw new Error(error.message);
  revalidateDepartmentBoard();
  return { thread: data as unknown as DepartmentBoardThreadRow };
}
