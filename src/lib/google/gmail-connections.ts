/**
 * Połączenia Gmail użytkowników (tabela google_mail_connections) i wysyłka „jako ja”.
 * Wysyłka zawsze z konta zalogowanej osoby — nigdy w imieniu kogoś innego.
 */

import { randomUUID } from "node:crypto";
import { query } from "@/lib/db/pool";
import { customsEmailHtml } from "@/lib/customs/customs-email";
import { normalizeEmailSignature } from "@/lib/email/signature";
import { recordTransactionalEmailLog } from "@/lib/services/transactional-email-log";
import { awaitingReplyStatus } from "@/lib/suppliers/awaiting-supplier";
import type { TransactionalEmailKind } from "@/types/database";
import {
  GmailRateLimitedError,
  GmailReconnectRequiredError,
  buildMimeMessage,
  decryptToken,
  fetchGmailAttachment,
  fetchGmailReplies,
  findGmailMessageByRfcId,
  getGmailMessageMeta,
  getGmailThreadId,
  isGmailTransportError,
  scopeCanReadReplies,
  type GmailReply,
  encryptToken,
  getGmailOAuthConfig,
  gmailAccessToken,
  revokeGmailToken,
  sendGmailRaw,
  sendGmailRawInThread,
  type GmailAttachment,
} from "@/lib/google/gmail";

export type GmailConnection = {
  email: string;
  connectedAt: string;
  /** Zgoda na odczyt odpowiedzi dostawców (gmail.readonly) — starsze połączenia jej nie mają. */
  canReadReplies: boolean;
};

export async function getGmailConnection(userId: string): Promise<GmailConnection | null> {
  const { rows } = await query<{ google_email: string; connected_at: Date; scope: string }>(
    `SELECT google_email, connected_at, scope FROM public.google_mail_connections WHERE user_id = $1`,
    [userId]
  );
  const row = rows[0];
  return row
    ? {
        email: row.google_email,
        connectedAt: row.connected_at.toISOString(),
        canReadReplies: scopeCanReadReplies(row.scope),
      }
    : null;
}

export async function saveGmailConnection(input: {
  userId: string;
  email: string;
  refreshToken: string;
  scope: string;
}): Promise<void> {
  const cfg = getGmailOAuthConfig();
  if (!cfg) throw new Error("Wysyłka z Gmaila nie jest skonfigurowana.");
  await query(
    `INSERT INTO public.google_mail_connections (user_id, google_email, refresh_token_enc, scope)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
       SET google_email = EXCLUDED.google_email,
           refresh_token_enc = EXCLUDED.refresh_token_enc,
           scope = EXCLUDED.scope,
           connected_at = now(),
           updated_at = now()`,
    [input.userId, input.email, encryptToken(cfg.tokenKey, input.refreshToken), input.scope]
  );
}

async function loadStoredConnection(userId: string): Promise<{ email: string; tokenEnc: string } | null> {
  const { rows } = await query<{ google_email: string; refresh_token_enc: string }>(
    `SELECT google_email, refresh_token_enc FROM public.google_mail_connections WHERE user_id = $1`,
    [userId]
  );
  return rows[0] ? { email: rows[0].google_email, tokenEnc: rows[0].refresh_token_enc } : null;
}

async function loadRefreshToken(userId: string): Promise<{ email: string; token: string } | null> {
  const cfg = getGmailOAuthConfig();
  if (!cfg) return null;
  const stored = await loadStoredConnection(userId);
  return stored ? { email: stored.email, token: decryptToken(cfg.tokenKey, stored.tokenEnc) } : null;
}

/** Konto Google podłączone w OnTime — wtedy jego zgody w Google nie cofamy. */
export async function isGoogleAccountConnected(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const { rows } = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.google_mail_connections WHERE lower(google_email) = $1`,
    [e]
  );
  return Boolean(rows[0]?.n);
}

export async function deleteGmailConnection(userId: string): Promise<void> {
  const stored = await loadRefreshToken(userId).catch(() => null);
  await query(`DELETE FROM public.google_mail_connections WHERE user_id = $1`, [userId]);
  if (stored) await revokeGmailToken(stored.token);
}

/**
 * Wysyła z Gmaila użytkownika i zapisuje w logu wysyłek (/admin/wysylki).
 * Gdy Google cofnął zgodę — kasuje martwe połączenie, żeby UI pokazało „Połącz ponownie”.
 */
export async function sendGmailAsUser(input: {
  userId: string;
  to: string[];
  /** Kopia (DW). */
  cc?: string[];
  subject: string;
  text: string;
  attachments: GmailAttachment[];
  kind: TransactionalEmailKind;
  /** Odpowiedź: Message-ID wiadomości dostawcy (In-Reply-To / References). */
  inReplyTo?: string;
  /** References wiadomości, na którą odpowiadamy (łańcuch wątku). */
  references?: string[];
  /** Wątek w skrzynce nadawcy — odpowiedź dołącza do niego w Gmailu (tylko gdy to ta sama skrzynka). */
  gmailThreadId?: string;
}): Promise<
  | { ok: true; from: string; messageId: string; threadId: string | null }
  | { ok: false; message: string; reconnect?: boolean; uncertain?: boolean }
> {
  const cfg = getGmailOAuthConfig();
  if (!cfg) return { ok: false, message: "Wysyłka z Gmaila nie jest skonfigurowana na serwerze." };
  const stored = await loadStoredConnection(input.userId);
  if (!stored) return { ok: false, message: "Najpierw połącz swojego Gmaila.", reconnect: true };

  const html = customsEmailHtml(input.text);
  const log = {
    kind: input.kind,
    toAddresses: input.to,
    ccAddresses: input.cc ?? [],
    intendedTo: input.to,
    fromAddress: stored.email,
    subject: input.subject,
    htmlBody: html,
    hasAttachments: input.attachments.length > 0,
    attachmentNames: input.attachments.map((a) => a.filename),
  };
  const rfcMessageId = `<ontime-${randomUUID()}@${stored.email.split("@")[1] ?? "ontime"}>`;
  let accessToken: string | null = null;
  /** Treść poszła do Gmaila — tylko wtedy zerwane połączenie znaczy „mogło wyjść”. */
  let sending = false;
  try {
    accessToken = await gmailAccessToken(cfg, decryptToken(cfg.tokenKey, stored.tokenEnc));
    const mime = await buildMimeMessage({
      from: stored.email,
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      text: input.text,
      html,
      attachments: input.attachments,
      inReplyTo: input.inReplyTo,
      references: input.references,
      messageId: rfcMessageId,
    });
    sending = true;
    const sent = input.gmailThreadId
      ? await sendGmailRawInThread(accessToken, mime, input.gmailThreadId)
      : await sendGmailRaw(accessToken, mime);
    await recordTransactionalEmailLog({ ...log, status: "sent", messageId: sent.id });
    return { ok: true, from: stored.email, messageId: sent.id, threadId: sent.threadId };
  } catch (e) {
    // Zerwane połączenie po wysłaniu treści — Gmail mógł wysłać; sprawdzamy „Wysłane” po naszym Message-ID,
    // zamiast pozwolić na drugą wysyłkę tego samego zamówienia.
    if (accessToken && sending && isGmailTransportError(e)) {
      const found = await findGmailMessageByRfcId(accessToken, rfcMessageId);
      if (found) {
        await recordTransactionalEmailLog({ ...log, status: "sent", messageId: found.id });
        return { ok: true, from: stored.email, messageId: found.id, threadId: found.threadId };
      }
      const message = "Połączenie z Gmailem zostało przerwane. Sprawdź „Wysłane” w Gmailu, zanim wyślesz ponownie.";
      await recordTransactionalEmailLog({ ...log, status: "failed", errorMessage: message });
      return { ok: false, message, uncertain: true };
    }
    const message = e instanceof Error ? e.message : String(e);
    await recordTransactionalEmailLog({ ...log, status: "failed", errorMessage: message });
    if (e instanceof GmailReconnectRequiredError) {
      // Tylko ten token — połączenie odnowione w innej karcie w trakcie wysyłki zostaje.
      await query(`DELETE FROM public.google_mail_connections WHERE user_id = $1 AND refresh_token_enc = $2`, [
        input.userId,
        stored.tokenEnc,
      ]);
      return { ok: false, message, reconnect: true };
    }
    return { ok: false, message };
  }
}

// ─── Podpis i ślad wysłanych ZD ───────────────────────────────────────────

export { EMAIL_SIGNATURE_MAX } from "@/lib/email/signature";

export async function getEmailSignature(userId: string): Promise<string> {
  const { rows } = await query<{ email_signature: string | null }>(
    `SELECT email_signature FROM public.profiles WHERE id = $1`,
    [userId]
  );
  return rows[0]?.email_signature ?? "";
}

export async function saveEmailSignature(userId: string, signature: string): Promise<void> {
  await query(`UPDATE public.profiles SET email_signature = $2 WHERE id = $1`, [
    userId,
    normalizeEmailSignature(signature),
  ]);
}

export type SupplierOrderEmail = { sentAt: string; from: string; to: string[]; attachmentName: string };

export async function lastSupplierOrderEmail(dokId: number): Promise<SupplierOrderEmail | null> {
  const { rows } = await query<{
    sent_at: Date;
    from_address: string;
    to_addresses: string[];
    attachment_name: string;
  }>(
    `SELECT sent_at, from_address, to_addresses, attachment_name
       FROM public.supplier_order_emails
      WHERE subiekt_dok_id = $1
      ORDER BY sent_at DESC
      LIMIT 1`,
    [dokId]
  );
  const row = rows[0];
  return row
    ? { sentAt: row.sent_at.toISOString(), from: row.from_address, to: row.to_addresses, attachmentName: row.attachment_name }
    : null;
}

export async function recordSupplierOrderEmail(input: {
  dokId: number;
  dokNr: string;
  supplierId: string;
  sentBy: string;
  from: string;
  to: string[];
  attachmentName: string;
  gmailMessageId: string;
  gmailThreadId?: string | null;
}): Promise<void> {
  const base = [input.dokId, input.dokNr, input.supplierId, input.sentBy, input.from, input.to, input.attachmentName, input.gmailMessageId];
  try {
    await query(
      `INSERT INTO public.supplier_order_emails
         (subiekt_dok_id, dok_nr, supplier_id, sent_by, from_address, to_addresses, attachment_name, gmail_message_id, gmail_thread_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [...base, input.gmailThreadId ?? null]
    );
  } catch (e) {
    // Kod wdrożony przed migracją 178 (brak gmail_thread_id) — ślad wysyłki nie może przepaść.
    if (!isMissingColumn(e, "gmail_thread_id")) throw e;
    await query(
      `INSERT INTO public.supplier_order_emails
         (subiekt_dok_id, dok_nr, supplier_id, sent_by, from_address, to_addresses, attachment_name, gmail_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      base
    );
  }
}

/** Błąd „kolumna nie istnieje” (migracja jeszcze nie uruchomiona). */
function isMissingColumn(e: unknown, column: string): boolean {
  return e instanceof Error && e.message.includes(column) && /does not exist|nie istnieje/.test(e.message);
}

// ─── Odpowiedzi dostawców w wątkach wysłanych maili ───────────────────────

/** Wynik odczytu wątku wysłanej wiadomości (ZD albo zapytanie z tablicy). */
export type SentThreadRead = {
  /** Link do wątku w Gmailu — tylko dla osoby, która wysłała (wątek jest w jej skrzynce). */
  gmailUrl: string | null;
} & (
  | { status: "read"; replies: GmailReply[] }
  /** Nie da się odczytać: nadawca bez połączenia z odczytem, wiadomość usunięta albo błąd Gmaila. */
  /** `retryLater` — limit Gmaila na minutę; za chwilę odczyt się uda. */
  | { status: "unavailable"; reason: string; reconnectSelf?: boolean; retryLater?: boolean }
);

type SentMailRow = {
  sent_by: string | null;
  from_address: string;
  gmail_message_id: string | null;
  /** Wątek zapisany przy wysyłce (178) — bez dodatkowego odczytu wiadomości w Gmailu. */
  gmail_thread_id?: string | null;
  /** Połączenie nadawcy — tylko gdy to ten sam adres, z którego poszła wiadomość. */
  refresh_token_enc: string | null;
  scope: string | null;
};

/** SQL: połączenie Gmail nadawcy — to samo konto, z którego poszła wiadomość. */
function senderConnectionJoin(alias: string): string {
  return `LEFT JOIN public.google_mail_connections c
     ON c.user_id = ${alias}.sent_by AND lower(c.google_email) = lower(${alias}.from_address)`;
}

/**
 * Odpowiedzi w wątkach wysłanych maili. Każdy wątek czytany z konta osoby, która wysłała
 * (tylko ten wątek — po id wiadomości). Jeden token na nadawcę.
 */
async function readSentThreads(
  rows: SentMailRow[],
  viewerId: string,
  opts: { withText?: boolean } = {}
): Promise<SentThreadRead[]> {
  const cfg = getGmailOAuthConfig();
  const tokens = new Map<string, Promise<string>>();
  return Promise.all(
    rows.map(async (row): Promise<SentThreadRead> => {
      const own = row.sent_by === viewerId;
      if (!cfg || !row.gmail_message_id) {
        return { gmailUrl: null, status: "unavailable", reason: "Brak śladu wiadomości w Gmailu." };
      }
      if (!row.refresh_token_enc || !scopeCanReadReplies(row.scope)) {
        return {
          gmailUrl: null,
          status: "unavailable",
          reason: own
            ? "Połącz Gmaila ponownie i zgódź się na odczyt, żeby widzieć odpowiedzi."
            : `${row.from_address} musi połączyć Gmaila ponownie (zgoda na odczyt).`,
          reconnectSelf: own,
        };
      }
      try {
        const senderKey = `${row.sent_by}|${row.from_address}`;
        let token = tokens.get(senderKey);
        if (!token) {
          token = gmailAccessToken(cfg, decryptToken(cfg.tokenKey, row.refresh_token_enc));
          tokens.set(senderKey, token);
        }
        const thread = await fetchGmailReplies(await token, row.gmail_message_id, { ...opts, threadId: row.gmail_thread_id });
        if (!thread) return { gmailUrl: null, status: "unavailable", reason: "Wiadomość usunięta ze skrzynki nadawcy." };
        return {
          gmailUrl: own
            ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(row.from_address)}#all/${thread.threadId}`
            : null,
          status: "read",
          replies: thread.replies,
        };
      } catch (e) {
        if (e instanceof GmailReconnectRequiredError) {
          return {
            gmailUrl: null,
            status: "unavailable",
            reason: own ? e.message : `Połączenie Gmaila ${row.from_address} wygasło.`,
            reconnectSelf: own,
          };
        }
        if (e instanceof GmailRateLimitedError) {
          return { gmailUrl: null, status: "unavailable", reason: e.message, retryLater: true };
        }
        return { gmailUrl: null, status: "unavailable", reason: e instanceof Error ? e.message : String(e) };
      }
    })
  );
}

export type SupplierOrderReplies = {
  dokId: number;
  dokNr: string;
  sentAt: string;
  from: string;
  to: string[];
} & SentThreadRead;

const REPLIES_DAYS = 90;
const REPLIES_LIMIT = 5;

/** Karta dostawcy: ostatnie ZD wysłane z OnTime i odpowiedzi w ich wątkach. */
export async function supplierOrderReplies(supplierId: string, viewerId: string): Promise<SupplierOrderReplies[]> {
  const { rows } = await query<
    SentMailRow & { subiekt_dok_id: number; dok_nr: string; sent_at: Date; to_addresses: string[] }
  >(
    `SELECT e.subiekt_dok_id, e.dok_nr, e.sent_at, e.sent_by, e.from_address, e.to_addresses, e.gmail_message_id, e.gmail_thread_id,
            c.refresh_token_enc, c.scope
       FROM (
         SELECT DISTINCT ON (subiekt_dok_id) *
           FROM public.supplier_order_emails
          WHERE supplier_id = $1 AND sent_at > now() - make_interval(days => $2)
          ORDER BY subiekt_dok_id, sent_at DESC
       ) e
       ${senderConnectionJoin("e")}
      ORDER BY e.sent_at DESC
      LIMIT $3`,
    [supplierId, REPLIES_DAYS, REPLIES_LIMIT]
  );
  const reads = await readSentThreads(rows, viewerId);
  return rows.map((row, i) => ({
    dokId: Number(row.subiekt_dok_id),
    dokNr: row.dok_nr || `ZD ${row.subiekt_dok_id}`,
    sentAt: row.sent_at.toISOString(),
    from: row.from_address,
    to: row.to_addresses ?? [],
    ...reads[i],
  }));
}

// ─── „Czeka na dostawcę” — wysłane ZD i zapytania bez zamknięcia ───────────

export type AwaitingSupplierKind = "zd" | "inquiry";

/** Ręczne „Załatwione” — np. dostawca potwierdził telefonicznie. false = już zamknięte albo nie ma. */
export async function resolveAwaitingSupplier(kind: AwaitingSupplierKind, id: string, userId: string): Promise<boolean> {
  const { rowCount } =
    kind === "zd"
      ? await query(
          `UPDATE public.supplier_order_emails SET resolved_at = now(), resolved_by = $2
            WHERE id = $1 AND resolved_at IS NULL`,
          [id, userId]
        )
      : await query(`UPDATE public.supplier_inquiry_emails SET resolved_at = now() WHERE id = $1 AND resolved_at IS NULL`, [
          id,
        ]);
  return (rowCount ?? 0) > 0;
}

// ─── Odpowiedzi dostawców w wątku pytania z tablicy ───────────────────────

export type BoardInquiryReplies = {
  inquiryId: string;
  supplierName: string;
  sentAt: string;
  resolvedAt: string | null;
} & SentThreadRead;

/** Zapytania „Zapytaj dostawcę” z wątku tablicy (najnowsze 3) z pełną treścią odpowiedzi dostawcy. */
export async function boardInquiryReplies(threadId: string, viewerId: string): Promise<BoardInquiryReplies[]> {
  const { rows } = await query<
    SentMailRow & { id: string; supplier_name: string; sent_at: Date; resolved_at: Date | null }
  >(
    `SELECT i.id, i.supplier_name, i.sent_at, i.resolved_at, i.sent_by, i.from_address, i.gmail_message_id, i.gmail_thread_id,
            c.refresh_token_enc, c.scope
       FROM public.supplier_inquiry_emails i
       ${senderConnectionJoin("i")}
      WHERE i.thread_id = $1
      ORDER BY i.sent_at DESC
      LIMIT 3`,
    [threadId]
  );
  const reads = await readSentThreads(rows, viewerId, { withText: true });
  return rows.map((row, i) => ({
    inquiryId: String(row.id),
    supplierName: row.supplier_name,
    sentAt: row.sent_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    ...reads[i],
  }));
}

/** Ile PDF-ów z jednej odpowiedzi czyta AI i jak duże (Gemini przyjmuje do ~20 MB na zapytanie). */
const AI_PDF_MAX_FILES = 3;
const AI_PDF_MAX_BYTES = 8 * 1024 * 1024;
const AI_PDF_MAX_TOTAL = 15 * 1024 * 1024;

export type BoardReplyForAi = {
  supplierName: string;
  reply: GmailReply;
  pdfs: Array<{ filename: string; data: Buffer }>;
  /** PDF-y pominięte (za duże / ponad limit / nie dało się pobrać). */
  skippedPdfs: string[];
};

/**
 * Jedna odpowiedź dostawcy z wątku pytania razem z załącznikami PDF — dla propozycji odpowiedzi (AI).
 * Czytane z konta osoby, która wysłała zapytanie. null = brak zapytania, odpowiedzi albo dostępu.
 */
/** Zapytanie z wątku tablicy i token Gmaila osoby, która je wysłała (odpowiedzi są w jej skrzynce). */
async function inquirySenderMailbox(
  threadId: string,
  inquiryId: string
): Promise<{ row: SentMailRow & { supplier_name: string; gmail_message_id: string }; token: string } | null> {
  const cfg = getGmailOAuthConfig();
  if (!cfg) return null;
  const { rows } = await query<SentMailRow & { supplier_name: string }>(
    `SELECT i.supplier_name, i.sent_by, i.from_address, i.gmail_message_id, i.gmail_thread_id, c.refresh_token_enc, c.scope
       FROM public.supplier_inquiry_emails i
       ${senderConnectionJoin("i")}
      WHERE i.id = $1 AND i.thread_id = $2`,
    [inquiryId, threadId]
  );
  const row = rows[0];
  if (!row?.gmail_message_id || !row.refresh_token_enc || !scopeCanReadReplies(row.scope)) return null;
  const token = await gmailAccessToken(cfg, decryptToken(cfg.tokenKey, row.refresh_token_enc));
  return { row: { ...row, gmail_message_id: row.gmail_message_id }, token };
}

/**
 * Załączniki z jednej odpowiedzi dostawcy na zapytanie z tablicy — do dołączenia w odpowiedzi handlowcowi.
 * Tylko wiadomość z wątku tego zapytania (nie dowolny mail ze skrzynki); jeden odczyt wiadomości na
 * wszystkie pliki. Wynik w kolejności `filenames`: plik, „too_big” (rozmiar z Gmaila, bez pobierania)
 * albo null (nie ma takiego pliku). null zamiast tablicy = brak zapytania, wiadomości albo dostępu.
 */
export async function boardReplyAttachments(input: {
  threadId: string;
  inquiryId: string;
  replyId: string;
  filenames: readonly string[];
  maxBytes: number;
}): Promise<Array<{ filename: string; data: Buffer } | "too_big" | null> | null> {
  const box = await inquirySenderMailbox(input.threadId, input.inquiryId);
  if (!box) return null;
  const [meta, inquiryThread] = await Promise.all([
    getGmailMessageMeta(box.token, input.replyId),
    box.row.gmail_thread_id || getGmailThreadId(box.token, box.row.gmail_message_id),
  ]);
  if (!meta || !inquiryThread || meta.threadId !== inquiryThread || meta.labelIds.includes("SENT")) return null;
  return Promise.all(
    input.filenames.map(async (filename) => {
      // attachmentId z tego odczytu — Gmail zmienia je przy każdym pobraniu wiadomości.
      const ref = meta.attachments.find((a) => a.filename === filename);
      if (!ref) return null;
      if (ref.size > input.maxBytes) return "too_big" as const;
      const data = await fetchGmailAttachment(box.token, input.replyId, ref.attachmentId);
      if (!data) return null;
      return data.length > input.maxBytes ? ("too_big" as const) : { filename: ref.filename, data };
    })
  );
}

export async function boardReplyForAi(input: {
  threadId: string;
  inquiryId: string;
  replyId: string;
}): Promise<BoardReplyForAi | null> {
  const box = await inquirySenderMailbox(input.threadId, input.inquiryId);
  if (!box) return null;
  const { row, token } = box;
  const thread = await fetchGmailReplies(token, row.gmail_message_id, { withText: true, threadId: row.gmail_thread_id });
  const reply = thread?.replies.find((r) => r.id === input.replyId);
  if (!reply) return null;

  const pdfs: BoardReplyForAi["pdfs"] = [];
  const skippedPdfs: string[] = [];
  // Wybór po rozmiarze z nagłówka, potem pobranie równolegle (kolejność zostaje).
  const picked: NonNullable<typeof reply.pdfs> = [];
  let declared = 0;
  for (const ref of reply.pdfs ?? []) {
    if (picked.length >= AI_PDF_MAX_FILES || ref.size > AI_PDF_MAX_BYTES || declared + ref.size > AI_PDF_MAX_TOTAL) {
      skippedPdfs.push(ref.filename);
      continue;
    }
    declared += ref.size;
    picked.push(ref);
  }
  const downloaded = await Promise.all(
    picked.map((ref) => fetchGmailAttachment(token, reply.id, ref.attachmentId).catch(() => null))
  );
  let total = 0;
  for (const [i, ref] of picked.entries()) {
    const data = downloaded[i];
    // Tylko prawdziwy PDF (nazwa „.pdf” bywa na czymkolwiek); rozmiar z nagłówka bywa pusty — liczy się pobrany.
    if (
      !data ||
      data.subarray(0, 4).toString("latin1") !== "%PDF" ||
      data.length > AI_PDF_MAX_BYTES ||
      total + data.length > AI_PDF_MAX_TOTAL
    ) {
      skippedPdfs.push(ref.filename);
      continue;
    }
    total += data.length;
    pdfs.push({ filename: ref.filename, data });
  }
  return { supplierName: row.supplier_name, reply, pdfs, skippedPdfs };
}

/**
 * Które otwarte zapytania z wątku tablicy mają już odpowiedź dostawcy (Gmail nadawcy).
 * Odpowiedź zakupów zamyka tylko te — pośrednie „zapytałem, dam znać” nie kończy czekania.
 * Gdy wątku nie da się odczytać (brak zgody, błąd Gmaila) — zapytanie też jest zwracane:
 * bez wiedzy o odpowiedzi zachowujemy dawną regułę (odpowiedź zakupów zamyka).
 */
export async function inquiriesToResolveOnReply(threadId: string): Promise<string[]> {
  const { rows } = await query<SentMailRow & { id: string }>(
    `SELECT i.id, i.sent_by, i.from_address, i.gmail_message_id, i.gmail_thread_id, c.refresh_token_enc, c.scope
       FROM public.supplier_inquiry_emails i
       ${senderConnectionJoin("i")}
      WHERE i.thread_id = $1 AND i.resolved_at IS NULL`,
    [threadId]
  );
  if (!rows.length) return [];
  const [reads, linked] = await Promise.all([
    readSentThreads(rows, ""),
    // Odpowiedź przypięta w Poczcie dostawców także poza wątkiem wysyłki (numer zapytania w osobnym mailu).
    query<{ case_id: string }>(
      `SELECT DISTINCT case_id FROM public.supplier_mail_messages
        WHERE case_kind = 'inquiry' AND case_id = ANY($1::uuid[]) AND kind IN ('supplier', 'bounce')`,
      [rows.map((r) => r.id)]
    )
      .then((r) => new Set(r.rows.map((x) => String(x.case_id))))
      .catch(() => new Set<string>()),
  ]);
  return rows
    .filter((row, i) => {
      const read = reads[i]!;
      // Zwrot też: zakupy odpisały handlowcowi, że mail nie doszedł — sprawa nie może wisieć na tablicy.
      const status = read.status === "read" ? awaitingReplyStatus(read.replies) : null;
      return read.status === "unavailable" || status === "replied" || status === "bounced" || linked.has(String(row.id));
    })
    .map((r) => String(r.id));
}

/** Adres, na który „Do zapłaty” przekazuje faktury (np. księgowość) — zapamiętany per osoba. */
export async function getPaymentForwardEmail(userId: string): Promise<string> {
  const { rows } = await query<{ payment_forward_email: string | null }>(
    `SELECT payment_forward_email FROM public.profiles WHERE id = $1`,
    [userId]
  );
  return rows[0]?.payment_forward_email ?? "";
}
