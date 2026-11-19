import { query } from "@/lib/db/pool";
import { decryptToken, encryptToken } from "@/lib/google/gmail";
import { MikranAuthError, refreshMikranTokens, type MikranTokens } from "@/lib/mikran-shop/oauth";

/**
 * Połączenie z API mikran.pl zapisane po logowaniu administratora (tabela mikran_api_connection, jeden wiersz).
 * Tokeny szyfrowane tym samym kluczem co Gmail (GOOGLE_OAUTH_TOKEN_KEY, AES-256-GCM).
 */

export type MikranConnection = {
  connectedAt: string;
  connectedByEmail: string | null;
  scope: string;
};

type Row = {
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_expires_at: Date | null;
  scope: string;
};

/** Odświeżamy token z zapasem — żądanie nie powinno trafić w sklep z tokenem wygasającym w trakcie. */
const EXPIRY_MARGIN_MS = 60_000;

function tokenKey(): Buffer {
  const key = Buffer.from(process.env.GOOGLE_OAUTH_TOKEN_KEY?.trim() ?? "", "base64");
  if (key.length !== 32) {
    throw new MikranAuthError("Brak klucza szyfrowania tokenów (GOOGLE_OAUTH_TOKEN_KEY) na serwerze OnTime — połączenia nie da się zapisać.");
  }
  return key;
}

function decrypt(enc: string): string {
  try {
    return decryptToken(tokenKey(), enc);
  } catch (e) {
    if (e instanceof MikranAuthError) throw e;
    throw new MikranAuthError("Zapisanego połączenia z mikran.pl nie da się odczytać — połącz helpdesk ponownie.");
  }
}

export async function getMikranConnection(): Promise<MikranConnection | null> {
  const { rows } = await query<{ connected_at: Date; email: string | null; scope: string }>(
    `SELECT c.connected_at, p.email, c.scope
       FROM public.mikran_api_connection c
       LEFT JOIN public.profiles p ON p.id = c.connected_by
      WHERE c.id = 1`
  );
  const row = rows[0];
  return row ? { connectedAt: row.connected_at.toISOString(), connectedByEmail: row.email, scope: row.scope } : null;
}

export async function hasMikranConnection(): Promise<boolean> {
  const { rows } = await query<{ n: number }>(`SELECT count(*)::int AS n FROM public.mikran_api_connection WHERE id = 1`);
  return Boolean(rows[0]?.n);
}

export async function saveMikranConnection(tokens: MikranTokens, userId: string | null): Promise<void> {
  if (!tokens.refreshToken) {
    throw new MikranAuthError("Sklep mikran.pl nie wydał tokenu odświeżania — bez niego połączenie wygaśnie po godzinie. Sprawdź, czy klient „ontime” ma włączone refresh_token.");
  }
  const key = tokenKey();
  await query(
    `INSERT INTO public.mikran_api_connection (id, refresh_token_enc, access_token_enc, access_expires_at, scope, connected_by)
     VALUES (1, $1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET refresh_token_enc = EXCLUDED.refresh_token_enc,
           access_token_enc = EXCLUDED.access_token_enc,
           access_expires_at = EXCLUDED.access_expires_at,
           scope = EXCLUDED.scope,
           connected_by = EXCLUDED.connected_by,
           connected_at = now(),
           updated_at = now()`,
    [encryptToken(key, tokens.refreshToken), encryptToken(key, tokens.accessToken), tokens.expiresAt, tokens.scope, userId]
  );
}

export async function deleteMikranConnection(): Promise<void> {
  await query(`DELETE FROM public.mikran_api_connection WHERE id = 1`);
}

async function loadRow(): Promise<Row | null> {
  const { rows } = await query<Row>(
    `SELECT refresh_token_enc, access_token_enc, access_expires_at, scope FROM public.mikran_api_connection WHERE id = 1`
  );
  return rows[0] ?? null;
}

// shortcut: odświeżanie scalane w jednym procesie Node; przy kilku procesach naraz każdy może odświeżyć sam —
// wtedy blokada wiersza (SELECT … FOR UPDATE w transakcji).
let refreshing: Promise<string> | null = null;

async function refreshStored(row: Row): Promise<string> {
  let tokens: MikranTokens;
  try {
    tokens = await refreshMikranTokens(decrypt(row.refresh_token_enc));
  } catch (e) {
    if (e instanceof MikranAuthError) {
      throw new MikranAuthError("Połączenie z helpdeskiem mikran.pl wygasło albo zostało cofnięte — połącz je ponownie.");
    }
    throw e;
  }
  const key = tokenKey();
  await query(
    `UPDATE public.mikran_api_connection
        SET access_token_enc = $1,
            access_expires_at = $2,
            refresh_token_enc = COALESCE($3, refresh_token_enc),
            scope = $4,
            updated_at = now()
      WHERE id = 1`,
    [encryptToken(key, tokens.accessToken), tokens.expiresAt, tokens.refreshToken ? encryptToken(key, tokens.refreshToken) : null, tokens.scope]
  );
  return tokens.accessToken;
}

/**
 * Ważny access token z zapisanego połączenia (odświeżony, gdy wygasa). `force` — sklep odrzucił token (401) przed czasem.
 * null — nikt jeszcze nie połączył helpdesku.
 */
export async function mikranAccessToken(force = false): Promise<string | null> {
  const row = await loadRow();
  if (!row) return null;
  const fresh = row.access_token_enc && row.access_expires_at && row.access_expires_at.getTime() > Date.now() + EXPIRY_MARGIN_MS;
  if (fresh && !force) return decrypt(row.access_token_enc!);
  refreshing ??= refreshStored(row).finally(() => {
    refreshing = null;
  });
  return refreshing;
}
