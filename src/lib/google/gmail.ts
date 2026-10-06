/**
 * Gmail użytkownika (OAuth, aplikacja „Internal” w Google Workspace Mikranu) — tylko wysyłka.
 * Zakres `gmail.send`: OnTime nie czyta poczty. Wiadomość ląduje w „Wysłanych” nadawcy.
 *
 * Env: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_TOKEN_KEY
 * (32 bajty base64 — klucz AES do refresh tokenów w bazie: `openssl rand -base64 32`).
 * Przekierowanie: `${NEXT_PUBLIC_APP_URL}/api/google/callback` (musi być HTTPS).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { getAppUrl } from "@/lib/env/app-config";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const SCOPES = ["openid", "email", GMAIL_SEND_SCOPE];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const TIMEOUT_MS = 20_000;

export type GmailOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenKey: Buffer;
};

/** null = funkcja wyłączona (brak konfiguracji) — UI nie pokazuje „Połącz z Gmailem”. */
export function getGmailOAuthConfig(env: NodeJS.ProcessEnv = process.env): GmailOAuthConfig | null {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const keyRaw = env.GOOGLE_OAUTH_TOKEN_KEY?.trim();
  if (!clientId || !clientSecret || !keyRaw) return null;
  const tokenKey = Buffer.from(keyRaw, "base64");
  if (tokenKey.length !== 32) return null;
  return { clientId, clientSecret, redirectUri: `${getAppUrl()}/api/google/callback`, tokenKey };
}

export class GmailReconnectRequiredError extends Error {
  constructor() {
    super("Połączenie z Gmailem wygasło lub zostało cofnięte — połącz konto ponownie.");
    this.name = "GmailReconnectRequiredError";
  }
}

// ─── Szyfrowanie refresh tokenu ───────────────────────────────────────────

export function encryptToken(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptToken(key: Buffer, enc: string): string {
  const [v, iv, tag, ct] = enc.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Nieznany format zaszyfrowanego tokenu.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

// ─── OAuth ────────────────────────────────────────────────────────────────

export function buildGmailAuthUrl(cfg: GmailOAuthConfig, state: string, loginHint?: string): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    // offline + consent: Google zawsze oddaje refresh token (także przy ponownym łączeniu).
    access_type: "offline",
    prompt: "consent",
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  }).toString();
  return url.toString();
}

/**
 * E-mail z id_token. Token przychodzi bezpośrednio z endpointu Google po TLS,
 * więc wg OpenID Connect (3.1.3.7) wystarczy odczyt bez weryfikacji podpisu.
 */
export function emailFromIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
      email_verified?: unknown;
    };
    if (typeof claims.email !== "string" || claims.email_verified === false) return null;
    return claims.email.trim().toLowerCase();
  } catch {
    return null;
  }
}

async function postForm(url: string, body: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export async function exchangeGmailCode(
  cfg: GmailOAuthConfig,
  code: string
): Promise<{ refreshToken: string; email: string; scope: string }> {
  const res = await postForm(TOKEN_URL, {
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  });
  const json = (await res.json().catch(() => ({}))) as {
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(`Google odrzucił logowanie (${json.error ?? res.status}).`);
  const email = emailFromIdToken(json.id_token);
  const scope = json.scope ?? "";
  if (!json.refresh_token || !email) throw new Error("Google nie zwrócił danych konta — spróbuj ponownie.");
  if (!scope.split(" ").includes(GMAIL_SEND_SCOPE)) {
    throw new Error("Bez zgody na wysyłanie e-maili OnTime nie może wysyłać z Gmaila. Połącz ponownie i zaznacz zgodę.");
  }
  return { refreshToken: json.refresh_token, email, scope };
}

export async function gmailAccessToken(cfg: GmailOAuthConfig, refreshToken: string): Promise<string> {
  const res = await postForm(TOKEN_URL, {
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (json.error === "invalid_grant") throw new GmailReconnectRequiredError();
  if (!res.ok || !json.access_token) throw new Error(`Google nie wydał tokenu (${json.error ?? res.status}).`);
  return json.access_token;
}

/** Cofnięcie zgody w Google — błąd nie blokuje odłączenia w OnTime. */
export async function revokeGmailToken(token: string): Promise<void> {
  await postForm(REVOKE_URL, { token }).catch(() => undefined);
}

// ─── Wiadomość ────────────────────────────────────────────────────────────

export type GmailAttachment = { filename: string; content: Buffer; contentType?: string };

export type GmailMessageInput = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  attachments?: GmailAttachment[];
};

/** MIME (RFC 5322) przez nodemailer — ten sam składacz co przy SMTP, bez wysyłki. */
export async function buildMimeMessage(input: GmailMessageInput): Promise<Buffer> {
  const info = await nodemailer
    .createTransport({ streamTransport: true, buffer: true, newline: "unix" })
    .sendMail({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });
  return info.message as Buffer;
}

export async function sendGmailRaw(
  accessToken: string,
  mime: Buffer
): Promise<{ id: string; threadId: string | null }> {
  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: mime.toString("base64url") }),
    signal: AbortSignal.timeout(TIMEOUT_MS * 3),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    threadId?: string;
    error?: { message?: string; status?: string };
  };
  if (res.status === 401) throw new GmailReconnectRequiredError();
  if (!res.ok || !json.id) {
    throw new Error(`Gmail nie wysłał wiadomości: ${json.error?.message ?? res.status}`);
  }
  return { id: json.id, threadId: json.threadId ?? null };
}
