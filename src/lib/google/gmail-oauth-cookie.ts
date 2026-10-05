export const GMAIL_OAUTH_COOKIE = "ontime_gmail_oauth";

/** Powrót tylko na ścieżkę w OnTime — nigdy na obcą domenę (`//evil`, `https://…`). */
export function safeReturnPath(raw: string | null | undefined): string {
  const v = String(raw ?? "").trim();
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : "/";
}

/** Ciasteczko `state|returnTo` → zgodne z `state` z Google? */
export function readGmailOAuthCookie(
  cookie: string | undefined,
  state: string | null
): { ok: true; returnTo: string } | { ok: false } {
  if (!cookie || !state) return { ok: false };
  const sep = cookie.indexOf("|");
  if (sep <= 0 || cookie.slice(0, sep) !== state) return { ok: false };
  return { ok: true, returnTo: safeReturnPath(cookie.slice(sep + 1)) };
}
