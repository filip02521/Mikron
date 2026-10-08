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
import { buildZdMailAttachment } from "@/lib/supplier-forms/zd-mail-attachment";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

function isMikranEmail(email: string): boolean {
  return /@mikran\.(com|pl)$/i.test(email);
}

export type GmailStatus = { configured: boolean; email: string | null; signature: string };

export async function actionGmailStatus(): Promise<GmailStatus> {
  const user = await getSessionUser();
  if (!user) throw new Error(SESSION_REQUIRED_ERROR);
  if (!getGmailOAuthConfig()) return { configured: false, email: null, signature: "" };
  try {
    const [conn, signature] = await Promise.all([getGmailConnection(user.id), getEmailSignature(user.id)]);
    return { configured: true, email: conn?.email ?? null, signature };
  } catch (e) {
    // Np. niepełna migracja 172 — panel ZD przechodzi w tryb ręczny zamiast błędu przy każdym powrocie do karty.
    console.error("[gmail] status", e);
    return { configured: false, email: null, signature: "" };
  }
}

export async function actionSaveEmailSignature(signature: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getSessionUserForMutation();
  if (typeof signature !== "string") return { ok: false, message: "Nieprawidłowy podpis." };
  if (signature.length > EMAIL_SIGNATURE_MAX) {
    return { ok: false, message: `Podpis może mieć najwyżej ${EMAIL_SIGNATURE_MAX} znaków.` };
  }
  await saveEmailSignature(user.id, signature);
  revalidatePath("/ustawienia");
  return { ok: true };
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
  revalidatePath("/ustawienia");
  return { ok: true };
}

export type SendZdToSupplierResult =
  | { ok: true; from: string; to: string[]; cc: string[]; attachmentName: string; sentAt: string }
  | {
      ok: false;
      message: string;
      reconnect?: boolean;
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
        await setSubiektOrdersZdTermin(dokId, today);
        restoreTermin = zd.termin ?? null;
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
      await restoreZdTermin(dokId, restoreTermin);
      return sent;
    }
    restoreTermin = null;
    // Mail już wyszedł — błąd zapisu śladu nie może wyglądać jak nieudana wysyłka.
    await recordSupplierOrderEmail({
      dokId,
      dokNr: zd.dokNr,
      supplierId: zd.supplier.id,
      sentBy: user.id,
      from: sent.from,
      to: emails,
      attachmentName: attachment.filename,
      gmailMessageId: sent.messageId,
      gmailThreadId: sent.threadId,
    }).catch((e) => console.error("[gmail] supplier_order_emails", e));
    // Nowy wpis w logu wysyłek (/admin/wysylki).
    revalidatePath("/admin/wysylki");
    return {
      ok: true,
      from: sent.from,
      to: emails,
      cc,
      attachmentName: attachment.filename,
      sentAt: new Date().toISOString(),
    };
  } catch (e) {
    await restoreZdTermin(dokId, restoreTermin);
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wysłać zamówienia.") };
  } finally {
    sendingDokIds.delete(dokId);
  }
}

/** Mail nie wyszedł — termin realizacji wraca do stanu sprzed wysyłki (best effort, błąd tylko w logu). */
async function restoreZdTermin(dokId: number, termin: string | null): Promise<void> {
  if (!termin) return;
  await setSubiektOrdersZdTermin(dokId, termin).catch((e) => console.error("[gmail] przywrócenie terminu ZD", dokId, e));
}
