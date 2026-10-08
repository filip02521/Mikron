/**
 * Poczta dostawców — odczyt z bazy (bez Gmaila): rozmowy (wątki) i sprawy czekające na dostawcę
 * (wysłane ZD / zapytania bez odpowiedzi), ułożone w kolumny tablicy spraw (lib/mail-board).
 */

import { query } from "@/lib/db/pool";
import type { GmailAttachmentRef } from "@/lib/google/gmail";
import {
  addBusinessDaysKey,
  deriveColumn,
  isBoardColumn,
  waitUntilAfter,
  type BoardColumn,
  type BoardRow,
} from "@/lib/mail-board/board";
import { customsMailKind, type CustomsMailKind } from "@/lib/mail-board/triage";
import { isInlineImage } from "@/lib/mail/attachments";
import { categoryNeedsAction, type SupplierMailCategory } from "@/lib/supplier-mail/match";
import { awaitingReplyTiming, type AwaitingReplyTiming } from "@/lib/suppliers/awaiting-supplier";
import { todayDateKeyInWarsaw, warsawDateKeyFromIso } from "@/lib/time/warsaw";
import type { SupplierLocation } from "@/types/database";

/** Jak daleko wstecz pokazujemy rozmowy i dokumenty. */
const VIEW_DAYS = 30;
/** Załatwione — tyle dni wstecz. */
const DONE_DAYS = 14;
/** Wiadomości na jeden odczyt widoku (cała skrzynka z 30 dni, bez odrzuconych na półce). */
const MESSAGES_LIMIT = 3000;

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
  /** other = nadawca spoza kart dostawców (cała skrzynka, migracja 184). */
  kind: "supplier" | "auto" | "bounce" | "other";
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
  /** Tylko kind 'other': do przejrzenia / sprawa / nie sprawa / odprawa celna (agencja, spedytor). */
  triage: "review" | "case" | "ignored" | "customs" | null;
};

export type MailConversation = {
  key: string;
  mailbox: string;
  threadId: string;
  supplierId: string | null;
  supplierName: string;
  subject: string;
  lastFrom: string;
  /** Adres ostatniego nadawcy — do reguły „zawsze od …”. */
  lastFromEmail: string;
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
  /** Właściciel skrzynki — domyślnie on obsługuje sprawę. */
  ownerUserId: string | null;
  /** Ostatnia nasza odpowiedź (z OnTime albo z Gmaila). */
  repliedAt: string | null;
  /** Rozmowa od nadawcy spoza kart dostawców: do przejrzenia / sprawa / nie sprawa; null = dostawca. */
  triage: MailMessageRow["triage"];
  /** Tylko triage 'customs': co jest w mailu agencji (należności, dokumenty, wycena, awizacja, prośba). */
  customsKind: CustomsMailKind | null;
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
  /** Kto wysłał — domyślnie on obsługuje sprawę. */
  sentBy: string | null;
  /** Zamknięta „Załatwione” (ostatnie 14 dni — kolumna Zakończone). */
  resolved: boolean;
} & AwaitingReplyTiming;

/** Sprawa na tablicy: rozmowa albo wysłane ZD / zapytanie bez odpowiedzi. */
export type BoardItem = {
  /** Klucz wpisu w mail_board_items: 'conv:<skrzynka>|<wątek>' albo 'zd:<id>' / 'inquiry:<id>'. */
  key: string;
  ref: { type: "conv"; conv: MailConversation } | { type: "case"; item: WaitingCase };
  column: BoardColumn;
  reason: string | null;
  fresh: boolean;
  remindOn: string | null;
  note: string;
  waitingOn: string;
  assigneeId: string | null;
  /** Ręczna kolumna — do „Cofnij” po przeniesieniu. */
  manualColumn: BoardColumn | null;
  sortAt: string;
};

export type MailPerson = { id: string; name: string };

export type SupplierMailView = {
  items: BoardItem[];
  /** Półka „Do przejrzenia”: nieznani nadawcy — sprawa czy nie. */
  review: MailConversation[];
  /** Agencje celne i spedytorzy — lista w odprawach; tu do otwarcia rozmowy z linku. */
  customs: MailConversation[];
  /** Osoby z zakupów — do „Obsługuje”. */
  people: MailPerson[];
  sync: { at: string | null; error: string | null; mailboxes: number };
};

const CATEGORY_RANK: Record<MailConversation["category"], number> = { confirmation: 0, reply: 1, invoice: 2, shipping: 3 };

const fromPerson = (m: Pick<MailMessageRow, "kind" | "triage">) => m.kind === "supplier" || (m.kind === "other" && m.triage === "case");

function needsAction(m: Pick<MailMessageRow, "kind" | "category" | "handled_at" | "triage">): boolean {
  if (m.handled_at) return false;
  return m.kind === "bounce" || (fromPerson(m) && categoryNeedsAction(m.category));
}

function threadTriage(list: readonly MailMessageRow[]): MailMessageRow["triage"] {
  if (list.some((m) => m.kind !== "other")) return null;
  for (const t of ["case", "customs", "review", "ignored"] as const) if (list.some((m) => m.triage === t)) return t;
  return null;
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
        .filter(fromPerson)
        .map((m) => m.category)
        .sort((a, b) => CATEGORY_RANK[a] - CATEGORY_RANK[b])[0] ?? last.category;
      const open = sorted.some(needsAction);
      return {
        key,
        mailbox: last.mailbox,
        threadId: last.gmail_thread_id,
        supplierId: (sorted.find((m) => m.supplier_id)?.supplier_id ?? null) as string | null,
        // from_name to pusty tekst, gdy nadawca nie ma podpisu — wtedy adres.
        supplierName: sorted.find((m) => m.supplier_name)?.supplier_name || last.from_name || last.from_address,
        subject: last.subject,
        lastFrom: last.from_name || last.from_address,
        lastFromEmail: last.from_address,
        lastAt: last.received_at.toISOString(),
        snippet: last.snippet,
        count: sorted.length,
        // Bez obrazków z podpisu Outlooka (image001.png…).
        attachments: sorted.reduce((n, m) => n + m.attachments.filter((f) => !isInlineImage(f)).length, 0),
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
        ownerUserId: last.owner_user_id,
        repliedAt:
          sorted
            .filter((m) => m.handled_at && (m.handled_via === "reply" || m.handled_via === "gmail"))
            .map((m) => m.handled_at!.toISOString())
            .sort()
            .at(-1) ?? null,
        triage: threadTriage(sorted),
        customsKind:
          threadTriage(sorted) === "customs"
            ? customsMailKind({
                subject: last.subject,
                attachmentNames: sorted.flatMap((m) => m.attachments.map((a) => a.filename)),
                snippet: last.snippet,
              })
            : null,
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
            m.handled_at, m.handled_via, to_jsonb(m) ->> 'triage' AS triage
       FROM public.supplier_mail_messages m
       LEFT JOIN public.suppliers s ON s.id = m.supplier_id
       LEFT JOIN public.supplier_order_emails e ON m.case_kind = 'zd' AND e.id = m.case_id
       LEFT JOIN public.supplier_inquiry_emails i ON m.case_kind = 'inquiry' AND i.id = m.case_id
       LEFT JOIN public.department_board_threads t ON t.id = i.thread_id
      WHERE ${where}
      ORDER BY m.received_at DESC
      LIMIT ${MESSAGES_LIMIT}`,
    params
  );
  if (rows.length >= MESSAGES_LIMIT) console.warn("[poczta] limit wiadomości w widoku - starsze rozmowy pominięte", where.slice(0, 80));
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
  sent_by: string | null;
  resolved_at: Date | null;
};

/**
 * Wysłane ZD (30 dni) i zapytania bez zamknięcia — kandydaci na „czeka na dostawcę”; z `withResolved`
 * także zamknięte w ostatnich 14 dniach (kolumna Zakończone).
 */
async function loadOpenCases(withResolved = false): Promise<CaseRow[]> {
  const { rows } = await query<CaseRow>(
    `SELECT 'zd' AS kind, e.id, s.id AS supplier_id, s.name AS supplier_name, s.location,
            COALESCE(NULLIF(e.dok_nr, ''), 'ZD ' || e.subiekt_dok_id) AS label, NULL::uuid AS board_thread_id,
            e.sent_at, e.reminded_at, e.from_address, e.to_addresses, e.sent_by, e.resolved_at
       FROM (
         SELECT DISTINCT ON (subiekt_dok_id) *
           FROM public.supplier_order_emails
          WHERE sent_at > now() - interval '30 days'
          ORDER BY subiekt_dok_id, sent_at DESC
       ) e
       JOIN public.suppliers s ON s.id = e.supplier_id
      WHERE e.resolved_at IS NULL OR ($1 AND e.resolved_at > now() - make_interval(days => $2))
     UNION ALL
     SELECT 'inquiry', i.id, i.supplier_id, COALESCE(s.name, i.supplier_name), s.location,
            COALESCE(NULLIF(t.product_name, ''), t.title), t.id, i.sent_at, i.reminded_at, i.from_address, i.to_addresses,
            i.sent_by, i.resolved_at
       FROM public.supplier_inquiry_emails i
       JOIN public.department_board_threads t ON t.id = i.thread_id AND t.archived_at IS NULL
       LEFT JOIN public.suppliers s ON s.id = i.supplier_id
      WHERE i.resolved_at IS NULL OR ($1 AND i.resolved_at > now() - make_interval(days => $2))`,
    [withResolved, DONE_DAYS]
  );
  return rows;
}

function isMissingSchema(e: unknown): boolean {
  return (
    e instanceof Error &&
    /supplier_mail_|mail_board_|gmail_thread_id|resolved_at|resolved_by|reminded_at/.test(e.message) &&
    /does not exist|nie istnieje/.test(e.message)
  );
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
    if (m.kind === "supplier" || m.kind === "bounce" || m.kind === "other") answered.add(key);
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
      sentBy: c.sent_by ? String(c.sent_by) : null,
      resolved: Boolean(c.resolved_at),
      ...awaitingReplyTiming(c.reminded_at && c.reminded_at > c.sent_at ? c.reminded_at : c.sent_at, c.location, now),
    }))
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

/**
 * Wiadomości przypięte do otwartych spraw — bez limitu 30 dni widoku, żeby widok i licznik w menu
 * liczyły „po terminie” tak samo (zapytanie odpowiedziane dawno temu nie jest zaległe).
 */
async function loadCaseLinks(cases: readonly CaseRow[]): Promise<MailMessageRow[]> {
  if (!cases.length) return [];
  const { rows } = await query<Pick<MailMessageRow, "case_kind" | "case_id" | "kind">>(
    `SELECT case_kind, case_id, kind FROM public.supplier_mail_messages WHERE case_id = ANY($1::uuid[])`,
    [cases.map((c) => c.id)]
  );
  return rows as MailMessageRow[];
}

type BoardDbRow = {
  item_key: string;
  board_column: string | null;
  column_set_at: Date | null;
  note: string;
  waiting_on: string;
  remind_on: string | null;
  assignee_id: string | null;
};

async function loadBoardRows(keys: readonly string[]): Promise<Map<string, BoardRow>> {
  if (!keys.length) return new Map();
  const res = await query<BoardDbRow>(
    `SELECT item_key, board_column, column_set_at, note, waiting_on, to_char(remind_on, 'YYYY-MM-DD') AS remind_on, assignee_id
       FROM public.mail_board_items WHERE item_key = ANY($1::text[])`,
    [[...keys]]
  ).catch((e: unknown) => {
    // Kod przed migracją 183: sprawy z samej poczty, bez ręcznych kolumn.
    if (isMissingSchema(e)) return { rows: [] as BoardDbRow[] };
    throw e;
  });
  const { rows } = res;
  return new Map(
    rows.map((r) => [
      r.item_key,
      {
        column: isBoardColumn(r.board_column) ? r.board_column : null,
        columnSetAt: r.column_set_at ? r.column_set_at.toISOString() : null,
        note: r.note,
        waitingOn: r.waiting_on,
        remindOn: r.remind_on,
        assigneeId: r.assignee_id ? String(r.assignee_id) : null,
      },
    ])
  );
}

export const convBoardKey = (mailbox: string, threadId: string) => `conv:${mailbox}|${threadId}`;
export const caseBoardKey = (kind: "zd" | "inquiry", id: string) => `${kind}:${id}`;

/** Kolumna z samej poczty, zanim ktoś przeniesie sprawę ręcznie. */
function autoColumn(ref: BoardItem["ref"]): { column: BoardColumn; remindOn: string | null; reason?: string | null } {
  if (ref.type === "case") {
    const c = ref.item;
    if (c.resolved) return { column: "done", remindOn: null };
    if (c.overdue) return { column: "todo", remindOn: null, reason: "Brak odpowiedzi po terminie" };
    const from = warsawDateKeyFromIso(c.remindedAt && c.remindedAt > c.sentAt ? c.remindedAt : c.sentAt);
    return { column: "waiting", remindOn: addBusinessDaysKey(from, c.dueDays + 1) };
  }
  const c = ref.conv;
  // Należności agencji celnej (na tablicy są tylko one) — do przekazania do zapłaty.
  if (c.triage === "customs") return { column: c.handledVia ? "done" : "to_pay", remindOn: null };
  if (c.open) return { column: "todo", remindOn: null, reason: c.bounce ? "Mail nie doszedł" : null };
  // Faktura — do wpisania do Subiekta z terminem; „Do zapłaty” (przedpłata) ustawia się ręcznie.
  if (c.handledVia !== "initial" && c.category === "invoice") return { column: "invoices", remindOn: null };
  if (c.repliedAt && c.handledVia !== "manual") return { column: "waiting", remindOn: waitUntilAfter(c.repliedAt) };
  return { column: "done", remindOn: null };
}

/** Rozmowy i sprawy → pozycje tablicy z kolumną, opisem i osobą. */
export function boardItems(
  conversations: readonly MailConversation[],
  cases: readonly WaitingCase[],
  rows: ReadonlyMap<string, BoardRow>,
  today: string
): BoardItem[] {
  const refs: { key: string; inherit: string | null; ref: BoardItem["ref"] }[] = [
    ...conversations.map((conv) => ({
      key: convBoardKey(conv.mailbox, conv.threadId),
      // Odpowiedź na wysłane ZD / zapytanie dziedziczy opis i kolumnę sprawy, która na nią czekała.
      inherit: conv.caseKind && conv.caseId && conv.linkedBy !== "supplier" ? caseBoardKey(conv.caseKind, conv.caseId) : null,
      ref: { type: "conv" as const, conv },
    })),
    ...cases.map((item) => ({ key: caseBoardKey(item.kind, item.id), inherit: null, ref: { type: "case" as const, item } })),
  ];
  return refs.map(({ key, inherit, ref }) => {
    const row = rows.get(key) ?? (inherit ? rows.get(inherit) : undefined) ?? null;
    const isConv = ref.type === "conv";
    const derived = deriveColumn({
      auto: autoColumn(ref),
      lastIncomingAt: isConv ? ref.conv.lastAt : null,
      repliedAt: isConv ? ref.conv.repliedAt : (ref.item.remindedAt ?? ref.item.sentAt),
      row,
      today,
    });
    return {
      key,
      ref,
      ...derived,
      note: row?.note ?? "",
      waitingOn: row?.waitingOn || (isConv ? ref.conv.supplierName : ref.item.supplierName),
      assigneeId: row?.assigneeId ?? (isConv ? ref.conv.ownerUserId : ref.item.sentBy),
      manualColumn: rows.get(key)?.column ?? null,
      sortAt: isConv ? ref.conv.lastAt : (ref.item.remindedAt ?? ref.item.sentAt),
    };
  });
}

async function loadMailPeople(): Promise<MailPerson[]> {
  const { rows } = await query<{ id: string; email: string }>(
    `SELECT id, email FROM public.profiles WHERE role IN ('admin', 'zakupy') AND coalesce(email, '') <> '' ORDER BY email`
  );
  return rows.map((r) => {
    const local = r.email.split("@")[0] ?? r.email;
    const [first, last] = local.split(/[._-]/);
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return { id: String(r.id), name: last ? `${cap(first!)} ${cap(last).charAt(0)}.` : cap(local) };
  });
}

export async function loadSupplierMailView(now: Date = new Date()): Promise<SupplierMailView> {
  try {
    const [messages, cases, syncRes, people] = await Promise.all([
      // „Nie sprawa” z półki nie zajmuje miejsca w widoku (to_jsonb: kolumna triage jest od migracji 184).
      loadMailMessages(
        `m.received_at > now() - make_interval(days => $1) AND (to_jsonb(m) ->> 'triage') IS DISTINCT FROM 'ignored'`,
        [VIEW_DAYS]
      ),
      loadOpenCases(true),
      // Tylko skrzynki nadal połączone — odłączona nie zamraża „sprawdzono” na starej dacie.
      query<{ synced_at: Date; last_error: string | null }>(
        `SELECT s.synced_at, s.last_error FROM public.supplier_mail_sync s
          WHERE EXISTS (SELECT 1 FROM public.google_mail_connections c WHERE lower(c.google_email) = s.mailbox)`
      ),
      loadMailPeople(),
    ]);
    const all = groupConversations(messages);
    // Agencje i spedytorzy żyją w odprawach celnych; na tablicę trafiają tylko ich należności (płatność na już).
    const conversations = all.filter(
      (c) => c.triage === null || c.triage === "case" || (c.triage === "customs" && c.customsKind === "dues")
    );
    const waiting = waitingCases(cases, await loadCaseLinks(cases), now);
    const keys = [
      ...conversations.flatMap((c) => [convBoardKey(c.mailbox, c.threadId), ...(c.caseKind && c.caseId ? [caseBoardKey(c.caseKind, c.caseId)] : [])]),
      ...waiting.map((w) => caseBoardKey(w.kind, w.id)),
    ];
    const doneSince = new Date(now.getTime() - DONE_DAYS * 86_400_000).toISOString();
    const items = boardItems(conversations, waiting, await loadBoardRows(keys), todayDateKeyInWarsaw(now)).filter(
      // Zakończone z ostatnich 14 dni; pierwsza synchronizacja skrzynki nie zasypuje kolumny starociami.
      (i) => i.column !== "done" || (i.sortAt >= doneSince && !(i.ref.type === "conv" && i.ref.conv.handledVia === "initial" && !i.manualColumn))
    );
    const lastOk = syncRes.rows.map((r) => r.synced_at.getTime()).filter((t) => t > 0);
    return {
      items: items.sort((a, b) => b.sortAt.localeCompare(a.sortAt)),
      review: all.filter((c) => c.triage === "review"),
      customs: all.filter((c) => c.triage === "customs"),
      people,
      sync: {
        at: lastOk.length ? new Date(Math.min(...lastOk)).toISOString() : null,
        error: syncRes.rows.find((r) => r.last_error)?.last_error ?? null,
        mailboxes: syncRes.rows.length,
      },
    };
  } catch (e) {
    if (isMissingSchema(e)) return { items: [], review: [], customs: [], people: [], sync: { at: null, error: null, mailboxes: 0 } };
    throw e;
  }
}

/** Ile czeka na ruch tej osoby: jej Do zrobienia i jej półka „Do przejrzenia” (nieprzypisane też liczą się każdemu). */
export function countNeedsAction(view: Pick<SupplierMailView, "items" | "review">, userId: string): number {
  const mine = (owner: string | null) => !owner || owner === userId;
  return view.items.filter((i) => i.column === "todo" && mine(i.assigneeId)).length + view.review.filter((c) => mine(c.ownerUserId)).length;
}

/**
 * Licznik w menu — te same reguły co tablica i zakładka „Moje”.
 * ponytail: liczy cały widok (wiadomości z 30 dni); przy wolnym menu — licznik w SQL z mail_board_items.
 */
export async function countSupplierMailNeedsAction(userId: string, now: Date = new Date()): Promise<number> {
  try {
    return countNeedsAction(await loadSupplierMailView(now), userId);
  } catch (e) {
    // Licznik nie może zatrzymać menu, ale błąd bazy ma być widoczny w logach.
    console.error("[poczta] licznik", e);
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

/** Rozmowa agencji / spedytora na liście w odprawach celnych. */
export type CustomsMailThread = {
  key: string;
  mailbox: string;
  threadId: string;
  company: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  lastAt: string;
  kind: CustomsMailKind;
  /** open = czeka na nas; replied = odpisaliśmy (z OnTime albo z Gmaila), czekamy na agencję; done = zakończone. */
  state: "open" | "replied" | "done";
  attachments: { messageId: string; attachmentId: string; filename: string }[];
};

/** DHL Express ma własny panel w odprawach (przesyłki z AWB) — tu go nie dublujemy. */
const DHL_DOMAIN_RE = /@(.+\.)?(dhl\.com|dhlexpress\.pl)$/i;

/** Korespondencja agencji celnych i spedytorów z ostatnich 30 dni — do panelu w /zakupy/odprawy. */
export async function loadCustomsMail(): Promise<CustomsMailThread[]> {
  try {
    const rows = await loadMailMessages(`m.triage = 'customs' AND m.received_at > now() - make_interval(days => $1)`, [VIEW_DAYS]);
    const byThread = new Map<string, MailMessageRow[]>();
    for (const r of rows) {
      if (DHL_DOMAIN_RE.test(r.from_address)) continue;
      const k = `${r.mailbox}|${r.gmail_thread_id}`;
      byThread.set(k, [...(byThread.get(k) ?? []), r]);
    }
    return groupConversations(rows.filter((r) => byThread.has(`${r.mailbox}|${r.gmail_thread_id}`))).map((c) => {
      const list = byThread.get(c.key)!;
      return {
        key: convBoardKey(c.mailbox, c.threadId),
        mailbox: c.mailbox,
        threadId: c.threadId,
        company: c.supplierName,
        fromEmail: c.lastFromEmail,
        subject: c.subject,
        snippet: c.snippet,
        lastAt: c.lastAt,
        kind: c.customsKind ?? "request",
        state: list.some((m) => !m.handled_at)
          ? "open"
          : list.some((m) => m.handled_via === "reply" || m.handled_via === "gmail")
            ? "replied"
            : "done",
        attachments: list.flatMap((m) =>
          m.attachments
            .filter((a) => !isInlineImage(a))
            .map((a) => ({ messageId: m.id, attachmentId: a.attachmentId, filename: a.filename }))
        ),
      };
    });
  } catch (e) {
    if (isMissingSchema(e) || (e instanceof Error && /triage/.test(e.message))) return [];
    throw e;
  }
}

/** Odprawy w menu: sprawy agencji, które czekają na nas i blokują towar (prośby, należności, awizacje). */
export async function countCustomsMailNeedsAction(): Promise<number> {
  try {
    return (await loadCustomsMail()).filter((t) => t.state === "open" && t.kind !== "documents" && t.kind !== "quote").length;
  } catch (e) {
    console.error("[odprawy] licznik poczty agencji", e);
    return 0;
  }
}
