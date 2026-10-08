"use server";

// Poczta dostawców (Zakupy → Asystent): widok, synchronizacja, rozmowa, „Załatwione”, odpowiedź z OnTime.
// Odpowiedź zawsze z Gmaila zalogowanej osoby; gdy rozmowa jest w cudzej skrzynce — jej właściciel w DW.
import { revalidatePath } from "next/cache";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { query } from "@/lib/db/pool";
import { parseMailRecipients } from "@/lib/email/recipients";
import { getGmailMessageMeta, getGmailMessageText, getGmailOAuthConfig, type GmailAttachmentRef } from "@/lib/google/gmail";
import { getEmailSignature, getGmailConnection, sendGmailAsUser } from "@/lib/google/gmail-connections";
import { loadMailMessages, loadSupplierMailView, type SupplierMailView } from "@/lib/supplier-mail/data";
import { mailboxAccessToken } from "@/lib/supplier-mail/mailbox";
import { syncSupplierMail } from "@/lib/supplier-mail/sync";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

const THREAD_RE = /^[0-9a-f]{6,40}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Fail = { ok: false; message: string };

function validConversation(input: { mailbox?: unknown; threadId?: unknown }): { mailbox: string; threadId: string } | null {
  const mailbox = String(input?.mailbox ?? "").trim().toLowerCase();
  const threadId = String(input?.threadId ?? "").trim();
  return mailbox.includes("@") && THREAD_RE.test(threadId) ? { mailbox, threadId } : null;
}

/** Widok z bazy; `sync` — najpierw dociąga nowe maile (gdy minęło 5 min od ostatniej synchronizacji). */
export async function actionSupplierMailView(opts: { sync?: boolean; force?: boolean } = {}): Promise<
  { ok: true; view: SupplierMailView; me: string | null; canReply: boolean; signature: string; syncErrors: string[] } | Fail
> {
  const user = await requireZdEstimateAdmin("read");
  try {
    let syncErrors: string[] = [];
    if (opts.sync && getGmailOAuthConfig()) {
      syncErrors = (await syncSupplierMail({ force: Boolean(opts.force) })).errors;
    }
    const [view, conn, signature] = await Promise.all([
      loadSupplierMailView(),
      getGmailConnection(user.id),
      getEmailSignature(user.id).catch(() => ""),
    ]);
    return { ok: true, view, me: conn?.email ?? null, canReply: Boolean(conn), signature, syncErrors };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wczytać poczty dostawców.") };
  }
}

export type ConversationMessage = {
  id: string;
  kind: "supplier" | "auto" | "bounce";
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

/** Rozmowa: wiadomości od dostawcy z pełną treścią (z Gmaila skrzynki, w której są). */
export async function actionSupplierMailConversation(input: {
  mailbox: string;
  threadId: string;
}): Promise<{ ok: true; messages: ConversationMessage[]; signature: string } | Fail> {
  const user = await requireZdEstimateAdmin("read");
  const conv = validConversation(input);
  if (!conv) return { ok: false, message: "Nieprawidłowa rozmowa." };
  try {
    const rows = await loadMailMessages(`m.mailbox = $1 AND m.gmail_thread_id = $2`, [conv.mailbox, conv.threadId]);
    if (!rows.length) return { ok: false, message: "Nie znaleziono rozmowy - odśwież listę." };
    const texts = await readTexts(conv.mailbox, rows.slice(0, 12).map((r) => r.gmail_message_id));
    const signature = await getEmailSignature(user.id).catch(() => "");
    return {
      ok: true,
      signature,
      messages: [...rows]
        .sort((a, b) => a.received_at.getTime() - b.received_at.getTime())
        .map((r) => ({
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

/**
 * „Załatwione”: wszystkie otwarte wiadomości rozmowy. Odpowiedź dostawcy na wysłane ZD zamyka też
 * czekanie na to ZD (zapytania z tablicy zamyka odpowiedź handlowcowi w wątku).
 */
export async function actionSupplierMailHandle(input: { mailbox: string; threadId: string }): Promise<{ ok: true } | Fail> {
  const user = await requireZdEstimateAdmin("mutate");
  const conv = validConversation(input);
  if (!conv) return { ok: false, message: "Nieprawidłowa rozmowa." };
  try {
    await markConversationHandled(conv, user.id, "manual");
    revalidatePath("/zakupy/asystent");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się oznaczyć rozmowy.") };
  }
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

/**
 * Odpowiedź dostawcy z OnTime: „Re:” do ostatniej wiadomości od dostawcy, z Gmaila zalogowanej osoby.
 * We własnej skrzynce dołącza do wątku; w cudzej — właściciel rozmowy dostaje kopię (DW).
 */
export async function actionSupplierMailReply(input: {
  mailbox: string;
  threadId: string;
  body: string;
  cc?: string;
}): Promise<{ ok: true; to: string[]; cc: string[] } | (Fail & { reconnect?: boolean })> {
  const user = await requireZdEstimateAdmin("mutate");
  const conv = validConversation(input);
  if (!conv) return { ok: false, message: "Nieprawidłowa rozmowa." };
  if (typeof input.body !== "string" || !input.body.trim()) return { ok: false, message: "Treść odpowiedzi jest pusta." };
  if (input.body.length > BODY_MAX) return { ok: false, message: "Treść jest za długa." };
  if (input.cc !== undefined && typeof input.cc !== "string") return { ok: false, message: "Nieprawidłowe DW." };
  try {
    const rows = await loadMailMessages(`m.mailbox = $1 AND m.gmail_thread_id = $2`, [conv.mailbox, conv.threadId]);
    const last = rows.filter((r) => r.kind === "supplier" || r.kind === "auto").sort((a, b) => b.received_at.getTime() - a.received_at.getTime())[0];
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
      attachments: [],
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

/** Czekająca sprawa bez odpowiedzi — „Załatwione” (np. potwierdzenie telefoniczne). */
export async function actionSupplierMailResolveCase(input: { kind: "zd" | "inquiry"; id: string }): Promise<{ ok: true } | Fail> {
  const user = await requireZdEstimateAdmin("mutate");
  if ((input?.kind !== "zd" && input?.kind !== "inquiry") || !UUID_RE.test(String(input?.id ?? ""))) {
    return { ok: false, message: "Nieprawidłowa sprawa." };
  }
  try {
    await query(
      input.kind === "zd"
        ? `UPDATE public.supplier_order_emails SET resolved_at = now(), resolved_by = $2 WHERE id = $1 AND resolved_at IS NULL`
        : `UPDATE public.supplier_inquiry_emails SET resolved_at = now() WHERE id = $1 AND resolved_at IS NULL AND $2::uuid IS NOT NULL`,
      [input.id, user.id]
    );
    revalidatePath("/zakupy/asystent");
    if (input.kind === "inquiry") revalidatePath("/zakupy/tablica");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się zamknąć sprawy.") };
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
  const user = await requireZdEstimateAdmin("mutate");
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
    const view = await loadSupplierMailView();
    return { ok: true, suppliers: [...new Set(view.open.filter((c) => c.bounce).map((c) => c.supplierName))] };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się sprawdzić poczty dostawców.") };
  }
}

/**
 * „Cofnij” po „Załatwione”: wiadomości rozmowy zamknięte ręcznie w ostatnich 10 minutach wracają
 * do „Do reakcji”; ZD zamknięte razem z nimi znowu czeka.
 */
export async function actionSupplierMailReopen(input: { mailbox: string; threadId: string }): Promise<{ ok: true } | Fail> {
  await requireZdEstimateAdmin("mutate");
  const conv = validConversation(input);
  if (!conv) return { ok: false, message: "Nieprawidłowa rozmowa." };
  try {
    const { rows } = await query<{ case_kind: string | null; case_id: string | null; handled_at: Date }>(
      `UPDATE public.supplier_mail_messages m SET handled_at = NULL, handled_by = NULL, handled_via = NULL
         FROM (SELECT id, handled_at AS was FROM public.supplier_mail_messages
                WHERE mailbox = $1 AND gmail_thread_id = $2 AND handled_via = 'manual'
                  AND handled_at > now() - interval '10 minutes') prev
        WHERE m.id = prev.id
        RETURNING m.case_kind, m.case_id, prev.was AS handled_at`,
      [conv.mailbox, conv.threadId]
    );
    const zdIds = [...new Set(rows.filter((r) => r.case_kind === "zd" && r.case_id).map((r) => r.case_id!))];
    if (zdIds.length) {
      await query(
        `UPDATE public.supplier_order_emails SET resolved_at = NULL, resolved_by = NULL
          WHERE id = ANY($1::uuid[]) AND resolved_at > now() - interval '10 minutes'`,
        [zdIds]
      );
    }
    revalidatePath("/zakupy/asystent");
    return rows.length ? { ok: true } : { ok: false, message: "Nie ma czego cofnąć (minęło ponad 10 minut)." };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się cofnąć.") };
  }
}

/** „Cofnij” po „Załatwione” na sprawie bez odpowiedzi (do 10 minut). */
export async function actionSupplierMailReopenCase(input: { kind: "zd" | "inquiry"; id: string }): Promise<{ ok: true } | Fail> {
  await requireZdEstimateAdmin("mutate");
  if ((input?.kind !== "zd" && input?.kind !== "inquiry") || !UUID_RE.test(String(input?.id ?? ""))) {
    return { ok: false, message: "Nieprawidłowa sprawa." };
  }
  try {
    const { rowCount } = await query(
      input.kind === "zd"
        ? `UPDATE public.supplier_order_emails SET resolved_at = NULL, resolved_by = NULL WHERE id = $1 AND resolved_at > now() - interval '10 minutes'`
        : `UPDATE public.supplier_inquiry_emails SET resolved_at = NULL WHERE id = $1 AND resolved_at > now() - interval '10 minutes'`,
      [input.id]
    );
    revalidatePath("/zakupy/asystent");
    return rowCount ? { ok: true } : { ok: false, message: "Nie ma czego cofnąć (minęło ponad 10 minut)." };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się cofnąć.") };
  }
}
