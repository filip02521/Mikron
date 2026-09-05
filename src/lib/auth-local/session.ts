import { createHash, randomBytes } from "crypto";
import { hasDatabaseConfig, query } from "@/lib/db/pool";
import { sessionTtlMs } from "./cookies";

export interface SessionRecord {
  userId: string;
  sessionId: string;
  expiresAt: Date;
}

export interface CreatedSession {
  rawToken: string;
  expiresAt: Date;
  sessionId: string;
}

export interface SessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

const MIN_SECRET_LENGTH = 32;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `Brak SESSION_SECRET o długości min. ${MIN_SECRET_LENGTH} znaków w produkcji.`
    );
  }
  throw new Error(
    `Brak SESSION_SECRET (min. ${MIN_SECRET_LENGTH} znaków) — ustaw w .env.local (patrz .env.example).`
  );
}

/**
 * Token sesji jest losowy (128 bitów), więc pojedyncze SHA-256 z sekretem serwera
 * wystarcza — to nie jest hasło podatne na atak słownikowy.
 */
export function hashToken(rawToken: string): string {
  // codeql[js/insufficient-password-hash]: 256-bitowy losowy token sesji z pieprzem serwera, nie hasło.
  return createHash("sha256").update(`${sessionSecret()}${rawToken}`).digest("hex");
}

/** `ip` jest kolumną `inet` — cokolwiek innego niż adres wywróciłoby INSERT. */
function normalizeIp(ip: string | null | undefined): string | null {
  const value = ip?.trim();
  if (!value) return null;
  const withoutPort = /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)
    ? value.split(":")[0]
    : value;
  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(withoutPort);
  const isIpv6 = /^[0-9a-fA-F:]+$/.test(withoutPort) && withoutPort.includes(":");
  return isIpv4 || isIpv6 ? withoutPort : null;
}

export async function createSession(
  userId: string,
  context: SessionContext = {}
): Promise<CreatedSession> {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlMs());

  const { rows } = await query<{ id: string }>(
    `INSERT INTO app_sessions (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5::inet)
     RETURNING id`,
    [
      userId,
      hashToken(rawToken),
      expiresAt.toISOString(),
      context.userAgent?.slice(0, 512) ?? null,
      normalizeIp(context.ip),
    ]
  );

  return { rawToken, expiresAt, sessionId: rows[0].id };
}

export async function validateSession(rawToken: string): Promise<SessionRecord | null> {
  if (!rawToken || !hasDatabaseConfig()) return null;

  const { rows } = await query<{
    id: string;
    user_id: string;
    expires_at: Date | string;
  }>(
    `SELECT id, user_id, expires_at
       FROM app_sessions
      WHERE token_hash = $1
      LIMIT 1`,
    [hashToken(rawToken)]
  );

  const row = rows[0];
  if (!row) return null;

  const expiresAt = new Date(row.expires_at);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await query(`DELETE FROM app_sessions WHERE id = $1`, [row.id]);
    return null;
  }

  return { userId: row.user_id, sessionId: row.id, expiresAt };
}

export async function destroySession(rawToken: string): Promise<void> {
  if (!rawToken || !hasDatabaseConfig()) return;
  await query(`DELETE FROM app_sessions WHERE token_hash = $1`, [hashToken(rawToken)]);
}

export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  if (!userId || !hasDatabaseConfig()) return;
  await query(`DELETE FROM app_sessions WHERE user_id = $1`, [userId]);
}

/** Sprzątanie wygasłych sesji — wywoływane z crona. */
export async function purgeExpiredSessions(): Promise<number> {
  if (!hasDatabaseConfig()) return 0;
  const { rowCount } = await query(`DELETE FROM app_sessions WHERE expires_at <= now()`);
  return rowCount ?? 0;
}
