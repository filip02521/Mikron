import { Resend } from "resend";
import { getEmailFromAddress, getResendApiKey } from "@/lib/env/email-config";
import type { SalesPersonEmailBatch } from "@/lib/email/sales-notification-types";
import {
  renderDeliveryArrivedEmail,
  renderInformacjaArrivedEmail,
  renderProcurementCancelEmail,
  renderRequestNoteUpdateEmail,
  renderBoardQuestionReplyEmail,
} from "@/lib/email/sales-email-templates";

function getEmailOverrideTo(): string | undefined {
  return process.env.EMAIL_OVERRIDE_TO?.trim() || undefined;
}

function getResend() {
  const key = getResendApiKey();
  if (!key) return null;
  return new Resend(key);
}

export type EmailSendResult = {
  sent: number;
  failures: { to: string; error: string }[];
};

export async function sendHtmlEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string; to: string }> {
  const resend = getResend();
  const intendedTo = Array.isArray(params.to) ? params.to[0]! : params.to;
  const overrideTo = getEmailOverrideTo();
  const to = overrideTo ?? intendedTo;
  const subject = overrideTo
    ? `[TEST → ${intendedTo}] ${params.subject}`
    : params.subject;
  if (!resend) {
    return {
      ok: false,
      error:
        "Brak RESEND_API_KEY — dodaj do .env.local i zrestartuj serwer (npm run dev)",
      to,
    };
  }

  const { data, error } = await resend.emails.send({
    from: getEmailFromAddress(),
    to,
    subject,
    html: params.html,
  });

  if (error) {
    return { ok: false, error: error.message, to };
  }
  return { ok: true, id: data?.id ?? "" };
}

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
};

export async function sendHtmlEmailWithAttachments(
  params: MultiRecipientEmailParams
): Promise<
  | { ok: true; id: string; deliveredTo: string[] }
  | { ok: false; error: string; intendedTo: string[] }
> {
  const resend = getResend();
  const intendedTo = params.to.filter(Boolean);
  const intendedCc = (params.cc ?? []).filter(Boolean);
  const intendedBcc = (params.bcc ?? []).filter(Boolean);

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

  if (!resend) {
    return {
      ok: false,
      error:
        "Brak RESEND_API_KEY — dodaj do .env.local i zrestartuj serwer (npm run dev)",
      intendedTo,
    };
  }

  const attachments = (params.attachments ?? []).map((a) => ({
    filename: a.filename,
    content: a.content,
    contentType:
      a.contentType ??
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));

  const { data, error } = await resend.emails.send({
    from: getEmailFromAddress(),
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject,
    html: params.html,
    attachments: attachments.length ? attachments : undefined,
  });

  if (error) {
    return { ok: false, error: error.message, intendedTo };
  }
  return { ok: true, id: data?.id ?? "", deliveredTo: to };
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
    });

    if (send.ok) {
      result.sent++;
    } else {
      result.failures.push({ to: send.to, error: send.error });
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
    });

    if (send.ok) {
      result.sent++;
    } else {
      result.failures.push({ to: send.to, error: send.error });
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
    });

    if (send.ok) {
      result.sent++;
    } else {
      result.failures.push({ to: send.to, error: send.error });
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
    });

    if (send.ok) {
      result.sent++;
    } else {
      result.failures.push({ to: send.to, error: send.error });
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

  return sendHtmlEmail({ to, subject, html });
}
