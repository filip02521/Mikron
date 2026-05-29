import { Resend } from "resend";
import { getEmailFromAddress, getResendApiKey } from "@/lib/env/email-config";
import type { SalesPersonEmailBatch } from "@/lib/email/sales-notification-types";
import {
  renderDeliveryArrivedEmail,
  renderInformacjaArrivedEmail,
} from "@/lib/email/sales-email-templates";

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
  const to = Array.isArray(params.to) ? params.to[0] : params.to;
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
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    return { ok: false, error: error.message, to };
  }
  return { ok: true, id: data?.id ?? "" };
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
