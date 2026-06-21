import { OTP_TTL_MS } from "@/lib/auth/password-reset-constants";

export const LOGIN_PASSWORD_RESET_STORAGE_KEY = "mikron.login.passwordReset";
export const LOGIN_PASSWORD_RESET_SESSION_EVENT = "mikron:password-reset-session";

export type StoredPasswordResetSession = {
  accountId: string;
  maskedEmail: string;
  resendAvailableAt: string;
  startedAt: string;
};

export function readStoredPasswordResetSession(): StoredPasswordResetSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LOGIN_PASSWORD_RESET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPasswordResetSession;
    if (!parsed.accountId || !parsed.maskedEmail || !parsed.startedAt) return null;
    const started = Date.parse(parsed.startedAt);
    if (Number.isNaN(started) || Date.now() - started > OTP_TTL_MS) {
      window.sessionStorage.removeItem(LOGIN_PASSWORD_RESET_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredPasswordResetSession(
  session: StoredPasswordResetSession | null
): void {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      window.sessionStorage.removeItem(LOGIN_PASSWORD_RESET_STORAGE_KEY);
    } else {
      // codeql[js/clear-text-storage-of-sensitive-data]: Masked e-mail and account id for OTP step UX only.
      window.sessionStorage.setItem(
        LOGIN_PASSWORD_RESET_STORAGE_KEY,
        JSON.stringify(session)
      );
    }
    window.dispatchEvent(new Event(LOGIN_PASSWORD_RESET_SESSION_EVENT));
  } catch {
    /* prywatny tryb / zablokowany storage */
  }
}
