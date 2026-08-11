"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import {
  assertAdminNotInReadOnlyPanelPreview,
  assertAdminPanelAllowsProcurementBoardMutations,
} from "@/lib/auth/guard-admin-panel-preview";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { canAccessOperations, isAdmin, isSalesAccount } from "@/lib/auth-roles";
import {
  DEPARTMENT_BOARD_POST_SELECT,
  DEPARTMENT_BOARD_THREAD_SELECT,
  type DepartmentBoardThreadRow,
} from "@/lib/data/department-board";
import { notifyBoardQuestionReplyToSales } from "@/lib/department-board/notify-board-reply";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SalesNoteColor } from "@/types/database";
import {
  BOARD_IMAGE_BUCKET,
  boardImageStoragePrefix,
  isBoardImageStoragePath,
  looksLikeBoardImageBytes,
  validateBoardImageBatch,
  validateBoardImageFile,
} from "@/lib/department-board/attachments";
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
  product?: BoardQuestionProductInput | null,
  images?: File[] | null
) {
  const { userId, salesPersonId } = await assertSalesAccess();
  const trimmedTitle = trimTitle(title);
  const trimmedBody = trimBody(body);
  if (!trimmedTitle) throw new Error("Podaj temat pytania.");
  if (!trimmedBody) throw new Error("Treść pytania nie może być pusta.");

  const imageFiles = (images ?? []).filter(Boolean);
  const batchError = validateBoardImageBatch(imageFiles.length);
  if (batchError) throw new Error(batchError);
  for (const file of imageFiles) {
    const fileError = validateBoardImageFile(file);
    if (fileError) throw new Error(fileError);
  }

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
  const thread = data as unknown as DepartmentBoardThreadRow;

  let attachmentError: string | undefined;
  let attachmentsUploaded = 0;

  if (imageFiles.length) {
    const { hasSupabaseConfig } = await import("@/lib/supabase/admin");
    if (!hasSupabaseConfig()) {
      revalidateDepartmentBoard();
      return {
        thread,
        attachmentsUploaded: 0,
        attachmentError:
          "Pytanie zapisano, ale brak konfiguracji Storage — zdjęcia nie zostały dodane.",
      };
    }
    const upload = await uploadBoardQuestionImages({
      supabase,
      threadId: thread.id,
      userId,
      files: imageFiles,
    });
    attachmentsUploaded = upload.uploaded;
    attachmentError = upload.error;
  }

  revalidateDepartmentBoard();
  return {
    thread,
    attachmentsUploaded,
    attachmentError,
  };
}

async function uploadBoardQuestionImages(input: {
  supabase: ReturnType<typeof createAdminClient>;
  threadId: string;
  userId: string;
  files: File[];
}): Promise<{ uploaded: number; error?: string }> {
  const { randomUUID } = await import("crypto");
  const uploadedPaths: string[] = [];
  const rows: Array<{
    thread_id: string;
    created_by: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    byte_size: number;
    sort_order: number;
  }> = [];

  try {
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i]!;
      const ext =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";
      const mime =
        file.type === "image/png" || file.type === "image/webp"
          ? file.type
          : "image/jpeg";
      const storagePath = `${boardImageStoragePrefix(input.threadId)}${randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!looksLikeBoardImageBytes(buffer, mime)) {
        throw new Error("Plik nie wygląda na prawidłowe zdjęcie.");
      }
      const { error: uploadError } = await input.supabase.storage
        .from(BOARD_IMAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mime,
          upsert: false,
        });
      if (uploadError) {
        throw new Error(uploadError.message);
      }
      uploadedPaths.push(storagePath);
      rows.push({
        thread_id: input.threadId,
        created_by: input.userId,
        storage_path: storagePath,
        file_name: file.name.slice(0, 200) || `zdjecie-${i + 1}.${ext}`,
        mime_type: mime,
        byte_size: buffer.byteLength,
        sort_order: i,
      });
    }

    const { error: insertError } = await input.supabase
      .from("department_board_thread_attachments")
      .insert(rows);
    if (insertError) {
      throw new Error(insertError.message);
    }
    return { uploaded: rows.length };
  } catch (e) {
    if (uploadedPaths.length) {
      await input.supabase.storage
        .from(BOARD_IMAGE_BUCKET)
        .remove(uploadedPaths)
        .catch(() => {});
    }
    const message =
      e instanceof Error ? e.message.replace(/\n|\r/g, "") : "upload failed";
    console.error("[board-images] upload failed", message);
    return {
      uploaded: 0,
      error:
        "Pytanie zapisano, ale nie udało się dodać zdjęć. Spróbuj ponownie w nowym pytaniu.",
    };
  }
}

/** Signed URL do podglądu zdjęcia z pytania (handlowiec / zakupy / admin). */
export async function actionGetBoardQuestionImageUrl(
  attachmentId: string
): Promise<{ url: string | null; error?: string }> {
  const user = await getSessionUser();
  if (!user?.id) return { url: null, error: "Zaloguj się ponownie." };
  const canRead =
    isAdmin(user.role) ||
    canAccessOperations(user.role, user.assignedWorkspaces) ||
    isSalesAccount(user.role);
  if (!canRead) return { url: null, error: "Brak uprawnień." };

  const id = attachmentId?.trim();
  if (!id) return { url: null, error: "Brak załącznika." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("department_board_thread_attachments")
    .select("id, storage_path, thread_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data?.storage_path) {
    return { url: null, error: "Nie znaleziono zdjęcia." };
  }
  if (!isBoardImageStoragePath(data.storage_path, data.thread_id)) {
    return { url: null, error: "Nieprawidłowa ścieżka zdjęcia." };
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(BOARD_IMAGE_BUCKET)
    .createSignedUrl(data.storage_path, 3600);

  if (signedError || !signed?.signedUrl) {
    return { url: null, error: "Nie udało się otworzyć zdjęcia." };
  }
  return { url: signed.signedUrl };
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

  if (isProcurement) {
    await assertAdminPanelAllowsProcurementBoardMutations(user);
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
  // Przy podwójnej roli (handlowiec + zakupy) doprecyzowanie własnego pytania
  // traktujemy jak odpowiedź handlowca — bez statusu „answered” i bez maila.
  const isAskerClarification = isSales && thread.created_by === user.id;
  const countsAsProcurementReply = isProcurement && !isAskerClarification;
  const nextStatus = countsAsProcurementReply ? ("answered" as const) : ("open" as const);
  const firstProcurementReply =
    countsAsProcurementReply && thread.status === "open";

  const { error: threadError } = await supabase
    .from("department_board_threads")
    .update({
      status: nextStatus,
      ...(firstProcurementReply ? { answered_at: now } : {}),
      updated_at: now,
    })
    .eq("id", threadId);

  if (threadError) throw new Error(threadError.message);

  // Tylko odpowiedź zakupów → e-mail do handlowca (doprecyzowanie handlowca bez maila).
  // Await (nie after+void): wcześniej floating Promise w after() bywał ucinany po
  // zakończeniu Server Action — odpowiedź zapisywała się, mail nie wychodził.
  // Błąd SMTP nie cofa zapisu odpowiedzi.
  if (countsAsProcurementReply) {
    try {
      const result = await notifyBoardQuestionReplyToSales({
        threadId,
        salesPersonId: thread.sales_person_id,
        createdByProfileId: thread.created_by,
        questionTitle: thread.title,
        questionBody: thread.body,
        productSymbol: thread.product_symbol,
        productName: thread.product_name,
        replyBody: trimmedBody,
      });
      if (!result.emailSent) {
        console.warn(
          "[board-reply-email] not sent",
          String(threadId).replace(/\n|\r/g, ""),
          String(result.skippedReason ?? result.error ?? "unknown").replace(
            /\n|\r/g,
            ""
          )
        );
      }
    } catch (err) {
      console.error(
        "[board-reply-email] notify failed",
        String(threadId).replace(/\n|\r/g, ""),
        err instanceof Error ? err.message.replace(/\n|\r/g, "") : "unknown"
      );
    }
  }

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

/** Trwałe usunięcie zakończonego wątku — tylko administrator. */
export async function actionDeleteClosedQuestion(threadId: string) {
  const user = await getSessionUser();
  if (!user?.id) throw new Error("Zaloguj się ponownie.");
  if (!isAdmin(user.role)) {
    throw new Error("Tylko administrator może trwale usuwać zakończone wątki.");
  }
  await assertAdminPanelAllowsProcurementBoardMutations(user);

  const thread = await fetchThread(threadId);
  if (thread.kind !== "question") {
    throw new Error("Usuwanie dotyczy tylko pytań.");
  }
  if (!thread.archived_at) {
    throw new Error("Można usuwać tylko zakończone wątki.");
  }

  const supabase = createAdminClient();

  // Najpierw Storage — CASCADE w DB skasuje wiersze attachments, ale nie obiekty w buckecie.
  const { data: attachmentRows } = await supabase
    .from("department_board_thread_attachments")
    .select("storage_path")
    .eq("thread_id", threadId);
  const paths = (attachmentRows ?? [])
    .map((r) => r.storage_path)
    .filter((p): p is string => Boolean(p?.trim()));
  if (paths.length) {
    await supabase.storage.from(BOARD_IMAGE_BUCKET).remove(paths).catch(() => {});
  }

  const { error } = await supabase.from("department_board_threads").delete().eq("id", threadId);

  if (error) throw new Error(error.message);
  revalidateDepartmentBoard();
  return { ok: true as const };
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
