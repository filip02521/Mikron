import type { EmailOtpType } from "@supabase/supabase-js";
import { getAppUrl } from "@/lib/env/app-config";

export const PASSWORD_SETUP_PATH = "/ustaw-haslo";

/** Bezpieczna ścieżka docelowa po weryfikacji linku — tylko /ustaw-haslo (opcjonalnie ?wymagane=1). */
export function safePasswordSetupNextPath(raw: string | null): string {
  const next = raw?.trim() || PASSWORD_SETUP_PATH;
  if (next === PASSWORD_SETUP_PATH) return next;
  if (next === `${PASSWORD_SETUP_PATH}?wymagane=1`) return next;

  if (!next.startsWith("/") || next.startsWith("//")) return PASSWORD_SETUP_PATH;

  try {
    const url = new URL(next, "http://local");
    if (url.pathname !== PASSWORD_SETUP_PATH) return PASSWORD_SETUP_PATH;
    if (url.searchParams.toString() === "wymagane=1") {
      return `${PASSWORD_SETUP_PATH}?wymagane=1`;
    }
  } catch {
    /* fall through */
  }

  return PASSWORD_SETUP_PATH;
}

/** Mapuje verification_type z admin.generateLink na typ verifyOtp. */
export function emailOtpTypeFromVerification(
  verificationType: string
): EmailOtpType {
  switch (verificationType) {
    case "invite":
      return "invite";
    case "recovery":
      return "recovery";
    case "signup":
      return "signup";
    case "magiclink":
      return "magiclink";
    default:
      return "recovery";
  }
}

/** redirectTo przekazywany do generateLink (fallback gdy użyty action_link z Supabase). */
export function passwordSetupConfirmUrl(baseUrl: string = getAppUrl()): string {
  return `${baseUrl}/auth/confirm?next=${encodeURIComponent(PASSWORD_SETUP_PATH)}`;
}

/**
 * Link do skopiowania przez admina.
 * generateLink nie obsługuje PKCE — zamiast action_link używamy token_hash
 * i weryfikujemy po stronie /auth/confirm (verifyOtp).
 */
export function buildPasswordConfirmLink(
  tokenHash: string,
  type: EmailOtpType,
  next: string = PASSWORD_SETUP_PATH,
  baseUrl: string = getAppUrl()
): string {
  const url = new URL("/auth/confirm", baseUrl);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("next", safePasswordSetupNextPath(next));
  return url.toString();
}
