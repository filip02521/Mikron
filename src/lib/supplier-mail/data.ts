/**
 * Poczta dostawców — odczyt z bazy (bez Gmaila): rozmowy (wątki) w grupach „do reakcji”, „dokumenty”,
 * „załatwione” i sprawy czekające na dostawcę (wysłane ZD / zapytania bez odpowiedzi).
 */

import { query } from "@/lib/db/pool";
import type { GmailAttachmentRef } from "@/lib/google/gmail";
import { categoryNeedsAction, type SupplierMailCategory } from "@/lib/supplier-mail/match";
import { awaitingReplyTiming, type AwaitingReplyTiming } from "@/lib/suppliers/awaiting-supplier";
import type { SupplierLocation } from "@/types/database";

/** Jak daleko wstecz pokazujemy rozmowy i dokumenty. */
const VIEW_DAYS = 30;
/** Załatwione — tyle dni wstecz. */
const DONE_DAYS = 14;

export type MailMessageRow = {
  id: string;
  mailbox: string;
  owner_user_id: string | null;
  gmail_message_id: string;
  gmail_thread_id: string;
  rfc_message_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_location: SupplierLocation | null;
  kind: "supplier" | "auto" | "bounce";
  category: Exclude<SupplierMailCategory, "newsletter">;
  from_address: string;
  from_name: string;
  subject: string;
  snippet: string;
  attachments: GmailAttachmentRef[];
  received_at: Date;
  case_kind: "zd" | "inquiry" | null;
  case_id: string | null;
  linked_by: "thread" | "document" | "supplier" | null;
  zd_dok_nr: string | null;
  zd_dok_id: number | null;
  case_label: string | null;
  board_thread_id: string | null;
  handled_at: Date | null;
  handled_via: string | null;
};

export type MailConversation = {
  key: string;
  mailbox: string;
  threadId: string;
  supplierId: string | null;
  supplierName: string;
  subject: string;
  lastFrom: string;
  lastAt: string;
  snippet: string;
  count: number;
  attachments: number;
  category: Exclude<SupplierMailCategory, "newsletter">;
  bounce: boolean;
  /** Ostatnia wiadomość od dostawcy to autoodpowiedź (urlop). */
  autoReply: boolean;
  /** Wymaga reakcji: odpowiedź / potwierdzenie od dostawcy albo zwrot, jeszcze nie załatwione. */
  open: boolean;
  /** ZD: z OnTime (sprawa) albo numer z treści maila. */
  zdLabel: string | null;
  caseKind: "zd" | "inquiry" | null;
  caseId: string | null;
  linkedBy: MailMessageRow["linked_by"];
  boardThreadId: string | null;
  handledVia: string | null;
};

export type WaitingCase = {
  kind: "zd" | "inquiry";
  id: string;
  supplierId: string | null;
  supplierName: string;
  label: string;
  boardThreadId: string | null;
  sentAt: string;
  from: string;
  to: string[];
  /** Zagranica / import — przypomnienie po angielsku. */
  english: boolean;
  /** Ostatnie przypomnienie z Poczty — od niego liczy się termin odpowiedzi. */
  remindedAt: string | null;
  /** Dostawca odpisał tylko autoodpowiedzią. */
  autoReply: boolean;
} & AwaitingReplyTiming;

export type SupplierMailView = {
  /** Rozmowy wymagające reakcji (najnowsze pierwsze). */
  open: MailConversation[];
  /** Sprawy bez odpowiedzi po terminie (PL 1 dzień rob., zagranica / import 2). */
  overdue: WaitingCase[];
  /** Sprawy czekające w terminie. */
  waiting: WaitingCase[];
  /** Faktury i dokumenty wysyłki z ostatnich 30 dni. */
  documents: MailConversation[];
  /** Załatwione rozmowy z ostatnich 14 dni. */
  done: MailConversation[];
  sync: { at: string | null; error: string | null; mailboxes: number };
};

const CATEGORY_RANK: Record<MailConversation["category"], number> = { confirmation: 0, reply: 1, invoice: 2, shipping: 3 };

function needsAction(m: Pick<MailMessageRow, "kind" | "category" | "handled_at">): boolean {
  if (m.handled_at) return false;
  return m.kind === "bounce" || (m.kind === "supplier" && categoryNeedsAction(m.category));
}

/** Wiadomości → rozmowy (wątek w skrzynce); najnowsza wiadomość wyznacza nagłówek. */
export function groupConversations(rows: readonly MailMessageRow[]): MailConversation[] {
  const byKey = new Map<string, MailMessageRow[]>();
  for (const r of rows) {
    const key = `${r.mailbox}|${r.gmail_thread_id}`;
    const list = byKey.get(key);
    if (list) list.push(r);
    else byKey.set(key, [r]);
  }
  return [...byKey.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => b.received_at.getTime() - a.received_at.getTime());
      const last = sorted[0]!;
      const fromSupplier = sorted.filter((m) => m.kind !== "bounce");
      const linked = sorted.find((m) => m.case_kind);
      const category = sorted
        .filter((m) => m.kind === "supplier")
        .map((m) => m.category)
        .sort((a, b) => CATEGORY_RANK[a] - CATEGORY_RANK[b])[0] ?? last.category;
      const open = sorted.some(needsAction);
      return {
        key,
        mailbox: last.mailbox,
        threadId: last.gmail_thread_id,
        supplierId: (sorted.find((m) => m.supplier_id)?.supplier_id ?? null) as string | null,
        supplierName: sorted.find((m) => m.supplier_name)?.supplier_name ?? last.from_name ?? last.from_address,
        subject: last.subject,
        lastFrom: last.from_name || last.from_address,
        lastAt: last.received_at.toISOString(),
        snippet: last.snippet,
        count: sorted.length,
        // Bez obrazków z podpisu Outlooka (image001.png…).
        attachments: sorted.reduce((n, m) => n + m.attachments.filter((f) => !/^image\d{3}\.(png|jpe?g|gif)$/i.test(f.filename)).length, 0),
        category,
        bounce: sorted.some((m) => m.kind === "bounce" && !m.handled_at),
        autoReply: fromSupplier[0]?.kind === "auto",
        open,
        zdLabel: linked?.case_label ?? sorted.find((m) => m.zd_dok_nr)?.zd_dok_nr ?? null,
        caseKind: linked?.case_kind ?? null,
        caseId: linked?.case_id ?? null,
        linkedBy: linked?.linked_by ?? null,
        boardThreadId: linked?.board_thread_id ?? null,
        handledVia: open ? null : (sorted.find((m) => m.handled_via)?.handled_via ?? null),
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function loadMailMessages(where = "TRUE", params: unknown[] = []): Promise<MailMessageRow[]> {
  const { rows } = await query<MailMessageRow>(
    `SELECT m.id, m.mailbox, m.owner_user_id, m.gmail_message_id, m.gmail_thread_id, m.rfc_message_id,
            m.supplier_id, s.name AS supplier_name, s.location AS supplier_location,
            m.kind, m.category, m.from_address, m.from_name, m.subject, m.snippet, m.attachments, m.received_at,
            m.case_kind, m.case_id, m.linked_by, m.zd_dok_nr, m.zd_dok_id,
            CASE WHEN m.case_kind = 'zd' THEN e.dok_nr WHEN m.case_kind = 'inquiry' THEN COALESCE(NULLIF(t.product_name, ''), t.title) END AS case_label,
            i.thread_id AS board_thread_id,
            m.handled_at, m.handled_via
       FROM public.supplier_mail_messages m
       LEFT JOIN public.suppliers s ON s.id = m.supplier_id
       LEFT JOIN public.supplier_order_emails e ON m.case_kind = 'zd' AND e.id = m.case_id
       LEFT JOIN public.supplier_inquiry_emails i ON m.case_kind = 'inquiry' AND i.id = m.case_id
       LEFT JOIN public.department_board_threads t ON t.id = i.thread_id
      WHERE ${where}
      ORDER BY m.received_at DESC
      LIMIT 1500`,
    params
  );
  return rows.map((r) => ({ ...r, attachments: Array.isArray(r.attachments) ? r.attachments : [] }));
}

type CaseRow = {
  kind: "zd" | "inquiry";
  id: string;
  supplier_id: string | null;
  supplier_name: string;
  location: SupplierLocation | null;
  label: string;
  board_thread_id: string | null;
  sent_at: Date;
  reminded_at: Date | null;
  from_address: string;
  to_addresses: string[];
};

/** Wysłane ZD (30 dni) i zapytania bez zamknięcia — kandydaci na „czeka na dostawcę”. */
async function loadOpenCases(): Promise<CaseRow[]> {
  const { rows } = await query<CaseRow>(
    `SELECT 'zd' AS kind, e.id, s.id AS supplier_id, s.name AS supplier_name, s.location,
            COALESCE(NULLIF(e.dok_nr, ''), 'ZD ' || e.subiekt_dok_id) AS label, NULL::uuid AS board_thread_id,
            e.sent_at, e.reminded_at, e.from_address, e.to_addresses
       FROM (
         SELECT DISTINCT ON (subiekt_dok_id) *
           FROM public.supplier_order_emails
          WHERE sent_at > now() - interval '30 days'
          ORDER BY subiekt_dok_id, sent_at DESC
       ) e
       JOIN public.suppliers s ON s.id = e.supplier_id
      WHERE e.resolved_at IS NULL
     UNION ALL
     SELECT 'inquiry', i.id, i.supplier_id, COALESCE(s.name, i.supplier_name), s.location,
            COALESCE(NULLIF(t.product_name, ''), t.title), t.id, i.sent_at, i.reminded_at, i.from_address, i.to_addresses
       FROM public.supplier_inquiry_emails i
       JOIN public.department_board_threads t ON t.id = i.thread_id AND t.archived_at IS NULL
       LEFT JOIN public.suppliers s ON s.id = i.supplier_id
      WHERE i.resolved_at IS NULL`
  );
  return rows;
}

function isMissingSchema(e: unknown): boolean {
  return e instanceof Error && /supplier_mail_|gmail_thread_id|resolved_at/.test(e.message) && /does not exist|nie istnieje/.test(e.message);
}

/**
 * Sprawy czekające: bez odpowiedzi dostawcy w Poczcie. Odpowiedź (także OC osobnym mailem przypięte
 * do sprawy) albo zwrot przenoszą sprawę do rozmów.
 */
export function waitingCases(cases: readonly CaseRow[], messages: readonly MailMessageRow[], now = new Date()): WaitingCase[] {
  const answered = new Set<string>();
  const auto = new Set<string>();
  for (const m of messages) {
    if (!m.case_kind || !m.case_id) continue;
    const key = `${m.case_kind}|${m.case_id}`;
    if (m.kind === "supplier" || m.kind === "bounce") answered.add(key);
    else auto.add(key);
  }
  return cases
    .filter((c) => !answered.has(`${c.kind}|${c.id}`))
    .map((c) => ({
      kind: c.kind,
      id: String(c.id),
      supplierId: c.supplier_id ? String(c.supplier_id) : null,
      supplierName: c.supplier_name,
      label: c.label,
      boardThreadId: c.board_thread_id ? String(c.board_thread_id) : null,
      sentAt: c.sent_at.toISOString(),
      from: c.from_address,
      to: c.to_addresses ?? [],
      english: c.location === "ZAGRANICA" || c.location === "IMPORT",
      remindedAt: c.reminded_at ? c.reminded_at.toISOString() : null,
      autoReply: auto.has(`${c.kind}|${c.id}`),
      ...awaitingReplyTiming(c.reminded_at && c.reminded_at > c.sent_at ? c.reminded_at : c.sent_at, c.location, now),
    }))
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

export async function loadSupplierMailView(): Promise<SupplierMailView> {
  try {
    const [messages, cases, syncRes] = await Promise.all([
      loadMailMessages(`m.received_at > now() - make_interval(days => $1)`, [VIEW_DAYS]),
      loadOpenCases(),
      query<{ synced_at: Date; last_error: string | null }>(`SELECT synced_at, last_error FROM public.supplier_mail_sync`),
    ]);
    const conversations = groupConversations(messages);
    const waiting = waitingCases(cases, messages);
    const doneSince = Date.now() - DONE_DAYS * 86_400_000;
    const lastOk = syncRes.rows.map((r) => r.synced_at.getTime()).filter((t) => t > 0);
    return {
      open: conversations.filter((c) => c.open),
      overdue: waiting.filter((w) => w.overdue),
      waiting: waiting.filter((w) => !w.overdue),
      documents: conversations.filter((c) => !c.open && (c.category === "invoice" || c.category === "shipping")),
      done: conversations.filter(
        (c) =>
          !c.open &&
          c.category !== "invoice" &&
          c.category !== "shipping" &&
          c.handledVia !== "initial" &&
          Date.parse(c.lastAt) >= doneSince
      ),
      sync: {
        at: lastOk.length ? new Date(Math.min(...lastOk)).toISOString() : null,
        error: syncRes.rows.find((r) => r.last_error)?.last_error ?? null,
        mailboxes: syncRes.rows.length,
      },
    };
  } catch (e) {
    if (isMissingSchema(e)) {
      return { open: [], overdue: [], waiting: [], documents: [], done: [], sync: { at: null, error: null, mailboxes: 0 } };
    }
    throw e;
  }
}

/** Licznik w menu: rozmowy do reakcji + sprawy po terminie. Lekki (bez Gmaila). */
export async function countSupplierMailNeedsAction(): Promise<number> {
  try {
    const view = await loadSupplierMailView();
    return view.open.length + view.overdue.length;
  } catch {
    return 0;
  }
}

/** Odpowiedź handlowcowi w wątku tablicy zamyka w Poczcie odpowiedzi dostawcy na te zapytania. */
export async function markInquiryMailHandled(inquiryIds: readonly string[], userId: string | null): Promise<void> {
  if (!inquiryIds.length) return;
  try {
    await query(
      `UPDATE public.supplier_mail_messages SET handled_at = now(), handled_by = $2, handled_via = 'board'
        WHERE case_kind = 'inquiry' AND case_id = ANY($1::uuid[]) AND handled_at IS NULL`,
      [[...inquiryIds], userId]
    );
  } catch (e) {
    if (!isMissingSchema(e)) throw e;
  }
}
