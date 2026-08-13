/**
 * Przekierowanie na /login po utracie sesji (wygaśnięcie JWT / SIGNED_OUT).
 * Pełne `location.assign` czyści stary stan klienta — samo `router.push` zostawiało „martwy” UI.
 */

import { buildLoginPageHref } from "@/lib/auth/login-initial-mode";
import { isAuthLayoutPath } from "@/lib/auth/auth-layout-paths";
import { userFacingErrorFromUnknown } from "@/lib/ui/user-facing-error";

const INTENTIONAL_LOGOUT_KEY = "ontime-intentional-logout";

let redirectInFlight = false;

export function markIntentionalLogout(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(INTENTIONAL_LOGOUT_KEY, "1");
  } catch {
    // private mode / quota — i tak przekierujemy bez reason=session gdy się da
  }
}

function consumeIntentionalLogout(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const value = sessionStorage.getItem(INTENTIONAL_LOGOUT_KEY);
    if (!value) return false;
    sessionStorage.removeItem(INTENTIONAL_LOGOUT_KEY);
    return true;
  } catch {
    return false;
  }
}

function isLoginOrAuthPath(pathname: string): boolean {
  if (isAuthLayoutPath(pathname)) return true;
  if (pathname === "/auth/confirm" || pathname.startsWith("/auth/confirm/")) {
    return true;
  }
  return false;
}

/**
 * Natychmiastowe przejście na ekran logowania.
 * `intentional` — zwykłe Wyloguj (bez komunikatu „sesja wygasła”).
 */
export function redirectToLoginForLostSession(options?: {
  intentional?: boolean;
}): void {
  if (typeof window === "undefined") return;
  if (redirectInFlight) return;

  const { pathname, search } = window.location;
  if (isLoginOrAuthPath(pathname)) return;

  redirectInFlight = true;
  const intentional =
    options?.intentional === true || consumeIntentionalLogout();
  const next = `${pathname}${search}`;
  const href = intentional
    ? buildLoginPageHref(null, {})
    : buildLoginPageHref(null, { next, reason: "session" });

  window.location.assign(href);
}

/** Gdy błąd / wynik akcji wygląda na brak sesji → redirect. Zwraca true jeśli przekierowano. */
export function redirectToLoginIfSessionError(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  const kind = userFacingErrorFromUnknown(error).kind;
  if (kind !== "session") return false;
  redirectToLoginForLostSession();
  return true;
}

/** Odpowiedź HTTP 401 z API aplikacji (poll / fetch) → login. */
export function redirectToLoginIfUnauthorizedStatus(status: number): boolean {
  if (status !== 401) return false;
  redirectToLoginForLostSession();
  return true;
}
