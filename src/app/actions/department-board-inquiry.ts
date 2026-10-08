"use server";

// „Zapytaj dostawcę” z wątku tablicy — mail z Gmaila osoby z zakupów (OAuth gmail.send, „jako ja”).
import { revalidatePath } from "next/cache";
import { requireOperations } from "@/lib/auth";
import { assertAdminPanelAllowsProcurementBoardMutations } from "@/lib/auth/guard-admin-panel-preview";
import { parseMailRecipients } from "@/lib/email/recipients";
import {
  buildSupplierInquiryDraft,
  pendingInquiryToSupplier,
  pendingSupplierInquiry,
  type BoardSupplierInquiry,
  type SupplierInquiryProduct,
} from "@/lib/department-board/supplier-inquiry";
import {
  listSupplierInquiries,
  loadInquirySupplierOptions,
  recordSupplierInquiry,
  type InquirySupplierOption,
} from "@/lib/department-board/supplier-inquiry-db";
import { query } from "@/lib/db/pool";
import { getGmailOAuthConfig } from "@/lib/google/gmail";
import {
  boardInquiryReplies,
  boardReplyForAi,
  getEmailSignature,
  getGmailConnection,
  sendGmailAsUser,
  type BoardInquiryReplies,
} from "@/lib/google/gmail-connections";
import { suggestAnswerFromSupplierReply } from "@/lib/department-board/supplier-reply-ai";
import { isCustomsAiConfigured, userFacingCustomsAiError } from "@/lib/customs/customs-ai";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

type InquiryThread = SupplierInquiryProduct & { subiekt_tw_id: number | null; archived_at: string | null };

async function loadQuestionThread(threadId: string): Promise<InquiryThread | null> {
  if (typeof threadId !== "string" || !/^[0-9a-f-]{36}$/i.test(threadId)) return null;
  const { rows } = await query<InquiryThread & { kind: string }>(
    `SELECT id, kind, title, product_name, product_symbol, mikran_code, subiekt_tw_id, archived_at
       FROM public.department_board_threads WHERE id = $1`,
    [threadId]
  );
  const row = rows[0];
  return row && row.kind === "question" ? row : null;
}

export type SupplierInquiryPrep =
  | {
      ok: true;
      gmail: { configured: boolean; email: string | null };
      suppliers: InquirySupplierOption[];
      suggestedIds: string[];
      /** Pytanie bez wybranego produktu — szkic bierze tytuł pytania (często ogólny: „Dostępność”). */
      productFromTitle: boolean;
      draftPl: { subject: string; body: string };
      draftEn: { subject: string; body: string };
      pending: BoardSupplierInquiry | null;
    }
  | { ok: false; message: string };

/** Dane do okienka: dostawcy z adresami, podpowiedź z przypisań towaru, szkic PL i EN z podpisem. */
export async function actionPrepareSupplierInquiry(threadId: string): Promise<SupplierInquiryPrep> {
  const user = await requireOperations("read");
  const thread = await loadQuestionThread(threadId);
  if (!thread) return { ok: false, message: "Nie znaleziono pytania." };
  const configured = Boolean(getGmailOAuthConfig());
  const [conn, signature, options, inquiries] = await Promise.all([
    configured ? getGmailConnection(user.id) : Promise.resolve(null),
    configured ? getEmailSignature(user.id) : Promise.resolve(""),
    loadInquirySupplierOptions(thread.subiekt_tw_id),
    listSupplierInquiries([thread.id]),
  ]);
  return {
    ok: true,
    gmail: { configured, email: conn?.email ?? null },
    ...options,
    productFromTitle: !thread.product_name?.trim() && !thread.product_symbol?.trim() && !thread.mikran_code?.trim(),
    draftPl: buildSupplierInquiryDraft({ product: thread, english: false, signature }),
    draftEn: buildSupplierInquiryDraft({ product: thread, english: true, signature }),
    pending: pendingSupplierInquiry(inquiries.get(thread.id)),
  };
}

export type SendSupplierInquiryResult =
  | { ok: true; from: string; to: string[]; supplierName: string; sentAt: string }
  | {
      ok: false;
      message: string;
      reconnect?: boolean;
      /** Zapytanie do tego dostawcy już czeka na odpowiedź. */
      alreadyPending?: BoardSupplierInquiry;
      /** Adresy spoza karty dostawcy — wysyłka dopiero po świadomym potwierdzeniu. */
      unknownRecipients?: string[];
    };

const SUBJECT_MAX = 300;
const BODY_MAX = 20_000;
const RECIPIENTS_MAX = 5;
/** ponytail: blokada w procesie (jeden serwer OnTime); przy kilku instancjach — lock w bazie. */
const sendingThreadIds = new Set<string>();

export async function actionSendSupplierInquiry(input: {
  threadId: string;
  supplierId: string;
  to: string;
  /** Kopia (DW), adresy rozdzielone przecinkiem. */
  cc?: string;
  subject: string;
  body: string;
  /** Świadome ponowne zapytanie, gdy poprzednie do tego dostawcy wciąż czeka. */
  resend?: boolean;
  /** Świadoma wysyłka na adres spoza karty dostawcy. */
  allowUnknownRecipients?: boolean;
}): Promise<SendSupplierInquiryResult> {
  const user = await requireOperations("mutate");
  await assertAdminPanelAllowsProcurementBoardMutations(user);
  if (
    typeof input.to !== "string" ||
    typeof input.subject !== "string" ||
    typeof input.body !== "string" ||
    (input.cc !== undefined && typeof input.cc !== "string")
  ) {
    return { ok: false, message: "Nieprawidłowe dane wiadomości." };
  }
  if (input.subject.length > SUBJECT_MAX || input.body.length > BODY_MAX) {
    return { ok: false, message: "Temat albo treść są za długie." };
  }
  const subject = input.subject.trim();
  if (!subject) return { ok: false, message: "Temat nie może być pusty." };
  if (!input.body.trim()) return { ok: false, message: "Treść nie może być pusta." };
  const recipients = parseMailRecipients(input.to, input.cc);
  if (!recipients.ok) return recipients;
  const { to: emails, cc } = recipients;
  if (emails.length > RECIPIENTS_MAX) return { ok: false, message: `Najwyżej ${RECIPIENTS_MAX} adresów dostawcy w jednym zapytaniu.` };

  const thread = await loadQuestionThread(input.threadId);
  if (!thread) return { ok: false, message: "Nie znaleziono pytania." };
  if (thread.archived_at) return { ok: false, message: "Wątek jest zamknięty — otwórz go ponownie, żeby zapytać dostawcę." };

  if (sendingThreadIds.has(thread.id)) return { ok: false, message: "Zapytanie właśnie się wysyła." };
  sendingThreadIds.add(thread.id);
  try {
    const { suppliers } = await loadInquirySupplierOptions(null);
    const supplier = suppliers.find((s) => s.id === input.supplierId);
    if (!supplier) return { ok: false, message: "Wybierz dostawcę z listy." };

    if (!input.resend) {
      const pending = pendingInquiryToSupplier((await listSupplierInquiries([thread.id])).get(thread.id), supplier.id);
      if (pending) {
        return { ok: false, message: `Zapytanie do ${supplier.name} już czeka na odpowiedź.`, alreadyPending: pending };
      }
    }
    // DW też — kopia do kolegi z Mikranu bez potwierdzenia.
    const unknownRecipients = [...emails, ...cc].filter(
      (e) => !supplier.emails.includes(e) && !/@mikran\.(com|pl)$/i.test(e)
    );
    if (unknownRecipients.length && !input.allowUnknownRecipients) {
      return {
        ok: false,
        message: `Adres spoza karty dostawcy ${supplier.name}: ${unknownRecipients.join(", ")}.`,
        unknownRecipients,
      };
    }

    const sent = await sendGmailAsUser({
      userId: user.id,
      to: emails,
      cc,
      subject,
      text: input.body,
      attachments: [],
      kind: "supplier_inquiry",
    });
    if (!sent.ok) return sent;
    // Mail już wyszedł — błąd zapisu śladu nie może wyglądać jak nieudana wysyłka.
    await recordSupplierInquiry({
      threadId: thread.id,
      supplierId: supplier.id,
      supplierName: supplier.name,
      sentBy: user.id,
      from: sent.from,
      to: emails,
      subject,
      gmailMessageId: sent.messageId,
      gmailThreadId: sent.threadId,
    }).catch((e) => console.error("[tablica] supplier_inquiry_emails", e));
    revalidatePath("/tablica");
    revalidatePath("/zakupy/tablica");
    return { ok: true, from: sent.from, to: emails, supplierName: supplier.name, sentAt: new Date().toISOString() };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wysłać zapytania.") };
  } finally {
    sendingThreadIds.delete(thread.id);
  }
}


// ─── Odpowiedź dostawcy w wątku pytania ───────────────────────────────────

/** Zapytania z tego wątku i odpowiedzi dostawców (pełna treść z Gmaila nadawcy). */
export async function actionBoardInquiryReplies(
  threadId: string
): Promise<{ ok: true; items: BoardInquiryReplies[]; aiAvailable: boolean } | { ok: false; message: string }> {
  const user = await requireOperations("read");
  const thread = await loadQuestionThread(threadId);
  if (!thread) return { ok: false, message: "Nie znaleziono pytania." };
  if (!getGmailOAuthConfig()) return { ok: true, items: [], aiAvailable: false };
  try {
    return { ok: true, items: await boardInquiryReplies(thread.id, user.id), aiAvailable: isCustomsAiConfigured() };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się odczytać odpowiedzi dostawcy z Gmaila.") };
  }
}

/**
 * Propozycja odpowiedzi dla handlowca z maila dostawcy. Treść maila czytana od nowa z Gmaila
 * (nie z przeglądarki) — AI dostaje tylko to, co naprawdę przyszło.
 */
export async function actionSuggestBoardAnswerFromSupplier(input: {
  threadId: string;
  inquiryId: string;
  replyId: string;
}): Promise<
  | { ok: true; answer: string; readPdfs: string[]; skippedPdfs: string[] }
  | { ok: false; message: string }
> {
  await requireOperations("read");
  const thread = await loadQuestionThread(input?.threadId);
  if (!thread) return { ok: false, message: "Nie znaleziono pytania." };
  if (!isCustomsAiConfigured()) return { ok: false, message: "AI jest wyłączone na serwerze (brak klucza Gemini)." };
  if (
    typeof input.inquiryId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(input.inquiryId) ||
    typeof input.replyId !== "string" ||
    !/^[0-9a-f]{6,40}$/i.test(input.replyId)
  ) {
    return { ok: false, message: "Nieprawidłowa odpowiedź dostawcy." };
  }
  let source;
  try {
    source = await boardReplyForAi({ threadId: thread.id, inquiryId: input.inquiryId, replyId: input.replyId });
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się odczytać odpowiedzi dostawcy z Gmaila.") };
  }
  if (!source) return { ok: false, message: "Nie znaleziono tej odpowiedzi dostawcy - odśwież wątek." };
  try {
    const { rows } = await query<{ body: string }>(
      `SELECT body FROM public.department_board_threads WHERE id = $1`,
      [thread.id]
    );
    const answer = await suggestAnswerFromSupplierReply(
      {
        title: thread.title,
        question: rows[0]?.body ?? "",
        product: [thread.product_name, thread.product_symbol || thread.mikran_code].filter(Boolean).join(" · ") || null,
        supplierName: source.supplierName,
        replyText: source.reply.text ?? source.reply.snippet,
        attachments: source.reply.attachments,
      },
      source.pdfs
    );
    return answer
      ? { ok: true, answer, readPdfs: source.pdfs.map((f) => f.filename), skippedPdfs: source.skippedPdfs }
      : { ok: false, message: "AI nie zaproponowało odpowiedzi. Spróbuj ponownie." };
  } catch (e) {
    return { ok: false, message: userFacingCustomsAiError(e) };
  }
}
