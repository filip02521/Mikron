"use server";

// Wysyłka z Gmaila zalogowanej osoby (OAuth gmail.send) — zawsze „jako ja”, nigdy w czyimś imieniu.
import {
  getSessionUser,
  getSessionUserForMutation,
  requireZdEstimateAdmin,
  SESSION_REQUIRED_ERROR,
} from "@/lib/auth";
import { parseEmailList } from "@/lib/customs/customs-email";
import { getGmailOAuthConfig } from "@/lib/google/gmail";
import {
  EMAIL_SIGNATURE_MAX,
  deleteGmailConnection,
  getEmailSignature,
  getGmailConnection,
  lastSupplierOrderEmail,
  recordSupplierOrderEmail,
  saveEmailSignature,
  sendGmailAsUser,
  type SupplierOrderEmail,
} from "@/lib/google/gmail-connections";
import { isZdSupplierAbroad } from "@/lib/orders/zd-estimate-post-create";
import { loadSupplierZd } from "@/lib/supplier-forms/prepare";
import { renderSupplierForm } from "@/lib/supplier-forms/render";
import { findSupplierFormTemplate } from "@/lib/supplier-forms/templates";
import { renderZdOrderPdf, zdOrderPdfFileName } from "@/lib/supplier-forms/zd-order-pdf";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import type { SupplierLocation } from "@/types/database";

export type GmailStatus = { configured: boolean; email: string | null; signature: string };

export async function actionGmailStatus(): Promise<GmailStatus> {
  const user = await getSessionUser();
  if (!user) throw new Error(SESSION_REQUIRED_ERROR);
  if (!getGmailOAuthConfig()) return { configured: false, email: null, signature: "" };
  const [conn, signature] = await Promise.all([getGmailConnection(user.id), getEmailSignature(user.id)]);
  return { configured: true, email: conn?.email ?? null, signature };
}

export async function actionSaveEmailSignature(signature: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getSessionUserForMutation();
  if (typeof signature !== "string") return { ok: false, message: "Nieprawidłowy podpis." };
  if (signature.length > EMAIL_SIGNATURE_MAX) {
    return { ok: false, message: `Podpis może mieć najwyżej ${EMAIL_SIGNATURE_MAX} znaków.` };
  }
  await saveEmailSignature(user.id, signature);
  return { ok: true };
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
  | { ok: true; from: string; to: string[]; attachmentName: string; sentAt: string }
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
 * albo PDF zamówienia z pozycji ZD (PL / EN wg lokalizacji dostawcy).
 */
export async function actionSendZdToSupplier(input: {
  dokId: number;
  supplierId: string;
  to: string;
  subject: string;
  body: string;
  /** Świadome ponowne wysłanie ZD, które już poszło. */
  resend?: boolean;
  /** Świadoma wysyłka na adres spoza karty dostawcy. */
  allowUnknownRecipients?: boolean;
}): Promise<SendZdToSupplierResult> {
  const user = await requireZdEstimateAdmin("mutate");
  if (typeof input.to !== "string" || typeof input.subject !== "string" || typeof input.body !== "string") {
    return { ok: false, message: "Nieprawidłowe dane wiadomości." };
  }
  if (input.subject.length > SUBJECT_MAX || input.body.length > BODY_MAX) {
    return { ok: false, message: "Temat albo treść są za długie." };
  }
  const { emails, invalid } = parseEmailList(input.to);
  if (invalid.length) return { ok: false, message: `Błędny adres: ${invalid.join(", ")}` };
  if (!emails.length) return { ok: false, message: "Podaj adres e-mail dostawcy." };
  const subject = input.subject.trim();
  if (!subject) return { ok: false, message: "Temat nie może być pusty." };
  const dokId = Math.trunc(Number(input.dokId));
  if (!(dokId > 0)) return { ok: false, message: "Brak numeru ZD." };

  if (sendingDokIds.has(dokId)) return { ok: false, message: "To zamówienie właśnie się wysyła." };
  sendingDokIds.add(dokId);
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
    const unknownRecipients = emails.filter((e) => !zd.supplier.cardEmails.includes(e));
    if (unknownRecipients.length && !input.allowUnknownRecipients) {
      return {
        ok: false,
        message: `Adres spoza karty dostawcy ${zd.supplier.name}: ${unknownRecipients.join(", ")}.`,
        unknownRecipients,
      };
    }

    const template = findSupplierFormTemplate(zd.supplier.name);
    const english = isZdSupplierAbroad(zd.supplier.location as SupplierLocation | null);
    const attachment = template
      ? await renderSupplierForm({
          ok: true,
          template,
          lines: zd.lines,
          date: zd.date,
          dokNr: zd.dokNr,
          supplierName: zd.supplier.name,
        }).then((f) => ({ filename: f.fileName, content: Buffer.from(f.bytes), contentType: f.contentType }))
      : {
          filename: zdOrderPdfFileName(zd.dokNr, english),
          content: Buffer.from(
            await renderZdOrderPdf({ dokNr: zd.dokNr, date: zd.date, supplierName: zd.supplier.name, lines: zd.lines, english })
          ),
          contentType: "application/pdf",
        };

    const sent = await sendGmailAsUser({
      userId: user.id,
      to: emails,
      subject,
      text: input.body,
      attachments: [attachment],
      kind: "supplier_order",
    });
    if (!sent.ok) return sent;
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
    }).catch((e) => console.error("[gmail] supplier_order_emails", e));
    return {
      ok: true,
      from: sent.from,
      to: emails,
      attachmentName: attachment.filename,
      sentAt: new Date().toISOString(),
    };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wysłać zamówienia.") };
  } finally {
    sendingDokIds.delete(dokId);
  }
}
