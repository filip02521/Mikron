/**
 * Połączenia Gmail użytkowników (tabela google_mail_connections) i wysyłka „jako ja”.
 * Wysyłka zawsze z konta zalogowanej osoby — nigdy w imieniu kogoś innego.
 */

import { query } from "@/lib/db/pool";
import { plainTextEmailHtml } from "@/lib/email/plain-text-html";
import { recordTransactionalEmailLog } from "@/lib/services/transactional-email-log";
import type { TransactionalEmailKind } from "@/types/database";
import {
  GmailReconnectRequiredError,
  buildMimeMessage,
  decryptToken,
  encryptToken,
  getGmailOAuthConfig,
  gmailAccessToken,
  revokeGmailToken,
  sendGmailRaw,
  type GmailAttachment,
} from "@/lib/google/gmail";

export type GmailConnection = { email: string; connectedAt: string };

/** Połączenie, którego token da się odszyfrować — inaczej traktowane jak brak (UI: „Połącz”). */
export async function getGmailConnection(userId: string): Promise<GmailConnection | null> {
  const stored = await loadRefreshToken(userId);
  return stored ? { email: stored.email, connectedAt: stored.connectedAt } : null;
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

/**
 * Token nieodszyfrowalny (zmieniony GOOGLE_OAUTH_TOKEN_KEY, uszkodzony wpis) = martwe połączenie:
 * kasujemy je, żeby użytkownik dostał „Połącz z Gmailem”, a nie ogólny błąd przy każdej wysyłce.
 */
async function loadRefreshToken(
  userId: string
): Promise<{ email: string; token: string; connectedAt: string } | null> {
  const cfg = getGmailOAuthConfig();
  if (!cfg) return null;
  const { rows } = await query<{ google_email: string; refresh_token_enc: string; connected_at: Date }>(
    `SELECT google_email, refresh_token_enc, connected_at FROM public.google_mail_connections WHERE user_id = $1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  try {
    return {
      email: row.google_email,
      token: decryptToken(cfg.tokenKey, row.refresh_token_enc),
      connectedAt: row.connected_at.toISOString(),
    };
  } catch (e) {
    console.error("[gmail] nie odszyfrowano tokenu — usuwam połączenie", e instanceof Error ? e.message : e);
    await query(`DELETE FROM public.google_mail_connections WHERE user_id = $1`, [userId]);
    return null;
  }
}

export async function deleteGmailConnection(userId: string): Promise<void> {
  const stored = await loadRefreshToken(userId);
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
  subject: string;
  text: string;
  attachments: GmailAttachment[];
  kind: TransactionalEmailKind;
}): Promise<{ ok: true; from: string; messageId: string } | { ok: false; message: string; reconnect?: boolean }> {
  const cfg = getGmailOAuthConfig();
  if (!cfg) return { ok: false, message: "Wysyłka z Gmaila nie jest skonfigurowana na serwerze." };
  const stored = await loadRefreshToken(input.userId);
  if (!stored) return { ok: false, message: "Najpierw połącz swojego Gmaila.", reconnect: true };

  const html = plainTextEmailHtml(input.text);
  const log = {
    kind: input.kind,
    toAddresses: input.to,
    intendedTo: input.to,
    fromAddress: stored.email,
    subject: input.subject,
    htmlBody: html,
    hasAttachments: input.attachments.length > 0,
    attachmentNames: input.attachments.map((a) => a.filename),
  };
  try {
    const accessToken = await gmailAccessToken(cfg, stored.token);
    const mime = await buildMimeMessage({
      from: stored.email,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html,
      attachments: input.attachments,
    });
    const sent = await sendGmailRaw(accessToken, mime);
    await recordTransactionalEmailLog({ ...log, status: "sent", messageId: sent.id });
    return { ok: true, from: stored.email, messageId: sent.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordTransactionalEmailLog({ ...log, status: "failed", errorMessage: message });
    if (e instanceof GmailReconnectRequiredError) {
      await query(`DELETE FROM public.google_mail_connections WHERE user_id = $1`, [input.userId]);
      return { ok: false, message, reconnect: true };
    }
    return { ok: false, message };
  }
}

// ─── Podpis i ślad wysłanych ZD ───────────────────────────────────────────

export const EMAIL_SIGNATURE_MAX = 1000;

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
    signature.replace(/\r\n/g, "\n").trim().slice(0, EMAIL_SIGNATURE_MAX),
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
}): Promise<void> {
  await query(
    `INSERT INTO public.supplier_order_emails
       (subiekt_dok_id, dok_nr, supplier_id, sent_by, from_address, to_addresses, attachment_name, gmail_message_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [input.dokId, input.dokNr, input.supplierId, input.sentBy, input.from, input.to, input.attachmentName, input.gmailMessageId]
  );
}
