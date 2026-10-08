// Odprawy DHL z maili — odczyt do listy Odpraw i licznika w menu.

import { query } from "@/lib/db/pool";

export type DhlShipmentStage = "request" | "replied" | "confirmed" | "declared" | "released";

export type DhlShipmentItem = {
  id: string;
  awb: string;
  ticket: string | null;
  requestedAt: string | null;
  stage: DhlShipmentStage;
  reminderCount: number;
  lastReminderAt: string | null;
  note: string | null;
  sellerName: string | null;
  supplierId: string | null;
  clearanceId: string | null;
  hasInvoice: boolean;
  /** Odpowiedź w wątku agencji jest możliwa (znamy oryginalną prośbę, nie tylko przekazaną kopię). */
  canReplyInThread: boolean;
  dutiesDueAt: string | null;
  dutiesPaidAt: string | null;
};

/**
 * Do odpowiedzi: prośba agencji (prośba / ponaglenie / pytanie — requested_at) bez naszej odpowiedzi
 * z ostatnich 14 dni, której odprawa nie poszła. Przesyłki znane tylko z komunikatów (cło, zwolnienie,
 * doręczenie) nie mają requested_at i na nas nie czekają.
 */
const NEEDS_REPLY = `s.dismissed_at IS NULL AND s.stage = 'request'
  AND s.requested_at > now() - interval '14 days'
  AND (s.clearance_id IS NULL OR c.status IS DISTINCT FROM 'sent')`;

export async function countDhlShipmentsNeedingReply(): Promise<number> {
  try {
    const { rows } = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.customs_dhl_shipments s
         LEFT JOIN public.customs_clearances c ON c.id = s.clearance_id
        WHERE ${NEEDS_REPLY}`
    );
    return rows[0]?.n ?? 0;
  } catch {
    // Przed migracją 179.
    return 0;
  }
}

/** Przesyłki do zrobienia (bez odprawy albo czekające na odpowiedź). null = brak migracji 179. */
export async function loadDhlShipments(): Promise<DhlShipmentItem[] | null> {
  try {
    const { rows } = await query<{
      id: string;
      awb: string;
      ticket: string | null;
      requested_at: Date | null;
      first_seen_at: Date;
      stage: DhlShipmentStage;
      reminder_count: number;
      last_reminder_at: Date | null;
      note: string | null;
      seller_name: string | null;
      supplier_id: string | null;
      clearance_id: string | null;
      invoice_count: number;
      request_rfc_message_id: string | null;
      duties_due_at: Date | null;
      duties_paid_at: Date | null;
    }>(
      `SELECT s.id, s.awb, s.ticket, s.requested_at, s.first_seen_at, s.stage, s.reminder_count, s.last_reminder_at,
              s.note, s.extraction->>'sellerName' AS seller_name, s.supplier_id, s.clearance_id,
              jsonb_array_length(s.invoice_files) AS invoice_count, s.request_rfc_message_id, s.duties_due_at, s.duties_paid_at
         FROM public.customs_dhl_shipments s
         LEFT JOIN public.customs_clearances c ON c.id = s.clearance_id
        WHERE (${NEEDS_REPLY})
           OR (s.dismissed_at IS NULL AND s.clearance_id IS NULL AND s.stage = 'request'
               AND s.requested_at > now() - interval '30 days')
        ORDER BY COALESCE(s.requested_at, s.first_seen_at) DESC
        LIMIT 50`
    );
    const iso = (d: Date | null) => (d ? d.toISOString() : null);
    return rows.map((r) => ({
      id: String(r.id),
      awb: r.awb,
      ticket: r.ticket,
      requestedAt: iso(r.requested_at ?? r.first_seen_at),
      stage: r.stage,
      reminderCount: r.reminder_count,
      lastReminderAt: iso(r.last_reminder_at),
      note: r.note,
      sellerName: r.seller_name,
      supplierId: r.supplier_id ? String(r.supplier_id) : null,
      clearanceId: r.clearance_id ? String(r.clearance_id) : null,
      hasInvoice: r.invoice_count > 0,
      canReplyInThread: Boolean(r.request_rfc_message_id),
      dutiesDueAt: iso(r.duties_due_at),
      dutiesPaidAt: iso(r.duties_paid_at),
    }));
  } catch {
    return null;
  }
}

/** Wątek prośby agencji dla odprawy założonej z maila DHL — odpowiedź idzie jako „Re:” w tym wątku. */
export type DhlReplyThread = {
  shipmentId: string;
  awb: string;
  to: string;
  subject: string;
  inReplyTo: string | null;
  mailbox: string | null;
  gmailThreadId: string | null;
};

export const DHL_AGENCY_ADDRESS = "odprawacelna@dhl.com";

export async function loadDhlReplyThread(clearanceId: string): Promise<DhlReplyThread | null> {
  try {
    const { rows } = await query<{
      id: string;
      awb: string;
      request_subject: string | null;
      request_rfc_message_id: string | null;
      request_mailbox: string | null;
      request_gmail_thread_id: string | null;
    }>(
      `SELECT s.id, s.awb, s.request_subject, s.request_rfc_message_id, s.request_mailbox, s.request_gmail_thread_id
         FROM public.customs_clearances c
         JOIN public.customs_dhl_shipments s ON s.id = c.dhl_shipment_id
        WHERE c.id = $1`,
      [clearanceId]
    );
    const r = rows[0];
    if (!r) return null;
    const subject = r.request_subject || `Agencja Celna DHL - przesyłka numer: ${r.awb}`;
    return {
      shipmentId: String(r.id),
      awb: r.awb,
      to: DHL_AGENCY_ADDRESS,
      subject: `Re: ${subject}`,
      inReplyTo: r.request_rfc_message_id,
      mailbox: r.request_mailbox,
      gmailThreadId: r.request_gmail_thread_id,
    };
  } catch {
    return null;
  }
}

/** Po wysyłce z OnTime — przesyłka nie czeka już na odpowiedź. */
export async function markDhlReplied(shipmentId: string): Promise<void> {
  await query(
    `UPDATE public.customs_dhl_shipments SET stage = 'replied', updated_at = now() WHERE id = $1 AND stage = 'request'`,
    [shipmentId]
  );
}
