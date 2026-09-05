export const COOKIE_NAME = "ontime_session";

const DEFAULT_SESSION_TTL_DAYS = 7;

export interface SessionCookieOptions {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  secure: boolean;
  maxAge: number;
}

export function sessionTtlDays(): number {
  const raw = Number(process.env.SESSION_TTL_DAYS?.trim());
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SESSION_TTL_DAYS;
}

export function sessionTtlMs(): number {
  return sessionTtlDays() * 24 * 60 * 60 * 1000;
}

/** Secure tylko na produkcyjnym HTTPS — instalacje LAN chodzą po HTTP. */
function secureCookieEnabled(): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  return process.env.NODE_ENV === "production" && appUrl.startsWith("https://");
}

export function sessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookieEnabled(),
    maxAge: Math.floor(sessionTtlMs() / 1000),
  };
}

export function clearSessionCookieOptions(): SessionCookieOptions {
  return { ...sessionCookieOptions(), maxAge: 0 };
}
