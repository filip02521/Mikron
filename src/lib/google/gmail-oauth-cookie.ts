export const GMAIL_OAUTH_COOKIE = "ontime_gmail_oauth";
/** Łączenie skrzynki wspólnej (office@) zamiast własnej — ustawiane i kasowane przy każdym starcie łączenia. */
export const GMAIL_OAUTH_SHARED_COOKIE = "ontime_gmail_oauth_shared";

/** Skrzynkę wspólną podłączają tylko admin i zakupy. */
export function canConnectSharedMailbox(role: string): boolean {
  return role === "admin" || role === "zakupy";
}

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
