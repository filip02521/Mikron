/**
 * Zapytania do dostawców z wątków tablicy (tabela supplier_inquiry_emails, migracja 174).
 * Odczyty są odporne na brak migracji — tablica działa dalej, tylko bez „Czeka na dostawcę”.
 */

import { query } from "@/lib/db/pool";
import { isZdSupplierAbroad } from "@/lib/orders/zd-estimate-post-create";
import { emailsInText } from "@/lib/supplier-forms/prepare";
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
}): Promise<void> {
  await query(
    `INSERT INTO public.supplier_inquiry_emails
       (thread_id, supplier_id, supplier_name, sent_by, from_address, to_addresses, subject, gmail_message_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [input.threadId, input.supplierId, input.supplierName, input.sentBy, input.from, input.to, input.subject, input.gmailMessageId]
  );
}

/** Odpowiedź zakupów w wątku zamyka oczekiwanie na dostawcę. */
export async function resolveSupplierInquiries(threadId: string): Promise<void> {
  try {
    await query(
      `UPDATE public.supplier_inquiry_emails SET resolved_at = now() WHERE thread_id = $1 AND resolved_at IS NULL`,
      [threadId]
    );
  } catch (e) {
    if (!isMissingTable(e)) throw e;
  }
}

export async function listSupplierInquiries(threadIds: readonly string[]): Promise<Map<string, BoardSupplierInquiry[]>> {
  const out = new Map<string, BoardSupplierInquiry[]>();
  if (!threadIds.length) return out;
  try {
    const { rows } = await query<{
      id: string;
      thread_id: string;
      supplier_id: string | null;
      supplier_name: string;
      sent_at: Date;
      resolved_at: Date | null;
    }>(
      `SELECT id, thread_id, supplier_id, supplier_name, sent_at, resolved_at
         FROM public.supplier_inquiry_emails
        WHERE thread_id = ANY($1::uuid[])
        ORDER BY sent_at DESC`,
      [[...threadIds]]
    );
    for (const r of rows) {
      const list = out.get(r.thread_id) ?? [];
      list.push({
        id: r.id,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        sentAt: r.sent_at.toISOString(),
        resolvedAt: r.resolved_at?.toISOString() ?? null,
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
