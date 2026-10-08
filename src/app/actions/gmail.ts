"use server";

// Wysyłka z Gmaila zalogowanej osoby (OAuth gmail.send) — zawsze „jako ja”, nigdy w czyimś imieniu.
// Odczyt (gmail.readonly) — wątki wysłanych ZD (karta dostawcy); maile od dostawców — Poczta dostawców (supplier-mail).
import { revalidatePath } from "next/cache";
import {
  getSessionUser,
  getSessionUserForMutation,
  requireZdEstimateAdmin,
  SESSION_REQUIRED_ERROR,
} from "@/lib/auth";
import { parseMailRecipients } from "@/lib/email/recipients";
import { normalizeEmailSignature } from "@/lib/email/signature";
import { isMikranEmail } from "@/lib/email/supplier-emails";
import { getGmailOAuthConfig } from "@/lib/google/gmail";
import {
  EMAIL_SIGNATURE_MAX,
  deleteGmailConnection,
  getEmailSignature,
  getGmailConnection,
  lastSupplierOrderEmail,
  resolveAwaitingSupplier,
  supplierOrderReplies,
  type AwaitingSupplierKind,
  type SupplierOrderReplies,
  recordSupplierOrderEmail,
  saveEmailSignature,
  sendGmailAsUser,
  type SupplierOrderEmail,
} from "@/lib/google/gmail-connections";
import { setSubiektOrdersZdTermin } from "@/lib/subiekt/api";
import { loadSupplierZd } from "@/lib/supplier-forms/prepare";
import { findSupplierFormTemplate } from "@/lib/supplier-forms/templates";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import { zdTerminError } from "@/lib/orders/zd-send-plan";
import { buildZdMailAttachment } from "@/lib/supplier-forms/zd-mail-attachment";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export type GmailStatus = { configured: boolean; email: string | null; signature: string };

export async function actionGmailStatus(): Promise<GmailStatus> {
  const user = await getSessionUser();
  if (!user) throw new Error(SESSION_REQUIRED_ERROR);
  if (!getGmailOAuthConfig()) return { configured: false, email: null, signature: "" };
  try {
    const [conn, signature] = await Promise.all([getGmailConnection(user.id), getEmailSignature(user.id)]);
    return { configured: true, email: conn?.email ?? null, signature };
  } catch (e) {
    // Niepełna migracja 172 — panel ZD w trybie ręcznym. Inny (chwilowy) błąd idzie dalej: panel zostaje
    // przy poprzednim stanie zamiast przełączać okno wysyłki w tryb ręczny w trakcie pracy.
    if (!(e instanceof Error && /google_mail_connections|email_signature/.test(e.message) && /does not exist|nie istnieje/.test(e.message))) {
      throw e;
    }
    console.error("[gmail] status", e);
    return { configured: false, email: null, signature: "" };
  }
}

export async function actionSaveEmailSignature(
  signature: string
): Promise<{ ok: true; signature: string } | { ok: false; message: string }> {
  const user = await getSessionUserForMutation();
  if (typeof signature !== "string") return { ok: false, message: "Nieprawidłowy podpis." };
  if (signature.length > EMAIL_SIGNATURE_MAX) {
    return { ok: false, message: `Podpis może mieć najwyżej ${EMAIL_SIGNATURE_MAX} znaków.` };
  }
  await saveEmailSignature(user.id, signature);
  return { ok: true, signature: normalizeEmailSignature(signature) };
}

/** UUID (dostawca, wiersz wysyłki). */
const SUPPLIER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Karta dostawcy: ZD wysłane z OnTime i odpowiedzi dostawcy w ich wątkach Gmaila. */
export async function actionSupplierOrderReplies(
  supplierId: string
): Promise<{ ok: true; items: SupplierOrderReplies[] } | { ok: false; message: string }> {
  const user = await requireZdEstimateAdmin("read");
  if (!getGmailOAuthConfig()) return { ok: true, items: [] };
  if (!SUPPLIER_ID_RE.test(String(supplierId ?? ""))) return { ok: false, message: "Nieprawidłowy dostawca." };
  try {
    return { ok: true, items: await supplierOrderReplies(supplierId, user.id) };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się sprawdzić odpowiedzi dostawcy.") };
  }
}

/** „Załatwione” — zdejmuje ZD / zapytanie z listy „Czeka na dostawcę” (np. potwierdzenie telefoniczne). */
export async function actionResolveAwaitingSupplier(input: {
  kind: AwaitingSupplierKind;
  id: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireZdEstimateAdmin("mutate");
  if ((input?.kind !== "zd" && input?.kind !== "inquiry") || !SUPPLIER_ID_RE.test(String(input?.id ?? ""))) {
    return { ok: false, message: "Nieprawidłowa pozycja." };
  }
  try {
    const done = await resolveAwaitingSupplier(input.kind, input.id, user.id);
    if (input.kind === "inquiry") revalidatePath("/zakupy/tablica");
    return done ? { ok: true } : { ok: false, message: "Ta pozycja jest już zamknięta." };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się zamknąć pozycji.") };
  }
}

/** Czy to ZD już poszło do dostawcy z OnTime (ostatnia wysyłka). */
export async function actionZdSupplierEmailSent(dokId: number): Promise<SupplierOrderEmail | null> {
  await requireZdEstimateAdmin("read");
  // Bez konfiguracji Gmaila nic nie wysłano z OnTime — nie pytaj bazy (działa też przed migracją 172).
  if (!getGmailOAuthConfig()) return null;
  const id = Math.trunc(Number(dokId));
  return id > 0 ? lastSupplierOrderEmail(id) : null;
}

export async function actionDisconnectGmail(): Promise<{ ok: true }> {
  const user = await getSessionUserForMutation();
  await deleteGmailConnection(user.id);
  return { ok: true };
}

export type SendZdToSupplierResult =
  | {
      ok: true;
      from: string;
      to: string[];
      cc: string[];
      attachmentName: string;
      sentAt: string;
      /** Nasz termin dostawy ustawiony zaraz po wysyłce (na serwerze — zamknięcie karty go nie gubi). */
      termin?: { ok: true; termin: string } | { ok: false; message: string };
    }
  | {
      ok: false;
      message: string;
      reconnect?: boolean;
      /** Połączenie zerwane po wysłaniu treści — nie wiadomo, czy mail wyszedł. */
      uncertain?: boolean;
      alreadySent?: SupplierOrderEmail;
      /** Adresy spoza karty dostawcy — wysyłka dopiero po świadomym potwierdzeniu. */
      unknownRecipients?: string[];
    };

const SUBJECT_MAX = 300;
const BODY_MAX = 20_000;
/** ponytail: blokada w procesie (jeden serwer OnTime); przy kilku instancjach — lock w bazie. */
const sendingDokIds = new Set<number>();

/**
 * ZD → mail do dostawcy z Gmaila użytkownika. Załącznik: formularz dostawcy (Wiedent, Sirona…)
 * albo wydruk ZD z Subiekta z terminem realizacji na dziś (nasz termin dostawy ustawia się po wysyłce).
 */
export async function actionSendZdToSupplier(input: {
  dokId: number;
  supplierId: string;
  to: string;
  /** Kopia (DW), adresy rozdzielone przecinkiem. */
  cc?: string;
  subject: string;
  body: string;
  /** Świadome ponowne wysłanie ZD, które już poszło. */
  resend?: boolean;
  /** Świadoma wysyłka na adres spoza karty dostawcy. */
  allowUnknownRecipients?: boolean;
  /** Nasz termin dostawy (YYYY-MM-DD) — trafia na ZD zaraz po wysłaniu maila. */
  terminAfterSend?: string;
}): Promise<SendZdToSupplierResult> {
  const user = await requireZdEstimateAdmin("mutate");
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
  const recipients = parseMailRecipients(input.to, input.cc);
  if (!recipients.ok) return recipients;
  const { to: emails, cc } = recipients;
  const subject = input.subject.trim();
  if (!subject) return { ok: false, message: "Temat nie może być pusty." };
  const dokId = Math.trunc(Number(input.dokId));
  if (!(dokId > 0)) return { ok: false, message: "Brak numeru ZD." };
  const terminAfterSend = typeof input.terminAfterSend === "string" ? input.terminAfterSend.trim() : "";
  const terminInvalid = terminAfterSend ? zdTerminError(terminAfterSend, todayDateKeyInWarsaw()) : null;
  if (terminInvalid) return { ok: false, message: terminInvalid };

  if (sendingDokIds.has(dokId)) return { ok: false, message: "To zamówienie właśnie się wysyła." };
  sendingDokIds.add(dokId);
  /** Termin sprzed wysyłki — wraca na ZD, gdy mail jednak nie wyszedł. */
  let restoreTermin: string | null = null;
  try {
    if (!input.resend) {
      const previous = await lastSupplierOrderEmail(dokId);
      if (previous) {
        return { ok: false, message: "To zamówienie zostało już wysłane.", alreadySent: previous };
      }
    }
    const zd = await loadSupplierZd({ dokId, supplierId: input.supplierId });
    if (!zd.ok) return zd;
    if (!zd.lines.length) return { ok: false, message: `${zd.dokNr} nie ma pozycji.` };
    // DW też — ZD (ceny) nie może pójść na obcy adres bez potwierdzenia; kopia do kolegi z Mikranu jest w porządku.
    const unknownRecipients = [...emails, ...cc].filter((e) => !zd.supplier.cardEmails.includes(e) && !isMikranEmail(e));
    if (unknownRecipients.length && !input.allowUnknownRecipients) {
      return {
        ok: false,
        message: `Adres spoza karty dostawcy ${zd.supplier.name}: ${unknownRecipients.join(", ")}.`,
        unknownRecipients,
      };
    }

    // Dostawca dostaje wydruk z terminem realizacji = dziś; nasz termin dostawy ustawiamy dopiero po wysyłce.
    let fresh = false;
    /** ZD z terminem, który faktycznie idzie na wydruk (odcisk wydruku w pamięci). */
    let printed = zd;
    if (!findSupplierFormTemplate(zd.supplier.name)) {
      const today = todayDateKeyInWarsaw();
      if (zd.termin !== today) {
        const printedTermin = await setSubiektOrdersZdTermin(dokId, today);
        // ZD bez terminu: po nieudanej wysyłce dostaje nasz termin dostawy (Subiekt nie umie wyczyścić pola),
        // a nie dzisiejszą datę z wydruku.
        restoreTermin = zd.termin ?? (terminAfterSend || null);
        if (printedTermin !== today) {
          throw new Error(`Subiekt zapisał termin ${printedTermin ?? "pusty"} zamiast dzisiejszego - wydruk ZD nie poszedł.`);
        }
        printed = { ...zd, termin: today };
        fresh = true;
      }
    }
    const attachment = await buildZdMailAttachment(printed, dokId, { fresh });

    const sent = await sendGmailAsUser({
      userId: user.id,
        to: emails,
      cc,
      subject,
      text: input.body,
      attachments: [attachment],
      kind: "supplier_order",
    });
    if (!sent.ok) {
      // Niepewne (mail mógł wyjść) — termin z wydruku zostaje; przywracamy tylko, gdy na pewno nie wyszedł.
      if (!sent.uncertain) await restoreZdTermin(dokId, restoreTermin);
      restoreTermin = null;
      return sent;
    }
    restoreTermin = null;
    // Mail już wyszedł — błąd zapisu śladu nie może wyglądać jak nieudana wysyłka. Ślad chroni przed
    // drugą wysyłką („już wysłane”), więc przy chwilowym błędzie bazy jedna ponowna próba.
    const record = () =>
      recordSupplierOrderEmail({
        dokId,
        dokNr: zd.dokNr,
        supplierId: zd.supplier.id,
        sentBy: user.id,
        from: sent.from,
        to: emails,
        attachmentName: attachment.filename,
        gmailMessageId: sent.messageId,
        gmailThreadId: sent.threadId,
      });
    await record()
      .catch(() => record())
      .catch((e) => console.error("[gmail] supplier_order_emails", e));
    const termin = terminAfterSend ? await setTerminAfterSend(dokId, terminAfterSend) : undefined;
    // Nowy wpis w logu wysyłek (/admin/wysylki).
    revalidatePath("/admin/wysylki");
    return {
      ok: true,
      from: sent.from,
      to: emails,
      cc,
      attachmentName: attachment.filename,
      sentAt: new Date().toISOString(),
      termin,
    };
  } catch (e) {
    await restoreZdTermin(dokId, restoreTermin);
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wysłać zamówienia.") };
  } finally {
    sendingDokIds.delete(dokId);
  }
}

async function setTerminAfterSend(
  dokId: number,
  date: string
): Promise<{ ok: true; termin: string } | { ok: false; message: string }> {
  try {
    const after = await setSubiektOrdersZdTermin(dokId, date);
    return after === date
      ? { ok: true, termin: after }
      : { ok: false, message: `Subiekt zapisał termin ${after ?? "pusty"} zamiast ${date}. Sprawdź ZD w Subiekcie.` };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się ustawić terminu realizacji w Subiekcie.") };
  }
}

/** Mail nie wyszedł — termin realizacji wraca do stanu sprzed wysyłki (best effort, błąd tylko w logu). */
async function restoreZdTermin(dokId: number, termin: string | null): Promise<void> {
  if (!termin) return;
  await setSubiektOrdersZdTermin(dokId, termin).catch((e) => console.error("[gmail] przywrócenie terminu ZD", dokId, e));
}
