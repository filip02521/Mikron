export const GMAIL_OAUTH_COOKIE = "ontime_gmail_oauth";

/** Powrót tylko na ścieżkę w OnTime — nigdy na obcą domenę (`//evil`, `https://…`). */
export function safeReturnPath(raw: string | null | undefined): string {
  const v = String(raw ?? "").trim();
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : "/";
}

export function gmailOAuthCookieValue(state: string, userId: string, returnTo: string): string {
  return `${state}|${userId}|${returnTo}`;
}

/**
 * Ciasteczko `state|userId|returnTo` → zgodne z `state` z Google i z osobą, która zaczęła łączenie?
 * (Wylogowanie i logowanie innej osoby w tej przeglądarce w ciągu 10 min nie podłączy jej konta cudzym startem.)
 */
export function readGmailOAuthCookie(
  cookie: string | undefined,
  state: string | null,
  userId: string
): { ok: true; returnTo: string } | { ok: false } {
  if (!cookie || !state) return { ok: false };
  const [cookieState, cookieUser, ...rest] = cookie.split("|");
  if (!cookieState || cookieState !== state || cookieUser !== userId) return { ok: false };
  return { ok: true, returnTo: safeReturnPath(rest.join("|")) };
}
