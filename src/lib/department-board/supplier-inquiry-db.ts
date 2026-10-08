/**
 * Zapytania do dostawców z wątków tablicy (tabela supplier_inquiry_emails, migracja 174).
 * Odczyty są odporne na brak migracji — tablica działa dalej, tylko bez „Czeka na dostawcę”.
 */

import { query } from "@/lib/db/pool";
import { isZdSupplierAbroad } from "@/lib/orders/zd-estimate-post-create";
import { emailsInText } from "@/lib/email/supplier-emails";
import type { BoardSupplierInquiry } from "@/lib/department-board/supplier-inquiry";
import type { SupplierLocation } from "@/types/database";

function isMissingTable(e: unknown): boolean {
  return e instanceof Error && /supplier_inquiry_emails/.test(e.message) && /does not exist|nie istnieje/.test(e.message);
}

/** Wewnętrzne adresy (np. „zamawia Ola” w notatce karty) — nigdy jako odbiorca zapytania. */
const INTERNAL_EMAIL_RE = /@(?:[a-z0-9-]+\.)*mikran\.(?:pl|com)$/;

/** Adresy dostawcy: najpierw pole „maile” karty, potem notatki / dodatkowe info; bez adresów Mikranu. */
export function supplierInquiryEmails(s: { mails: string | null; notes: string | null; extra_info: string | null }): string[] {
  const ordered = [...emailsInText(s.mails ?? ""), ...emailsInText(`${s.notes ?? ""} ${s.extra_info ?? ""}`)];
  return [...new Set(ordered)].filter((e) => !INTERNAL_EMAIL_RE.test(e));
}

export type InquirySupplierOption = {
  id: string;
  name: string;
  location: SupplierLocation | null;
  emails: string[];
  /** Szkic po angielsku — ta sama reguła co PDF zamówienia ZD (ZAGRANICA / IMPORT). */
  english: boolean;
};

/** Aktywni dostawcy z adresem na karcie + ci powiązani z towarem (podpowiedź na górze). */
export async function loadInquirySupplierOptions(
  subiektTwId: number | null
): Promise<{ suppliers: InquirySupplierOption[]; suggestedIds: string[] }> {
  const [suppliersRes, linkedRes] = await Promise.all([
    query<{ id: string; name: string; location: SupplierLocation | null; mails: string | null; notes: string | null; extra_info: string | null }>(
      `SELECT id, name, location, mails, notes, extra_info
         FROM public.suppliers
        WHERE COALESCE(is_active, true)
        ORDER BY name`
    ),
    subiektTwId
      ? query<{ supplier_id: string }>(
          `SELECT supplier_id FROM public.zd_product_supplier_assignments WHERE subiekt_tw_id = $1
           UNION
           SELECT supplier_id FROM public.product_supplier_links WHERE subiekt_tw_id = $1`,
          [subiektTwId]
        )
      : Promise.resolve({ rows: [] as { supplier_id: string }[] }),
  ]);

  const suppliers = suppliersRes.rows
    .map((s) => ({
      id: String(s.id),
      name: s.name,
      location: s.location ?? null,
      english: isZdSupplierAbroad(s.location),
      emails: supplierInquiryEmails(s),
    }))
    .filter((s) => s.emails.length > 0);
  const known = new Set(suppliers.map((s) => s.id));
  const suggestedIds = [...new Set(linkedRes.rows.map((r) => String(r.supplier_id)))].filter((id) => known.has(id));
  return { suppliers, suggestedIds };
}

export async function recordSupplierInquiry(input: {
  threadId: string;
  supplierId: string;
  supplierName: string;
  sentBy: string;
  from: string;
  to: string[];
  subject: string;
  gmailMessageId: string;
  /** Wątek Gmaila wysłanej wiadomości (migracja 178) — odpowiedzi dostawcy przypinają się po nim. */
  gmailThreadId?: string | null;
}): Promise<void> {
  const base = [input.threadId, input.supplierId, input.supplierName, input.sentBy, input.from, input.to, input.subject, input.gmailMessageId];
  try {
    await query(
      `INSERT INTO public.supplier_inquiry_emails
         (thread_id, supplier_id, supplier_name, sent_by, from_address, to_addresses, subject, gmail_message_id, gmail_thread_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [...base, input.gmailThreadId ?? null]
    );
  } catch (e) {
    // Kod wdrożony przed migracją 178 (brak gmail_thread_id) — zapytanie i tak ma być „czeka na dostawcę”.
    if (!(e instanceof Error && e.message.includes("gmail_thread_id") && /does not exist|nie istnieje/.test(e.message))) throw e;
    await query(
      `INSERT INTO public.supplier_inquiry_emails
         (thread_id, supplier_id, supplier_name, sent_by, from_address, to_addresses, subject, gmail_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      base
    );
  }
}

/**
 * Odpowiedź zakupów w wątku zamyka oczekiwanie na dostawcę. `onlyIds` — tylko te zapytania
 * (np. te, na które dostawca odpisał); pominięte = wszystkie otwarte w wątku.
 */
export async function resolveSupplierInquiries(threadId: string, onlyIds?: readonly string[]): Promise<void> {
  if (onlyIds && !onlyIds.length) return;
  try {
    await query(
      onlyIds
        ? `UPDATE public.supplier_inquiry_emails SET resolved_at = now()
            WHERE thread_id = $1 AND resolved_at IS NULL AND id = ANY($2::uuid[])`
        : `UPDATE public.supplier_inquiry_emails SET resolved_at = now() WHERE thread_id = $1 AND resolved_at IS NULL`,
      onlyIds ? [threadId, [...onlyIds]] : [threadId]
    );
  } catch (e) {
    if (!isMissingTable(e)) throw e;
  }
}

type InquiryRow = {
  id: string;
  thread_id: string;
  supplier_id: string | null;
  supplier_name: string;
  sent_at: Date;
  resolved_at: Date | null;
  reply_at?: Date | null;
  reply_kind?: string | null;
};

export async function listSupplierInquiries(threadIds: readonly string[]): Promise<Map<string, BoardSupplierInquiry[]>> {
  const out = new Map<string, BoardSupplierInquiry[]>();
  if (!threadIds.length) return out;
  try {
    // Odpowiedź dostawcy z Poczty dostawców (przypięta do zapytania); przed migracją 178 — bez niej.
    const rows = await query<InquiryRow>(
      `SELECT i.id, i.thread_id, i.supplier_id, i.supplier_name, i.sent_at, i.resolved_at,
              r.received_at AS reply_at, r.kind AS reply_kind
         FROM public.supplier_inquiry_emails i
         LEFT JOIN LATERAL (
           SELECT m.received_at, m.kind FROM public.supplier_mail_messages m
            WHERE m.case_kind = 'inquiry' AND m.case_id = i.id AND m.kind IN ('supplier', 'bounce')
              AND m.received_at > i.sent_at
            ORDER BY m.received_at DESC LIMIT 1
         ) r ON true
        WHERE i.thread_id = ANY($1::uuid[])
        ORDER BY i.sent_at DESC`,
      [[...threadIds]]
    )
      .then((r) => r.rows)
      .catch(async (e: unknown) => {
        if (!(e instanceof Error && /supplier_mail_messages/.test(e.message))) throw e;
        const legacy = await query<InquiryRow>(
          `SELECT id, thread_id, supplier_id, supplier_name, sent_at, resolved_at
             FROM public.supplier_inquiry_emails
            WHERE thread_id = ANY($1::uuid[])
            ORDER BY sent_at DESC`,
          [[...threadIds]]
        );
        return legacy.rows;
      });
    for (const r of rows) {
      const list = out.get(r.thread_id) ?? [];
      list.push({
        id: r.id,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        sentAt: r.sent_at.toISOString(),
        resolvedAt: r.resolved_at?.toISOString() ?? null,
        replyAt: r.reply_at?.toISOString() ?? null,
        bounced: r.reply_kind === "bounce",
      });
      out.set(r.thread_id, list);
    }
  } catch (e) {
    if (!isMissingTable(e)) throw e;
  }
  return out;
}

/** Wątki czekające na dostawcę — nie zamykaj ich automatycznie po 2 dniach ciszy. */
export async function threadIdsAwaitingSupplier(): Promise<string[]> {
  try {
    const { rows } = await query<{ thread_id: string }>(
      `SELECT DISTINCT thread_id FROM public.supplier_inquiry_emails WHERE resolved_at IS NULL`
    );
    return rows.map((r) => r.thread_id);
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}
