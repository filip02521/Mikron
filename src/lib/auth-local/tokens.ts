import { randomBytes } from "crypto";
import { query } from "@/lib/db/pool";
import { hashToken } from "./session";

export type AuthTokenType = "invite" | "recovery" | "signup";

export interface CreatedAuthToken {
  rawToken: string;
  expiresAt: Date;
}

const DEFAULT_TTL_HOURS = 24;

export async function createAuthToken(params: {
  userId: string;
  type: AuthTokenType;
  ttlHours?: number;
}): Promise<CreatedAuthToken> {
  const ttlHours =
    params.ttlHours && params.ttlHours > 0 ? params.ttlHours : DEFAULT_TTL_HOURS;
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await query(
    `INSERT INTO auth_tokens (user_id, token_hash, type, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [params.userId, hashToken(rawToken), params.type, expiresAt.toISOString()]
  );

  return { rawToken, expiresAt };
}

/** Zwraca `userId` i jednocześnie oznacza token jako zużyty — atomowo, więc nie da się użyć go dwa razy. */
export async function consumeAuthToken(
  rawToken: string,
  type: AuthTokenType
): Promise<string | null> {
  if (!rawToken) return null;

  const { rows } = await query<{ user_id: string }>(
    `UPDATE auth_tokens
        SET consumed_at = now()
      WHERE token_hash = $1
        AND type = $2
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING user_id`,
    [hashToken(rawToken), type]
  );

  return rows[0]?.user_id ?? null;
}

export async function revokeAuthTokens(
  userId: string,
  type: AuthTokenType
): Promise<void> {
  await query(
    `UPDATE auth_tokens
        SET consumed_at = now()
      WHERE user_id = $1 AND type = $2 AND consumed_at IS NULL`,
    [userId, type]
  );
}
