import type { LoginDirectoryAccount } from "@/lib/auth/login-directory";

export const LOGIN_LAST_ACCOUNT_STORAGE_KEY = "mikron.login.lastAccountId";

export function readLoginLastAccountId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LOGIN_LAST_ACCOUNT_STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function writeLoginLastAccountId(accountId: string): void {
  if (typeof window === "undefined") return;
  const trimmed = accountId.trim();
  if (!trimmed) return;
  try {
    window.localStorage.setItem(LOGIN_LAST_ACCOUNT_STORAGE_KEY, trimmed);
  } catch {
    /* prywatny tryb / zablokowany storage */
  }
}

export function resolveLoginLastAccountId(
  accounts: Pick<LoginDirectoryAccount, "id">[],
  storedId: string | null = readLoginLastAccountId()
): string | null {
  if (!storedId) return null;
  return accounts.some((account) => account.id === storedId) ? storedId : null;
}
