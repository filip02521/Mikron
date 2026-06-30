import { createAdminClient } from "@/lib/supabase/admin";
import { UNDO_WINDOW_MS } from "@/lib/orders/daily-panel-undo";
import { normalizeIndividualOrder } from "@/lib/data/normalize-order";
import { resolveSalesPersonEmail } from "@/lib/orders/resolve-sales-person-email";
import { buildDeliveryNotificationItem } from "@/lib/email/sales-notification-items";
import { sendDeliveryNotificationEmails } from "@/lib/services/email";
import type { SalesPersonEmailBatch } from "@/lib/email/sales-notification-types";
import type { IndividualOrderStatus } from "@/types/database";

export type DeliveryNotificationQueueEntry = {
  id: string;
  orderId: string;
  deliveredQuantity: string;
  status: string;
  salesPersonId: string | null;
  sendAt: string;
};

export async function createDeliveryNotificationQueueEntry(
  orderId: string,
  deliveredQuantity: string,
  status: string,
  salesPersonId: string | null
): Promise<string> {
  const supabase = createAdminClient();
  const sendAt = new Date(Date.now() + UNDO_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("delivery_notification_queue")
    .insert({
      order_id: orderId,
      delivered_quantity: deliveredQuantity,
      status,
      sales_person_id: salesPersonId,
      send_at: sendAt,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nie udało się zapisać powiadomienia do kolejki.");
  return data.id as string;
}

export async function cancelDeliveryNotificationQueueEntries(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("delivery_notification_queue")
    .update({ cancelled_at: now })
    .in("id", ids)
    .is("sent_at", null)
    .is("cancelled_at", null);
  if (error) throw new Error(error.message);
}

export async function markDeliveryNotificationQueueEntriesSent(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("delivery_notification_queue")
    .update({ sent_at: now })
    .in("id", ids)
    .is("sent_at", null)
    .is("cancelled_at", null);
  if (error) throw new Error(error.message);
}

export async function getPendingDeliveryNotificationQueueEntries(
  ids: string[]
): Promise<DeliveryNotificationQueueEntry[]> {
  if (!ids.length) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("delivery_notification_queue")
    .select("id, order_id, delivered_quantity, status, sales_person_id, send_at")
    .in("id", ids)
    .is("sent_at", null)
    .is("cancelled_at", null);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    orderId: row.order_id as string,
    deliveredQuantity: row.delivered_quantity as string,
    status: row.status as string,
    salesPersonId: (row.sales_person_id as string) ?? null,
    sendAt: row.send_at as string,
  }));
}

export type DeliveryNotificationDirectInput = {
  orderId: string;
  deliveredQuantity: string;
  status: string;
  salesPersonId: string | null;
};

export async function sendDeliveryNotificationDirect(
  entries: DeliveryNotificationDirectInput[]
): Promise<{ sent: number; error?: string }> {
  if (!entries.length) return { sent: 0 };

  const supabase = createAdminClient();
  const notifications = new Map<string, SalesPersonEmailBatch>();
  const skipped: string[] = [];

  for (const entry of entries) {
    const { data: raw } = await supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("id", entry.orderId)
      .single();

    const order = raw ? normalizeIndividualOrder(raw) : null;
    if (!order) {
      skipped.push(entry.orderId);
      continue;
    }

    const person = await resolveSalesPersonEmail(supabase, order);
    if (!person) {
      skipped.push(order.sales_person?.name?.trim() ?? "Handlowiec");
      continue;
    }

    const item = buildDeliveryNotificationItem(
      { ...order, status: entry.status as IndividualOrderStatus, delivered_quantity: entry.deliveredQuantity },
      { deliveredQuantity: entry.deliveredQuantity }
    );

    const existing = notifications.get(person.personId);
    if (existing) {
      existing.items.push(item);
    } else {
      notifications.set(person.personId, {
        email: person.email,
        name: person.name,
        items: [item],
      });
    }
  }

  const result = await sendDeliveryNotificationEmails(notifications);
  const sent = result.sent;

  let error: string | undefined;
  if (result.failures.length) {
    error = `${result.failures[0].to}: ${result.failures[0].error}`;
  } else if (skipped.length) {
    const skipNote =
      skipped.length === 1
        ? `${skipped[0]}: brak e-maila — zapisano bez powiadomienia`
        : `${skipped.length} handlowców bez e-maila — zapisano bez powiadomienia`;
    error = error ? `${error}; ${skipNote}` : skipNote;
  }

  return { sent, error };
}

export async function sendPendingDeliveryNotifications(ids: string[]): Promise<{
  sent: number;
  error?: string;
}> {
  if (!ids.length) return { sent: 0 };
  const now = Date.now();
  const entries = (await getPendingDeliveryNotificationQueueEntries(ids)).filter(
    (entry) => new Date(entry.sendAt).getTime() <= now
  );
  if (!entries.length) return { sent: 0 };

  const supabase = createAdminClient();
  const notifications = new Map<string, SalesPersonEmailBatch>();
  const skipped: string[] = [];

  for (const entry of entries) {
    const { data: raw } = await supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("id", entry.orderId)
      .single();

    const order = raw ? normalizeIndividualOrder(raw) : null;
    if (!order) {
      skipped.push(entry.orderId);
      continue;
    }

    const person = await resolveSalesPersonEmail(supabase, order);
    if (!person) {
      skipped.push(order.sales_person?.name?.trim() ?? "Handlowiec");
      continue;
    }

    const item = buildDeliveryNotificationItem(
      { ...order, status: entry.status as IndividualOrderStatus, delivered_quantity: entry.deliveredQuantity },
      { deliveredQuantity: entry.deliveredQuantity }
    );

    const existing = notifications.get(person.personId);
    if (existing) {
      existing.items.push(item);
    } else {
      notifications.set(person.personId, {
        email: person.email,
        name: person.name,
        items: [item],
      });
    }
  }

  const result = await sendDeliveryNotificationEmails(notifications);
  const sent = result.sent;

  let error: string | undefined;
  if (result.failures.length) {
    error = `${result.failures[0].to}: ${result.failures[0].error}`;
  } else if (skipped.length) {
    const skipNote =
      skipped.length === 1
        ? `${skipped[0]}: brak e-maila — zapisano bez powiadomienia`
        : `${skipped.length} handlowców bez e-maila — zapisano bez powiadomienia`;
    error = error ? `${error}; ${skipNote}` : skipNote;
  }

  // Bez zewnętrznego cronu nie ma sensu ponawiać, więc oznaczamy wpisy jako obsłużone,
  // żeby nie zalegały w kolejce. Błęd e-maila jest logowany do konsoli.
  await markDeliveryNotificationQueueEntriesSent(entries.map((e) => e.id));

  return { sent, error };
}
