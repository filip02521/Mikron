import { query } from "@/lib/db/pool";
import { decryptToken, getGmailOAuthConfig, gmailAccessToken } from "@/lib/google/gmail";

/** Token dostępu skrzynki (połączenie Gmail jej właściciela), w której leży rozmowa. Tylko serwer. */
export async function mailboxAccessToken(mailbox: string): Promise<string | null> {
  const cfg = getGmailOAuthConfig();
  if (!cfg) return null;
  const { rows } = await query<{ refresh_token_enc: string }>(
    `SELECT refresh_token_enc FROM public.google_mail_connections WHERE lower(google_email) = $1`,
    [mailbox.toLowerCase()]
  );
  return rows[0] ? gmailAccessToken(cfg, decryptToken(cfg.tokenKey, rows[0].refresh_token_enc)) : null;
}
