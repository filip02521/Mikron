"use server";

// „Zapytaj dostawcę” z wątku tablicy — mail z Gmaila osoby z zakupów (OAuth gmail.send, „jako ja”).
import { revalidatePath } from "next/cache";
import { requireOperations } from "@/lib/auth";
import { assertAdminPanelAllowsProcurementBoardMutations } from "@/lib/auth/guard-admin-panel-preview";
import { parseEmailList } from "@/lib/customs/customs-email";
import {
  buildSupplierInquiryDraft,
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
import { getEmailSignature, getGmailConnection, sendGmailAsUser } from "@/lib/google/gmail-connections";
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
/** ponytail: blokada w procesie (jeden serwer OnTime); przy kilku instancjach — lock w bazie. */
const sendingThreadIds = new Set<string>();

export async function actionSendSupplierInquiry(input: {
  threadId: string;
  supplierId: string;
  to: string;
  subject: string;
  body: string;
  /** Świadome ponowne zapytanie, gdy poprzednie do tego dostawcy wciąż czeka. */
  resend?: boolean;
  /** Świadoma wysyłka na adres spoza karty dostawcy. */
  allowUnknownRecipients?: boolean;
}): Promise<SendSupplierInquiryResult> {
  const user = await requireOperations("mutate");
  await assertAdminPanelAllowsProcurementBoardMutations(user);
  if (typeof input.to !== "string" || typeof input.subject !== "string" || typeof input.body !== "string") {
    return { ok: false, message: "Nieprawidłowe dane wiadomości." };
  }
  if (input.subject.length > SUBJECT_MAX || input.body.length > BODY_MAX) {
    return { ok: false, message: "Temat albo treść są za długie." };
  }
  const subject = input.subject.trim();
  if (!subject) return { ok: false, message: "Temat nie może być pusty." };
  if (!input.body.trim()) return { ok: false, message: "Treść nie może być pusta." };
  const { emails, invalid } = parseEmailList(input.to);
  if (invalid.length) return { ok: false, message: `Błędny adres: ${invalid.join(", ")}` };
  if (!emails.length) return { ok: false, message: "Podaj adres e-mail dostawcy." };

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
      const pending = pendingSupplierInquiry((await listSupplierInquiries([thread.id])).get(thread.id));
      if (pending && pending.supplierName === supplier.name) {
        return { ok: false, message: `Zapytanie do ${supplier.name} już czeka na odpowiedź.`, alreadyPending: pending };
      }
    }
    const unknownRecipients = emails.filter((e) => !supplier.emails.includes(e));
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

