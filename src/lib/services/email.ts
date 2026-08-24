import {
  getEmailFromAddress,
  getEmailOverrideTo,
  isEmailConfigured,
} from "@/lib/env/email-config";
import type { SalesPersonEmailBatch } from "@/lib/email/sales-notification-types";
import {
  renderDeliveryArrivedEmail,
  renderInformacjaArrivedEmail,
  renderProcurementCancelEmail,
  renderRequestNoteUpdateEmail,
  renderBoardQuestionReplyEmail,
} from "@/lib/email/sales-email-templates";
import { sendMailRaw } from "@/lib/services/smtp-transport";
import { recordTransactionalEmailLog } from "@/lib/services/transactional-email-log";
import type { TransactionalEmailKind } from "@/types/database";

const EMAIL_NOT_CONFIGURED_ERROR =
  "Brak konfiguracji SMTP / EMAIL_FROM — ustaw SMTP_HOST, SMTP_USER, SMTP_PASS oraz EMAIL_FROM lub EMAIL_DOMAIN (i zrestartuj serwer)";

export type EmailSendResult = {
  sent: number;
  failures: { to: string; error: string }[];
};

export async function sendHtmlEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  kind?: TransactionalEmailKind;
}): Promise<{ ok: true; id: string } | { ok: false; error: string; to: string }> {
  const kind: TransactionalEmailKind = params.kind ?? "generic";
  // Przy tablicy `to` wysyłamy tylko pierwszy adres (historyczna parity API).
  const intendedTo = Array.isArray(params.to) ? params.to[0]! : params.to;
  const overrideTo = getEmailOverrideTo();
  const to = overrideTo ?? intendedTo;
  const subject = overrideTo
    ? `[TEST → ${intendedTo}] ${params.subject}`
    : params.subject;
  const fromAddress = getEmailFromAddress();

  if (!isEmailConfigured()) {
    await recordTransactionalEmailLog({
      kind,
      status: "failed",
      toAddresses: [to],
      intendedTo: [intendedTo],
      overrideTo: overrideTo ?? null,
      fromAddress,
      subject,
      htmlBody: params.html,
      errorMessage: EMAIL_NOT_CONFIGURED_ERROR,
    });
    return { ok: false, error: EMAIL_NOT_CONFIGURED_ERROR, to };
  }

  try {
    const { messageId } = await sendMailRaw({
      from: fromAddress,
      to,
      subject,
      html: params.html,
    });
    await recordTransactionalEmailLog({
      kind,
      status: "sent",
      toAddresses: [to],
      intendedTo: [intendedTo],
      overrideTo: overrideTo ?? null,
      fromAddress,
      subject,
      htmlBody: params.html,
      messageId,
    });
    return { ok: true, id: messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordTransactionalEmailLog({
      kind,
      status: "failed",
      toAddresses: [to],
      intendedTo: [intendedTo],
      overrideTo: overrideTo ?? null,
      fromAddress,
      subject,
      htmlBody: params.html,
      errorMessage: message,
    });
    return { ok: false, error: message, to };
  }
}

/**
 * Załącznik e-mail.
 * `content` — string w Base64 (dekodowany do Buffer w transporcie SMTP).
 */
export type EmailAttachmentInput = {
  filename: string;
  content: string;
  contentType?: string;
};

export type MultiRecipientEmailParams = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  attachments?: EmailAttachmentInput[];
  kind?: TransactionalEmailKind;
};

export async function sendHtmlEmailWithAttachments(
  params: MultiRecipientEmailParams
): Promise<
  | { ok: true; id: string; deliveredTo: string[] }
  | { ok: false; error: string; intendedTo: string[] }
> {
  const kind: TransactionalEmailKind = params.kind ?? "attachments";
  const intendedTo = params.to.filter(Boolean);
  const intendedCc = (params.cc ?? []).filter(Boolean);
  const intendedBcc = (params.bcc ?? []).filter(Boolean);
  const fromAddress = getEmailFromAddress();
  const attachmentNames = (params.attachments ?? []).map((a) => a.filename);

  if (!intendedTo.length) {
    return { ok: false, error: "Brak odbiorców TO", intendedTo: [] };
  }

  const overrideTo = getEmailOverrideTo();
  const to = overrideTo ? [overrideTo] : intendedTo;
  const cc = overrideTo ? [] : intendedCc;
  const bcc = overrideTo ? [] : intendedBcc;
  const subject = overrideTo
    ? `[TEST → ${intendedTo.join(", ")}] ${params.subject}`
    : params.subject;

  if (!isEmailConfigured()) {
    await recordTransactionalEmailLog({
      kind,
      status: "failed",
      toAddresses: to,
      ccAddresses: cc,
      bccAddresses: bcc,
      intendedTo,
      overrideTo: overrideTo ?? null,
      fromAddress,
      subject,
      htmlBody: params.html,
      errorMessage: EMAIL_NOT_CONFIGURED_ERROR,
      hasAttachments: attachmentNames.length > 0,
      attachmentNames,
    });
    return { ok: false, error: EMAIL_NOT_CONFIGURED_ERROR, intendedTo };
  }

  const attachments = (params.attachments ?? []).map((a) => ({
    filename: a.filename,
    content: Buffer.from(a.content, "base64"),
    contentType:
      a.contentType ??
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));

  try {
    const { messageId } = await sendMailRaw({
      from: fromAddress,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      subject,
      html: params.html,
      attachments: attachments.length ? attachments : undefined,
    });
    await recordTransactionalEmailLog({
      kind,
      status: "sent",
      toAddresses: to,
      ccAddresses: cc,
      bccAddresses: bcc,
      intendedTo,
      overrideTo: overrideTo ?? null,
      fromAddress,
      subject,
      htmlBody: params.html,
      messageId,
      hasAttachments: attachmentNames.length > 0,
      attachmentNames,
    });
    return { ok: true, id: messageId, deliveredTo: to };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordTransactionalEmailLog({
      kind,
      status: "failed",
      toAddresses: to,
      ccAddresses: cc,
      bccAddresses: bcc,
      intendedTo,
      overrideTo: overrideTo ?? null,
      fromAddress,
      subject,
      htmlBody: params.html,
      errorMessage: message,
      hasAttachments: attachmentNames.length > 0,
      attachmentNames,
    });
    return { ok: false, error: message, intendedTo };
  }
}

export async function sendDeliveryNotificationEmails(
  notifications: Map<string, SalesPersonEmailBatch>
): Promise<EmailSendResult> {
  const result: EmailSendResult = { sent: 0, failures: [] };

  for (const { email, name, items } of notifications.values()) {
    const deliveryItems = items.filter((i) => i.kind === "delivery");
    if (!deliveryItems.length) continue;
    const to = email.trim();
    if (!to) {
      result.failures.push({ to: "(brak adresu)", error: "Handlowiec bez e-maila w bazie" });
      continue;
    }

    const { subject, html } = renderDeliveryArrivedEmail({
      recipientName: name,
      items: deliveryItems,
    });

    const send = await sendHtmlEmail({
      to,
      subject,
      html,
      kind: "delivery",
    });

    if (send.ok) {
      result.sent++;
    } else {
      result.failures.push({ to, error: send.error });
    }
  }

  return result;
}

/** E-mail do handlowca: prośba informacyjna — towar jest już na magazynie. */
export async function sendInformacjaArrivedEmails(
  notifications: Map<string, SalesPersonEmailBatch>
): Promise<EmailSendResult> {
  const result: EmailSendResult = { sent: 0, failures: [] };

  for (const { email, name, items } of notifications.values()) {
    const informacjaItems = items.filter((i) => i.kind === "informacja");
    if (!informacjaItems.length) continue;
    const to = email.trim();
    if (!to) {
      result.failures.push({ to: "(brak adresu)", error: "Handlowiec bez e-maila w bazie" });
      continue;
    }

    const { subject, html } = renderInformacjaArrivedEmail({
      recipientName: name,
      items: informacjaItems,
    });

    const send = await sendHtmlEmail({
      to,
      subject,
      html,
      kind: "informacja",
    });

    if (send.ok) {
      result.sent++;
    } else {
      result.failures.push({ to, error: send.error });
    }
  }

  return result;
}

/** E-mail do handlowca: anulowanie prośby przez dział dostaw. */
export async function sendProcurementCancelEmails(
  notifications: Map<string, SalesPersonEmailBatch>,
  options?: { noteUpdated?: boolean }
): Promise<EmailSendResult> {
  const result: EmailSendResult = { sent: 0, failures: [] };
  const noteUpdated = options?.noteUpdated ?? false;

  for (const { email, name, items } of notifications.values()) {
    const cancelItems = items.filter((i) => i.kind === "procurement_cancel");
    if (!cancelItems.length) continue;
    const to = email.trim();
    if (!to) {
      result.failures.push({ to: "(brak adresu)", error: "Handlowiec bez e-maila w bazie" });
      continue;
    }

    const { subject, html } = renderProcurementCancelEmail({
      recipientName: name,
      items: cancelItems,
      noteUpdated,
    });

    const send = await sendHtmlEmail({
      to,
      subject,
      html,
      kind: "procurement_cancel",
    });

    if (send.ok) {
      result.sent++;
    } else {
      result.failures.push({ to, error: send.error });
    }
  }

  return result;
}

/** E-mail do handlowca: zakupy zmieniły uwagi przy prośbie. */
export async function sendRequestNoteUpdateEmails(
  notifications: Map<string, SalesPersonEmailBatch>
): Promise<EmailSendResult> {
  const result: EmailSendResult = { sent: 0, failures: [] };

  for (const { email, name, items } of notifications.values()) {
    const noteItems = items.filter((i) => i.kind === "request_note_update");
    if (!noteItems.length) continue;
    const to = email.trim();
    if (!to) {
      result.failures.push({ to: "(brak adresu)", error: "Handlowiec bez e-maila w bazie" });
      continue;
    }

    const { subject, html } = renderRequestNoteUpdateEmail({
      recipientName: name,
      items: noteItems,
    });

    const send = await sendHtmlEmail({
      to,
      subject,
      html,
      kind: "request_note_update",
    });

    if (send.ok) {
      result.sent++;
    } else {
      result.failures.push({ to, error: send.error });
    }
  }

  return result;
}

/** E-mail do handlowca: odpowiedź zakupów na pytanie na Tablicy. */
export async function sendBoardQuestionReplyEmail(params: {
  to: string;
  recipientName: string;
  threadId: string;
  questionTitle: string;
  questionBody?: string | null;
  productSymbol?: string | null;
  productName?: string | null;
  replyBody: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string; to: string }> {
  const to = params.to.trim();
  if (!to) {
    return { ok: false, error: "Handlowiec bez e-maila w bazie", to: "(brak adresu)" };
  }

  const { subject, html } = renderBoardQuestionReplyEmail({
    recipientName: params.recipientName,
    threadId: params.threadId,
    questionTitle: params.questionTitle,
    questionBody: params.questionBody,
    productSymbol: params.productSymbol,
    productName: params.productName,
    replyBody: params.replyBody,
  });

  return sendHtmlEmail({ to, subject, html, kind: "board_reply" });
}
