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
  calculateBusinessDate,
  parseDateOnly,
} from "@/lib/orders/dates";
import { avgDaysForOrderType } from "@/lib/orders/delivery-eta";
import { orderPlacementAt } from "@/lib/orders/order-timing";
import type { SupplierWithSchedule, StatsMode } from "@/types/database";
import { warsawNowParts } from "@/lib/time/warsaw";
import { readCronRun, recordCronRun } from "@/lib/services/cron-run-log";

async function dailySalesEmailAlreadySentToday(): Promise<boolean> {
  const { dateKey } = warsawNowParts();
  const last = await readCronRun("daily_sales");
  if (!last) return false;
  const detail = last.detail as { warsawDateKey?: string; emailsSent?: number } | undefined;
  return detail?.warsawDateKey === dateKey && (detail?.emailsSent ?? 0) > 0;
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
  notifications: Map<string, { email: string; name: string; lines: string[] }>
): Promise<EmailSendResult> {
  const result: EmailSendResult = { sent: 0, failures: [] };

  for (const { email, name, lines } of notifications.values()) {
    if (!lines.length) continue;
    const to = email.trim();
    if (!to) {
      result.failures.push({ to: "(brak adresu)", error: "Handlowiec bez e-maila w bazie" });
      continue;
    }

    const body = `<p>Cześć ${name.split(" ")[0]},</p>
<p><strong>Twój towar dotarł na magazyn.</strong></p>
<p>Szczegóły:</p>
<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
<p style="color:#64748b;font-size:12px">Wiadomość z Systemu Dostaw Mikran.</p>`;

    const send = await sendHtmlEmail({
      to,
      subject: "Towar na magazynie — zamówienie indywidualne",
      html: body,
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
  notifications: Map<string, { email: string; name: string; lines: string[] }>
): Promise<EmailSendResult> {
  const result: EmailSendResult = { sent: 0, failures: [] };

  for (const { email, name, lines } of notifications.values()) {
    if (!lines.length) continue;
    const to = email.trim();
    if (!to) {
      result.failures.push({ to: "(brak adresu)", error: "Handlowiec bez e-maila w bazie" });
      continue;
    }

    const body = `<p>Cześć ${name.split(" ")[0]},</p>
<p><strong>Towar, o który prosiłeś/aś o informację, jest już na magazynie.</strong></p>
<p>To nie było zamówienie u dostawcy — tylko powiadomienie, że możesz odebrać towar.</p>
<p>Szczegóły:</p>
<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
<p style="color:#64748b;font-size:12px">Wiadomość z Systemu Dostaw Mikran.</p>`;

    const send = await sendHtmlEmail({
      to,
      subject: "Na magazynie — informacja o towarze",
      html: body,
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
      body += `<li>${o.name} - ${o.schedule?.computed_next_date}</li>`;
    });
    body += `</ul>`;
  }
  body += `<h3>Ten tydzień (${thisWeek.length})</h3>`;
  body += `<h3>Otwarte indywidualne (${openIndividual.length})</h3>`;

  const send = await sendHtmlEmail({ to: recipients, subject, html: body });
  if (!send.ok) throw new Error(send.error);
  return true;
}

export type DailySalesEmailResult = {
  sent: number;
  skipped: boolean;
  reason?: string;
  failures: string[];
};

export async function sendDailyStatusToSales(): Promise<DailySalesEmailResult> {
  const resend = getResend();
  const warsaw = warsawNowParts();
  if (warsaw.isWeekend) {
    return { sent: 0, skipped: true, reason: "weekend", failures: [] };
  }
  if (!resend) {
    return { sent: 0, skipped: true, reason: "email_not_configured", failures: [] };
  }
  if (await dailySalesEmailAlreadySentToday()) {
    return { sent: 0, skipped: true, reason: "already_sent_today", failures: [] };
  }

  const supabase = createAdminClient();
  const { data: salesPeople } = await supabase.from("sales_people").select("*");
  const { data: ordersRaw } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)");
  const orders = normalizeIndividualOrders(ordersRaw ?? []);
  const { data: stats } = await supabase.from("delivery_stats").select("*");

  const statsMap = Object.fromEntries((stats ?? []).map((s) => [s.supplier_id, s]));
  let sent = 0;
  const failures: string[] = [];

  for (const person of salesPeople ?? []) {
    const mine = orders.filter((o) => o.sales_person_id === person.id);
    const pending = mine.filter((o) => o.status === "Zamowione");
    const newOnes = mine.filter(
      (o) => o.status === "Nowe" && (o.request_kind ?? "zamowienie") === "zamowienie"
    );
    if (!pending.length && !newOnes.length) continue;

    let body = `<p>Cześć ${person.name.split(" ")[0]},</p><p>Status Twoich zamówień:</p><ul>`;
    pending.forEach((o) => {
      const st = o.supplier_id ? statsMap[o.supplier_id] : undefined;
      const statsMode = (o.supplier?.stats_mode ?? "LACZNIE") as StatsMode;
      const avg = avgDaysForOrderType(st ?? null, o.order_type, statsMode);
      let eta = "";
      const placement = orderPlacementAt(o);
      if (avg && placement) {
        const etaDate = calculateBusinessDate(parseDateOnly(placement)!, Number(avg));
        eta = ` (ETA: ${formatDateString(etaDate, "dd.MM.yyyy")})`;
      }
      body += `<li>${o.supplier?.name}: ${o.products}${eta}</li>`;
    });
    newOnes.forEach((o) => {
      body += `<li>[Nowe] ${o.supplier?.name}: ${o.products}</li>`;
    });
    body += `</ul>`;

    const send = await sendHtmlEmail({
      to: person.email,
      subject: "Codzienny Status Twoich Zamówień Indywidualnych",
      html: body,
    });
    if (send.ok) sent++;
    else failures.push(`${person.email}: ${send.error}`);
  }

  if (sent > 0) {
    await recordCronRun("daily_sales", {
      ok: failures.length === 0,
      detail: {
        warsawDateKey: warsaw.dateKey,
        emailsSent: sent,
        partialFailure: failures.length > 0,
        failures: failures.length > 0 ? failures : undefined,
      },
      error: failures.length > 0 ? failures.join("; ") : undefined,
    });
  }

  return { sent, skipped: false, failures };
}
