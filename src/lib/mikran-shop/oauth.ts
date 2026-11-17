import { createHash, randomBytes } from "node:crypto";
import { getAppUrl } from "@/lib/env/app-config";
import type { UserRole } from "@/types/database";

/**
 * Logowanie administratora do API mikran.pl (OAuth authorization_code + PKCE S256), jak „MCP Sign-in” sklepu:
 * OnTime przekierowuje na mikran.pl, admin podaje login, hasło i kod z Authenticatora, sklep wraca na
 * /api/mcp/auth_callback z kodem, który wymieniamy na access + refresh token.
 */

/** Klient „ontime” w adminie mikran.pl (Rozszerzenia → Mikran API v1 → Klienci) — client_id nie jest sekretem. */
const DEFAULT_CLIENT_ID = "mk_f652e5ce44a93a3f88d05e32";
export const MIKRAN_OAUTH_SCOPE = "helpdesk:read helpdesk:write";
export const MIKRAN_OAUTH_COOKIE = "ontime_mikran_oauth";
export const MIKRAN_OAUTH_COOKIE_PATH = "/api/mcp";
const DEFAULT_BASE = "https://mikran.pl";
const TIMEOUT_MS = 10_000;

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function mikranApiBase(): string {
  return env("MIKRAN_API_BASE_URL") || DEFAULT_BASE;
}

export function mikranClientId(): string {
  return env("MIKRAN_API_CLIENT_ID") || DEFAULT_CLIENT_ID;
}

/** Adres powrotu zarejestrowany przy kliencie w adminie mikran.pl (inny adres sklep odrzuca: „Invalid redirect_uri”). */
export function mikranRedirectUri(): string {
  return env("MIKRAN_API_REDIRECT_URI") || `${getAppUrl()}/api/mcp/auth_callback`;
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: pkceChallenge(verifier) };
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function mikranAuthorizeUrl(input: { state: string; challenge: string }): string {
  const url = new URL(`${mikranApiBase()}/api/v1/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", mikranClientId());
  url.searchParams.set("redirect_uri", mikranRedirectUri());
  url.searchParams.set("scope", MIKRAN_OAUTH_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("_locale", "pl");
  return url.toString();
}

/** Połączenie zakłada serwisant (swoim kontem mikran.pl, z panelu serwisu) albo administrator (z Administracji). */
export function canConnectMikran(role: UserRole): boolean {
  return role === "serwis" || role === "admin";
}

/** Dokąd wrócić po logowaniu na mikran.pl — tam, skąd się łączy. */
export function mikranReturnPath(role: UserRole): string {
  return role === "serwis" ? "/serwis/zlecenia" : "/admin#helpdesk-mikran";
}

/** Ciasteczko startu: `state|userId|verifier` — weryfikator PKCE nie opuszcza serwera OnTime ani przeglądarki admina. */
export function mikranOAuthCookieValue(state: string, userId: string, verifier: string): string {
  return `${state}|${userId}|${verifier}`;
}

/** Ciasteczko zgodne ze `state` ze sklepu i z osobą, która zaczęła łączenie → weryfikator PKCE. */
export function readMikranOAuthCookie(
  cookie: string | undefined,
  state: string | null,
  userId: string
): { ok: true; verifier: string } | { ok: false } {
  if (!cookie || !state) return { ok: false };
  const [cookieState, cookieUser, verifier] = cookie.split("|");
  if (!cookieState || cookieState !== state || cookieUser !== userId || !verifier) return { ok: false };
  return { ok: true, verifier };
}

export type MikranTokens = {
  accessToken: string;
  /** Sklep może przy odświeżeniu nie zwrócić nowego — wtedy zostaje poprzedni. */
  refreshToken: string | null;
  expiresAt: Date;
  scope: string;
};

/** Odpowiedź /oauth/token → tokeny; brak access_token = błąd z opisem dla admina. */
export function parseTokenResponse(status: number, json: unknown, now = Date.now()): MikranTokens {
  const j = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const access = typeof j.access_token === "string" ? j.access_token : "";
  if (status < 200 || status >= 300 || !access) {
    const code = typeof j.error === "string" ? ` ${j.error}` : "";
    throw new MikranAuthError(`Sklep mikran.pl odrzucił logowanie do API (${status}${code}). Połącz helpdesk ponownie.`);
  }
  const expiresIn = typeof j.expires_in === "number" && j.expires_in > 0 ? j.expires_in : 3600;
  return {
    accessToken: access,
    refreshToken: typeof j.refresh_token === "string" && j.refresh_token ? j.refresh_token : null,
    expiresAt: new Date(now + expiresIn * 1000),
    scope: typeof j.scope === "string" ? j.scope : MIKRAN_OAUTH_SCOPE,
  };
}

export class MikranAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MikranAuthError";
  }
}

async function tokenRequest(params: Record<string, string>): Promise<MikranTokens> {
  const body = new URLSearchParams({ client_id: mikranClientId(), ...params });
  const secret = env("MIKRAN_API_CLIENT_SECRET");
  if (secret) body.set("client_secret", secret);
  const res = await fetch(`${mikranApiBase()}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  return parseTokenResponse(res.status, await res.json().catch(() => null));
}

export function exchangeMikranCode(code: string, verifier: string): Promise<MikranTokens> {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: mikranRedirectUri(), code_verifier: verifier });
}

export function refreshMikranTokens(refreshToken: string): Promise<MikranTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}
