import type { EmailOtpType } from "@supabase/supabase-js";
import { getAppUrl } from "@/lib/env/app-config";

export const PASSWORD_SETUP_PATH = "/ustaw-haslo";

/** Bezpieczna ścieżka docelowa po weryfikacji linku (tylko ścieżki względne w obrębie aplikacji). */
export function safePasswordSetupNextPath(raw: string | null): string {
  const next = raw?.trim() || PASSWORD_SETUP_PATH;
  if (!next.startsWith("/") || next.startsWith("//")) return PASSWORD_SETUP_PATH;
  return next;
}

/** redirectTo przekazywany do generateLink (fallback gdy użyty action_link z Supabase). */
export function passwordSetupConfirmUrl(): string {
  return `${getAppUrl()}/auth/confirm?next=${encodeURIComponent(PASSWORD_SETUP_PATH)}`;
}

/**
 * Link do skopiowania przez admina.
 * generateLink nie obsługuje PKCE — zamiast action_link używamy token_hash
 * i weryfikujemy po stronie /auth/confirm (verifyOtp).
 */
export function buildPasswordConfirmLink(
  tokenHash: string,
  type: EmailOtpType,
  next: string = PASSWORD_SETUP_PATH
): string {
  const url = new URL("/auth/confirm", getAppUrl());
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("next", safePasswordSetupNextPath(next));
  return url.toString();
}
