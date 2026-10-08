"use server";

// Poczta dostawców (Zakupy → Asystent): widok, synchronizacja, rozmowa, „Załatwione”, odpowiedź z OnTime.
// Odpowiedź zawsze z Gmaila zalogowanej osoby; gdy rozmowa jest w cudzej skrzynce — jej właściciel w DW.
import { isInlineImage } from "@/lib/mail/attachments";
import { forwardedConversationText } from "@/lib/supplier-mail/forward-text";
import { revalidatePath } from "next/cache";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { query } from "@/lib/db/pool";
import { extraAttachmentsError } from "@/lib/email/extra-attachments";
import { parseMailRecipients } from "@/lib/email/recipients";
import {
  fetchGmailAttachment,
  getGmailMessageMeta,
  getGmailThreadSentMessages,
  getGmailMessageText,
  getGmailOAuthConfig,
  type GmailAttachmentRef,
} from "@/lib/google/gmail";
import {
  getEmailSignature,
  getGmailConnection,
  getPaymentForwardEmail,
  resolveAwaitingSupplier,
  sendGmailAsUser,
} from "@/lib/google/gmail-connections";
import { addBusinessDaysKey, isBoardColumn, WAIT_BUSINESS_DAYS, type BoardColumn } from "@/lib/mail-board/board";
import { rulePattern } from "@/lib/mail-board/triage";
import {
  convBoardKey,
  loadMailMessages,
  loadSupplierMailView,
  type SupplierMailView,
} from "@/lib/supplier-mail/data";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import { mailboxAccessToken } from "@/lib/supplier-mail/mailbox";
import { syncSupplierMail } from "@/lib/supplier-mail/sync";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

const THREAD_RE = /^[0-9a-f]{6,40}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Fail = { ok: false; message: string };

/** Poczta czyta cudze skrzynki — jak strona Asystenta: tylko admin i zakupy. */
async function requireMailUser(intent: "read" | "mutate") {
  const user = await requireZdEstimateAdmin(intent);
  if (user.role !== "admin" && user.role !== "zakupy") throw new Error("Brak uprawnień do poczty dostawców");
  return user;
}

function validConversation(input: { mailbox?: unknown; threadId?: unknown }): { mailbox: string; threadId: string } | null {
  const mailbox = String(input?.mailbox ?? "").trim().toLowerCase();
  const threadId = String(input?.threadId ?? "").trim();
  return mailbox.includes("@") && THREAD_RE.test(threadId) ? { mailbox, threadId } : null;
}

/** Dłużej nie trzymamy strony — pierwsza synchronizacja (30 dni, limit Gmaila) trwa minuty; dalej idzie w tle. */
const SYNC_WAIT_MS = 20_000;

/**
 * Widok z bazy; `sync` — najpierw dociąga nowe maile (gdy minęło 5 min od ostatniej synchronizacji).
 * `syncPending` — przebieg trwa dalej; ponowne wywołanie z `sync` dołącza do niego.
 */
export async function actionSupplierMailView(opts: { sync?: boolean; force?: boolean } = {}): Promise<
  | {
      ok: true;
      view: SupplierMailView;
      me: string | null;
      meId: string;
      canReply: boolean;
      signature: string;
      paymentForwardEmail: string;
      syncErrors: string[];
      syncPending: boolean;
    }
  | Fail
> {
  const user = await requireMailUser("read");
  try {
    let syncErrors: string[] = [];
    let syncPending = false;
    if (opts.sync && getGmailOAuthConfig()) {
      const sync = syncSupplierMail({ force: Boolean(opts.force) }).then(
        (r) => r.errors,
        (e: unknown) => [e instanceof Error ? e.message : String(e)]
      );
      const done = await Promise.race([sync, new Promise<null>((r) => setTimeout(() => r(null), SYNC_WAIT_MS))]);
      syncPending = done === null;
      syncErrors = done ?? [];
    }
    const [view, conn, signature, paymentForwardEmail] = await Promise.all([
      loadSupplierMailView(),
      getGmailConnection(user.id),
      getEmailSignature(user.id).catch(() => ""),
      getPaymentForwardEmail(user.id).catch(() => ""),
    ]);
    return {
      ok: true,
      view,
      me: conn?.email ?? null,
      meId: user.id,
      canReply: Boolean(conn),
      signature,
      paymentForwardEmail,
      syncErrors,
      syncPending,
    };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wczytać poczty dostawców.") };
  }
}

export type ConversationMessage = {
  id: string;
  /** mine = nasza wiadomość w wątku (z Gmaila, SENT) — żeby rozmowa była cała, nie tylko to, co przyszło. */
  kind: "supplier" | "auto" | "bounce" | "other" | "mine";
  /** Tylko „mine”: do kogo. */
  to?: string;
  category: string;
  from: string;
  fromName: string;
  subject: string;
  receivedAt: string;
  /** Pełna treść (bez cytatu); null = nie udało się pobrać — wtedy pokazujemy fragment. */
  text: string | null;
  snippet: string;
  attachments: GmailAttachmentRef[];
  handled: boolean;
};

/** Rozmowa: wiadomości od nadawcy i nasze odpowiedzi z pełną treścią (z Gmaila skrzynki, w której są). */
export async function actionSupplierMailConversation(input: {
  mailbox: string;
  threadId: string;
}): Promise<{ ok: true; messages: ConversationMessage[]; signature: string } | Fail> {
  const user = await requireMailUser("read");
  const conv = validConversation(input);
  if (!conv) return { ok: false, message: "Nieprawidłowa rozmowa." };
  try {
    const rows = await loadMailMessages(`m.mailbox = $1 AND m.gmail_thread_id = $2`, [conv.mailbox, conv.threadId]);
    if (!rows.length) return { ok: false, message: "Nie znaleziono rozmowy - odśwież listę." };
    const token = await mailboxAccessToken(conv.mailbox).catch(() => null);
    // Błąd odczytu wątku nie zasłania rozmowy — pokazujemy wtedy same wiadomości przychodzące.
    const sent = token ? ((await getGmailThreadSentMessages(token, conv.threadId).catch(() => null)) ?? []) : [];
    const texts = await readTexts(conv.mailbox, [
      ...rows.slice(0, 12).map((r) => r.gmail_message_id),
      ...sent.slice(-6).map((m) => m.id),
    ]);
    const signature = await getEmailSignature(user.id).catch(() => "");
    const mine: ConversationMessage[] = sent.map((m) => ({
      id: m.id,
      kind: "mine",
      to: m.to,
      category: "reply",
      from: conv.mailbox,
      fromName: "",
      subject: m.subject,
      receivedAt: m.at,
      text: texts.get(m.id) ?? null,
      snippet: m.snippet,
      attachments: [],
      handled: true,
    }));
    return {
      ok: true,
      signature,
      messages: [
        ...mine,
        ...rows.map((r): ConversationMessage => ({
          id: r.id,
          kind: r.kind,
          category: r.category,
          from: r.from_address,
          fromName: r.from_name,
          subject: r.subject,
          receivedAt: r.received_at.toISOString(),
          text: texts.get(r.gmail_message_id) ?? null,
          snippet: r.snippet,
          attachments: r.attachments,
          handled: Boolean(r.handled_at),
        })),
      ].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)),
    };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wczytać rozmowy.") };
  }
}

async function readTexts(mailbox: string, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const token = await mailboxAccessToken(mailbox).catch(() => null);
  if (!token) return out;
  await Promise.all(
    ids.map(async (id) => {
      const text = await getGmailMessageText(token, id).catch(() => null);
      if (text != null) out.set(id, text);
    })
  );
  return out;
}

async function markConversationHandled(
  conv: { mailbox: string; threadId: string },
  userId: string,
  via: "manual" | "reply"
): Promise<void> {
  const { rows } = await query<{ case_kind: string | null; case_id: string | null; kind: string }>(
    `UPDATE public.supplier_mail_messages SET handled_at = now(), handled_by = $3, handled_via = $4
      WHERE mailbox = $1 AND gmail_thread_id = $2 AND handled_at IS NULL
      RETURNING case_kind, case_id, kind`,
    [conv.mailbox, conv.threadId, userId, via]
  );
  const zdIds = [...new Set(rows.filter((r) => r.case_kind === "zd" && r.case_id && r.kind === "supplier").map((r) => r.case_id!))];
  if (zdIds.length) {
    await query(
      `UPDATE public.supplier_order_emails SET resolved_at = now(), resolved_by = $2 WHERE id = ANY($1::uuid[]) AND resolved_at IS NULL`,
      [zdIds, userId]
    );
  }
}

const BODY_MAX = 20_000;

/** Pliki z formularza → załączniki Gmaila; te same reguły co w przeglądarce (granica zaufania). */
async function mailFiles(
  raw: unknown
): Promise<{ ok: true; attachments: { filename: string; content: Buffer; contentType: string }[] } | Fail> {
  const list = raw ?? [];
  if (!Array.isArray(list) || list.some((f) => !(f instanceof File))) return { ok: false, message: "Nieprawidłowe załączniki." };
  const error = extraAttachmentsError(list as File[]);
  if (error) return { ok: false, message: error };
  return {
    ok: true,
    attachments: await Promise.all(
      (list as File[]).map(async (f) => ({
        filename: f.name.replace(/[\\/:*?"<>|\r\n]+/g, "-"),
        content: Buffer.from(await f.arrayBuffer()),
        contentType: f.type || "application/octet-stream",
      }))
    ),
  };
}

/**
 * Odpowiedź dostawcy z OnTime: „Re:” do ostatniej wiadomości od dostawcy, z Gmaila zalogowanej osoby.
 * We własnej skrzynce dołącza do wątku; w cudzej — właściciel rozmowy dostaje kopię (DW).
 */
export async function actionSupplierMailReply(input: {
  mailbox: string;
  threadId: string;
  body: string;
  cc?: string;
  /** Pliki dołożone do odpowiedzi (PDF, Excel, zdjęcia). */
  files?: File[];
}): Promise<{ ok: true; to: string[]; cc: string[] } | (Fail & { reconnect?: boolean })> {
  const user = await requireMailUser("mutate");
  const conv = validConversation(input);
  if (!conv) return { ok: false, message: "Nieprawidłowa rozmowa." };
  if (typeof input.body !== "string" || !input.body.trim()) return { ok: false, message: "Treść odpowiedzi jest pusta." };
  if (input.body.length > BODY_MAX) return { ok: false, message: "Treść jest za długa." };
  if (input.cc !== undefined && typeof input.cc !== "string") return { ok: false, message: "Nieprawidłowe DW." };
  const files = await mailFiles(input.files);
  if (!files.ok) return files;
  try {
    const rows = await loadMailMessages(`m.mailbox = $1 AND m.gmail_thread_id = $2`, [conv.mailbox, conv.threadId]);
    const last = rows.filter((r) => r.kind === "supplier" || r.kind === "auto" || r.kind === "other").sort((a, b) => b.received_at.getTime() - a.received_at.getTime())[0];
    if (!last) return { ok: false, message: "W tej rozmowie nie ma wiadomości od dostawcy, na którą można odpowiedzieć." };
    const conn = await getGmailConnection(user.id);
    if (!conn) return { ok: false, message: "Połącz swojego Gmaila w Ustawieniach.", reconnect: true };
    const own = conn.email.toLowerCase() === conv.mailbox;
    const ccRaw = [input.cc ?? "", own ? "" : conv.mailbox].filter(Boolean).join(", ");
    const recipients = parseMailRecipients(last.from_address, ccRaw);
    if (!recipients.ok) return recipients;
    const subject = /^\s*(re|odp|aw|r|sv)\s*:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`;
    const sent = await sendGmailAsUser({
      userId: user.id,
      to: recipients.to,
      cc: recipients.cc,
      subject: subject.slice(0, 300),
      text: input.body,
      attachments: files.attachments,
      kind: "supplier_reply",
      inReplyTo: last.rfc_message_id ?? undefined,
      gmailThreadId: own ? conv.threadId : undefined,
    });
    if (!sent.ok) return sent;
    await markConversationHandled(conv, user.id, "reply").catch((e) => console.error("[poczta] handled po odpowiedzi", e));
    revalidatePath("/zakupy/asystent");
    revalidatePath("/admin/wysylki");
    return { ok: true, to: recipients.to, cc: recipients.cc };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wysłać odpowiedzi.") };
  }
}

/**
 * Przypomnienie dostawcy, który nie odpisał: „Re:” do wysłanego ZD / zapytania (te same adresy),
 * z Gmaila zalogowanej osoby. Termin odpowiedzi liczy się od nowa od przypomnienia.
 */
export async function actionSupplierMailRemind(input: {
  kind: "zd" | "inquiry";
  id: string;
  body: string;
}): Promise<{ ok: true; to: string[] } | (Fail & { reconnect?: boolean })> {
  const user = await requireMailUser("mutate");
  if ((input?.kind !== "zd" && input?.kind !== "inquiry") || !UUID_RE.test(String(input?.id ?? ""))) {
    return { ok: false, message: "Nieprawidłowa sprawa." };
  }
  if (typeof input.body !== "string" || !input.body.trim()) return { ok: false, message: "Treść przypomnienia jest pusta." };
  if (input.body.length > BODY_MAX) return { ok: false, message: "Treść jest za długa." };
  try {
    const table = input.kind === "zd" ? "supplier_order_emails" : "supplier_inquiry_emails";
    const { rows } = await query<{ from_address: string; to_addresses: string[]; gmail_message_id: string | null; resolved_at: Date | null }>(
      `SELECT from_address, to_addresses, gmail_message_id, resolved_at FROM public.${table} WHERE id = $1`,
      [input.id]
    );
    const row = rows[0];
    if (!row) return { ok: false, message: "Nie znaleziono sprawy." };
    if (row.resolved_at) return { ok: false, message: "Ta sprawa jest już zamknięta." };
    const conn = await getGmailConnection(user.id);
    if (!conn) return { ok: false, message: "Połącz swojego Gmaila w Ustawieniach.", reconnect: true };
    const sender = row.from_address.toLowerCase();
    // Temat i Message-ID wysłanej wiadomości — z Gmaila nadawcy (wątek jest w jego skrzynce).
    const token = row.gmail_message_id ? await mailboxAccessToken(sender).catch(() => null) : null;
    const original = token && row.gmail_message_id ? await getGmailMessageMeta(token, row.gmail_message_id).catch(() => null) : null;
    const own = conn.email.toLowerCase() === sender;
    const recipients = parseMailRecipients(row.to_addresses.join(", "), own ? "" : sender);
    if (!recipients.ok) return recipients;
    const baseSubject = original?.subject?.trim() || (input.kind === "zd" ? "Order" : "Inquiry");
    const sent = await sendGmailAsUser({
      userId: user.id,
      to: recipients.to,
      cc: recipients.cc,
      subject: (/^\s*re\s*:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`).slice(0, 300),
      text: input.body,
      attachments: [],
      kind: "supplier_reply",
      inReplyTo: original?.rfcMessageId || undefined,
      references: original?.references,
      gmailThreadId: own && original ? original.threadId : undefined,
    });
    if (!sent.ok) return sent;
    await query(`UPDATE public.${table} SET reminded_at = now() WHERE id = $1`, [input.id]);
    revalidatePath("/zakupy/asystent");
    return { ok: true, to: recipients.to };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wysłać przypomnienia.") };
  }
}

/** Panel dzienny: tylko ważne — maile do dostawców, które nie doszły (zwroty). Z bazy, bez Gmaila. */
export async function actionSupplierMailBounces(): Promise<{ ok: true; suppliers: string[] } | Fail> {
  await requireZdEstimateAdmin("read");
  try {
    // Same nazwy dostawców — bez wczytywania całego widoku.
    const { rows } = await query<{ name: string }>(
      `SELECT DISTINCT s.name FROM public.supplier_mail_messages m JOIN public.suppliers s ON s.id = m.supplier_id
        WHERE m.kind = 'bounce' AND m.handled_at IS NULL AND m.received_at > now() - interval '30 days'
        ORDER BY s.name`
    );
    return { ok: true, suppliers: rows.map((r) => r.name) };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się sprawdzić poczty dostawców.") };
  }
}

// ─── Tablica spraw: kolumna, opis, na kogo czekam, kto obsługuje ───

type BoardKey =
  | { type: "conv"; key: string; mailbox: string; threadId: string }
  | { type: "case"; key: string; kind: "zd" | "inquiry"; id: string };

function parseBoardKey(raw: unknown): BoardKey | null {
  const key = String(raw ?? "");
  const conv = /^conv:(.+)\|([0-9a-f]{6,40})$/i.exec(key);
  if (conv) {
    const valid = validConversation({ mailbox: conv[1], threadId: conv[2] });
    return valid ? { type: "conv", key: convBoardKey(valid.mailbox, valid.threadId), ...valid } : null;
  }
  const cs = /^(zd|inquiry):(.+)$/.exec(key);
  return cs && UUID_RE.test(cs[2]!) ? { type: "case", key, kind: cs[1] as "zd" | "inquiry", id: cs[2]! } : null;
}

/**
 * Pierwszy zapis odpowiedzi na sprawę (ZD / zapytanie) przejmuje opis i kolumnę tej sprawy,
 * żeby zmiana jednego pola nie zgubiła reszty.
 */
async function adoptInherited(key: string, inheritKey: unknown): Promise<void> {
  const inherit = parseBoardKey(inheritKey);
  if (!inherit || inherit.type !== "case") return;
  await query(
    `INSERT INTO public.mail_board_items (item_key, board_column, column_set_at, note, waiting_on, remind_on, assignee_id)
     SELECT $1, board_column, column_set_at, note, waiting_on, remind_on, assignee_id
       FROM public.mail_board_items WHERE item_key = $2
     ON CONFLICT (item_key) DO NOTHING`,
    [key, inherit.key]
  );
}

/**
 * Przeniesienie sprawy do kolumny (`null` = z powrotem „z automatu”). Zakończone zamyka też sprawę
 * w poczcie (jak dawne „Załatwione”), wyjście z Zakończonych otwiera ją z powrotem.
 */
export async function actionMailBoardMove(input: {
  key: string;
  inheritKey?: string | null;
  column: BoardColumn | null;
  remindOn?: string | null;
}): Promise<{ ok: true } | Fail> {
  const user = await requireMailUser("mutate");
  const key = parseBoardKey(input?.key);
  if (!key) return { ok: false, message: "Nieprawidłowa sprawa." };
  const column = input.column;
  if (column !== null && !isBoardColumn(column)) return { ok: false, message: "Nieznana kolumna." };
  if (input.remindOn != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(input.remindOn))) return { ok: false, message: "Nieprawidłowa data." };
  const remindOn =
    column === "waiting" ? (input.remindOn ?? addBusinessDaysKey(todayDateKeyInWarsaw(), WAIT_BUSINESS_DAYS)) : null;
  try {
    await adoptInherited(key.key, input.inheritKey);
    await query(
      `INSERT INTO public.mail_board_items (item_key, board_column, column_set_at, remind_on, updated_by)
       VALUES ($1, $2, now(), $3, $4)
       ON CONFLICT (item_key) DO UPDATE SET board_column = EXCLUDED.board_column, column_set_at = now(),
         remind_on = EXCLUDED.remind_on, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [key.key, column, remindOn, user.id]
    );
    if (key.type === "conv") {
      if (column === "done") await markConversationHandled(key, user.id, "manual");
      else await reopenConversation(key);
    } else if (column === "done") {
      await resolveAwaitingSupplier(key.kind, key.id, user.id);
    } else {
      await query(
        key.kind === "zd"
          ? `UPDATE public.supplier_order_emails SET resolved_at = NULL, resolved_by = NULL WHERE id = $1`
          : `UPDATE public.supplier_inquiry_emails SET resolved_at = NULL WHERE id = $1`,
        [key.id]
      );
    }
    revalidatePath("/zakupy/asystent");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się przenieść sprawy.") };
  }
}

/** Wyjście z Zakończonych: wiadomości zamknięte ręcznie wracają, ZD zamknięte razem z nimi znowu czeka. */
async function reopenConversation(conv: { mailbox: string; threadId: string }): Promise<void> {
  const { rows } = await query<{ case_kind: string | null; case_id: string | null }>(
    `UPDATE public.supplier_mail_messages SET handled_at = NULL, handled_by = NULL, handled_via = NULL
      WHERE mailbox = $1 AND gmail_thread_id = $2 AND handled_via = 'manual'
      RETURNING case_kind, case_id`,
    [conv.mailbox, conv.threadId]
  );
  const zdIds = [...new Set(rows.filter((r) => r.case_kind === "zd" && r.case_id).map((r) => r.case_id!))];
  if (zdIds.length) {
    await query(`UPDATE public.supplier_order_emails SET resolved_at = NULL, resolved_by = NULL WHERE id = ANY($1::uuid[])`, [zdIds]);
  }
}

const NOTE_MAX = 2000;
const WAITING_ON_MAX = 200;

/** Opis, na kogo czekam, termin „wróć do tego” i kto obsługuje — tylko przekazane pola. */
export async function actionMailBoardSave(input: {
  key: string;
  inheritKey?: string | null;
  note?: string;
  waitingOn?: string;
  remindOn?: string | null;
  assigneeId?: string | null;
}): Promise<{ ok: true } | Fail> {
  const user = await requireMailUser("mutate");
  const key = parseBoardKey(input?.key);
  if (!key) return { ok: false, message: "Nieprawidłowa sprawa." };
  const has = (k: keyof typeof input) => Object.prototype.hasOwnProperty.call(input, k);
  if (has("note") && (typeof input.note !== "string" || input.note.length > NOTE_MAX)) return { ok: false, message: "Opis jest za długi." };
  if (has("waitingOn") && (typeof input.waitingOn !== "string" || input.waitingOn.length > WAITING_ON_MAX)) {
    return { ok: false, message: "Pole „czekam na” jest za długie." };
  }
  if (has("remindOn") && input.remindOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(input.remindOn))) {
    return { ok: false, message: "Nieprawidłowa data." };
  }
  if (has("assigneeId") && input.assigneeId !== null && !UUID_RE.test(String(input.assigneeId))) {
    return { ok: false, message: "Nieprawidłowa osoba." };
  }
  try {
    await adoptInherited(key.key, input.inheritKey);
    await query(
      `INSERT INTO public.mail_board_items (item_key, note, waiting_on, remind_on, assignee_id, updated_by)
       VALUES ($1, COALESCE($3, ''), COALESCE($5, ''), $7::date, $9::uuid, $10)
       ON CONFLICT (item_key) DO UPDATE SET
         note = CASE WHEN $2 THEN EXCLUDED.note ELSE mail_board_items.note END,
         waiting_on = CASE WHEN $4 THEN EXCLUDED.waiting_on ELSE mail_board_items.waiting_on END,
         remind_on = CASE WHEN $6 THEN EXCLUDED.remind_on ELSE mail_board_items.remind_on END,
         assignee_id = CASE WHEN $8 THEN EXCLUDED.assignee_id ELSE mail_board_items.assignee_id END,
         updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [
        key.key,
        has("note"),
        has("note") ? input.note!.trim() : null,
        has("waitingOn"),
        has("waitingOn") ? input.waitingOn!.trim() : null,
        has("remindOn"),
        has("remindOn") ? input.remindOn : null,
        has("assigneeId"),
        has("assigneeId") ? input.assigneeId : null,
        user.id,
      ]
    );
    revalidatePath("/zakupy/asystent");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się zapisać sprawy.") };
  }
}

/** Gmail przyjmuje 25 MB po zakodowaniu (+33%). */
const FORWARD_MAX_BYTES = 18 * 1024 * 1024;

/**
 * Przekazanie rozmowy dalej: nowy mail z Gmaila zalogowanej osoby z treścią wiadomości rozmowy i jej
 * załącznikami (np. awizacja do magazynu). `payment` — „Do zapłaty”: adres zapamiętuje się w profilu,
 * sprawa przechodzi do Czekam na płatność.
 */
export async function actionMailForward(input: {
  mailbox: string;
  threadId: string;
  to: string;
  note: string;
  purpose: "payment" | "plain";
  /** Tylko ta wiadomość rozmowy (id wiersza supplier_mail_messages); bez — cała rozmowa. */
  messageId?: string | null;
}): Promise<{ ok: true; to: string; attachments: number } | (Fail & { reconnect?: boolean })> {
  const user = await requireMailUser("mutate");
  const conv = validConversation(input);
  if (!conv) return { ok: false, message: "Nieprawidłowa rozmowa." };
  if (typeof input.note !== "string" || input.note.length > BODY_MAX) return { ok: false, message: "Treść jest za długa." };
  const payment = input.purpose === "payment";
  const recipients = parseMailRecipients(String(input.to ?? ""), "");
  if (!recipients.ok) return recipients;
  if (payment && recipients.to.length !== 1) return { ok: false, message: "Podaj jeden adres." };
  const to = recipients.to.join(", ");
  try {
    const messageId = typeof input.messageId === "string" && /^[0-9a-f-]{36}$/i.test(input.messageId) ? input.messageId : null;
    const rows = (await loadMailMessages(`m.mailbox = $1 AND m.gmail_thread_id = $2`, [conv.mailbox, conv.threadId])).filter(
      (m) => !messageId || m.id === messageId
    );
    if (!rows.length) return { ok: false, message: messageId ? "Nie znaleziono wiadomości." : "Nie znaleziono rozmowy." };
    const token = await mailboxAccessToken(conv.mailbox);
    if (!token) return { ok: false, message: "Skrzynka tej rozmowy nie jest połączona z OnTime." };
    const refs = rows.flatMap((m) =>
      m.attachments
        .filter((a) => !isInlineImage(a))
        .map((a) => ({ messageId: m.gmail_message_id, ref: a }))
    );
    if (refs.reduce((n, r) => n + (r.ref.size ?? 0), 0) > FORWARD_MAX_BYTES) {
      return { ok: false, message: "Załączniki są za duże na jeden mail - przekaż je z Gmaila." };
    }
    const attachments = [];
    for (const r of refs) {
      const content = await fetchGmailAttachment(token, r.messageId, r.ref.attachmentId);
      if (content) attachments.push({ filename: r.ref.filename, content, contentType: r.ref.mimeType || "application/octet-stream" });
    }
    const last = rows[0]!;
    const supplier = last.supplier_name ?? (last.from_name || last.from_address);
    const texts = await readTexts(conv.mailbox, rows.map((m) => m.gmail_message_id));
    const sent = await sendGmailAsUser({
      userId: user.id,
      to: recipients.to,
      subject: (payment ? `Do zapłaty: ${supplier} - ${last.subject || "faktura"}` : `Fwd: ${last.subject || supplier}`).slice(0, 300),
      text: [
        input.note.trim(),
        forwardedConversationText(rows.map((m) => ({ ...m, text: texts.get(m.gmail_message_id) ?? null }))),
        attachments.length ? "" : "Rozmowa nie ma załączników.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      attachments,
      kind: payment ? "payment_forward" : "supplier_reply",
    });
    if (!sent.ok) return sent;
    if (!payment) {
      revalidatePath("/admin/wysylki");
      return { ok: true, to, attachments: attachments.length };
    }
    const key = convBoardKey(conv.mailbox, conv.threadId);
    await query(`UPDATE public.profiles SET payment_forward_email = $2 WHERE id = $1`, [user.id, to]);
    await query(
      `INSERT INTO public.mail_board_items (item_key, board_column, column_set_at, waiting_on, remind_on, updated_by)
       VALUES ($1, 'waiting', now(), $2, $3, $4)
       ON CONFLICT (item_key) DO UPDATE SET board_column = 'waiting', column_set_at = now(), waiting_on = EXCLUDED.waiting_on,
         remind_on = EXCLUDED.remind_on, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [key, `płatność (${to})`, addBusinessDaysKey(todayDateKeyInWarsaw(), WAIT_BUSINESS_DAYS), user.id]
    );
    revalidatePath("/zakupy/asystent");
    revalidatePath("/admin/wysylki");
    return { ok: true, to, attachments: attachments.length };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się przekazać faktury.") };
  }
}

// ─── Półka „Do przejrzenia”: sprawa czy nie, z zapamiętaniem nadawcy ───

/**
 * Decyzja o rozmowie od nieznanego nadawcy. `remember` zapisuje regułę (adres albo domena) i od razu
 * stosuje ją do reszty półki; kolejne maile od tego nadawcy synchronizacja układa sama.
 * `decision: "review"` = „Cofnij” (z `forgetPattern` usuwa też zapisaną regułę).
 */
export async function actionMailTriage(input: {
  mailbox: string;
  threadId: string;
  /** customs = agencja celna / spedytor → odprawy celne. */
  decision: "case" | "ignore" | "customs" | "review";
  remember?: "none" | "sender" | "domain";
  forgetPattern?: string | null;
}): Promise<{ ok: true; pattern: string | null; alsoApplied: number } | Fail> {
  const user = await requireMailUser("mutate");
  const conv = validConversation(input);
  if (!conv) return { ok: false, message: "Nieprawidłowa rozmowa." };
  if (!["case", "ignore", "customs", "review"].includes(input.decision)) return { ok: false, message: "Nieznana decyzja." };
  const remember = input.remember ?? "none";
  if (!["none", "sender", "domain"].includes(remember)) return { ok: false, message: "Nieznany zakres." };
  const triage = ({ case: "case", ignore: "ignored", customs: "customs", review: "review" } as const)[input.decision];
  try {
    const { rows } = await query<{ from_address: string }>(
      `UPDATE public.supplier_mail_messages SET triage = $3
        WHERE mailbox = $1 AND gmail_thread_id = $2 AND kind = 'other'
        RETURNING from_address`,
      [conv.mailbox, conv.threadId, triage]
    );
    if (!rows.length) return { ok: false, message: "Nie znaleziono rozmowy." };

    if (input.decision === "review") {
      const pattern = typeof input.forgetPattern === "string" ? input.forgetPattern.toLowerCase() : null;
      if (pattern) {
        await query(`DELETE FROM public.mail_sender_rules WHERE pattern = $1`, [pattern]);
        // ponytail: cofa wszystkie nieobsłużone rozmowy tego nadawcy z decyzją reguły — także te,
        // które ktoś wcześniej rozstrzygnął ręcznie tak samo; dokładne cofanie wymagałoby dziennika decyzji.
        await query(
          `UPDATE public.supplier_mail_messages SET triage = 'review'
            WHERE kind = 'other' AND triage IN ('case', 'ignored', 'customs') AND handled_at IS NULL
              AND (lower(from_address) = $1 OR ($1 LIKE '@%' AND lower(from_address) LIKE '%' || $1))`,
          [pattern]
        );
      }
      revalidatePath("/zakupy/asystent");
      revalidatePath("/zakupy/odprawy");
      return { ok: true, pattern: null, alsoApplied: 0 };
    }

    let pattern: string | null = null;
    let alsoApplied = 0;
    if (remember !== "none") {
      pattern = rulePattern(rows[0]!.from_address, remember);
      if (!pattern) return { ok: false, message: "Dla poczty prywatnej (np. gmail.com) można zapamiętać tylko adres." };
      const decision = input.decision === "ignore" ? "ignore" : input.decision;
      await query(
        `INSERT INTO public.mail_sender_rules (pattern, decision, created_by) VALUES ($1, $2, $3)
         ON CONFLICT (pattern) DO UPDATE SET decision = EXCLUDED.decision, created_by = EXCLUDED.created_by, created_at = now()`,
        [pattern, decision, user.id]
      );
      const res = await query(
        `UPDATE public.supplier_mail_messages SET triage = $2
          WHERE kind = 'other' AND triage = 'review'
            AND (lower(from_address) = $1
                 OR ($1 LIKE '@%' AND (lower(from_address) LIKE '%' || $1 OR lower(from_address) LIKE '%.' || substr($1, 2))))`,
        [pattern, triage]
      );
      alsoApplied = res.rowCount ?? 0;
    }
    revalidatePath("/zakupy/asystent");
    revalidatePath("/zakupy/odprawy");
    return { ok: true, pattern, alsoApplied };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się zapisać decyzji.") };
  }
}
