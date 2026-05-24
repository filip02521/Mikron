import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProductionRuntime } from "@/lib/env/app-config";
import { getEmailFromAddress, getResendApiKey } from "@/lib/env/email-config";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import {
  formatDateString,
  getMondayOfWeek,
  getFridayOfWeek,
  toDateOnly,
  parseDateOnly,
} from "@/lib/orders/dates";
import type { SupplierWithSchedule } from "@/types/database";
import { escapeHtml } from "@/lib/security/escape-html";
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

export async function getEmailRecipients(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "email_recipients")
    .maybeSingle();
  const raw = data?.value;
  if (typeof raw === "string") {
    return raw.split(",").map((e) => e.trim()).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw.map(String).filter(Boolean);
  }
  if (isProductionRuntime()) {
    console.warn(
      "getEmailRecipients: brak app_settings.email_recipients — ustaw w bazie przed produkcją"
    );
    return [];
  }
  return [];
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

export async function sendWeeklySummaryEmail(): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not set - skipping email");
    return false;
  }

  const supabase = createAdminClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*, supplier_schedules(*)");
  const { data: ordersRaw } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)");
  const orders = normalizeIndividualOrders(ordersRaw ?? []);

  const schedules = (suppliers ?? []).map((s) => ({
    ...s,
    schedule: Array.isArray(s.supplier_schedules)
      ? s.supplier_schedules[0] ?? null
      : s.supplier_schedules,
  })) as SupplierWithSchedule[];

  const today = toDateOnly(new Date());
  const monday = getMondayOfWeek(today);
  const sunday = getFridayOfWeek(monday);
  sunday.setDate(sunday.getDate() + 2);

  const overdue = schedules.filter((s) => {
    const d = parseDateOnly(s.schedule?.computed_next_date ?? null);
    return d && d < today;
  });

  const thisWeek = schedules.filter((s) => {
    const d = parseDateOnly(s.schedule?.computed_next_date ?? null);
    return d && d >= monday && d <= sunday;
  });

  const openIndividual = orders.filter((o) => o.status === "Nowe");

  const recipients = await getEmailRecipients();
  if (!recipients.length) {
    throw new Error(
      "Brak odbiorców — ustaw app_settings.email_recipients w bazie (lista e-maili rozdzielona przecinkami)."
    );
  }
  const subject = `Podsumowanie zamówień na tydzień (${formatDateString(monday, "dd.MM")} - ${formatDateString(sunday, "dd.MM")})`;

  let body = `<h2>Podsumowanie Zamówień Tygodniowych</h2>`;
  if (overdue.length) {
    body += `<h3>PILNE: po terminie</h3><ul>`;
    overdue.forEach((o) => {
      body += `<li>${escapeHtml(o.name)} — ${escapeHtml(o.schedule?.computed_next_date ?? "—")}</li>`;
    });
    body += `</ul>`;
  }
  body += `<h3>Ten tydzień (${thisWeek.length})</h3>`;
  body += `<h3>Otwarte indywidualne (${openIndividual.length})</h3>`;

  const send = await sendHtmlEmail({ to: recipients, subject, html: body });
  if (!send.ok) throw new Error(send.error);
  return true;
}
