import type { LoginDirectoryAccount } from "@/lib/auth/login-directory";

export const LOGIN_LAST_ACCOUNT_STORAGE_KEY = "mikron.login.lastAccountId";
export const LOGIN_RECENT_ACCOUNTS_STORAGE_KEY = "mikron.login.recentAccountIds";
export const LOGIN_RECENT_EMAILS_STORAGE_KEY = "mikron.login.recentEmails";

export const MAX_RECENT_LOGIN_ACCOUNTS = 8;
export const MAX_RECENT_LOGIN_EMAILS = 8;

function readStorageStringArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeStorageStringArray(key: string, values: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    /* prywatny tryb / zablokowany storage */
  }
}

export function readLoginLastAccountId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LOGIN_LAST_ACCOUNT_STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

function writeLoginLastAccountIdOnly(accountId: string): void {
  if (typeof window === "undefined") return;
  const trimmed = accountId.trim();
  if (!trimmed) return;
  try {
    window.localStorage.setItem(LOGIN_LAST_ACCOUNT_STORAGE_KEY, trimmed);
  } catch {
    /* prywatny tryb / zablokowany storage */
  }
}

export function readLoginRecentAccountIds(): string[] {
  const recent = readStorageStringArray(LOGIN_RECENT_ACCOUNTS_STORAGE_KEY);
  if (recent.length > 0) return recent.slice(0, MAX_RECENT_LOGIN_ACCOUNTS);

  const last = readLoginLastAccountId();
  return last ? [last] : [];
}

export function rememberLoginAccountId(accountId: string): void {
  const trimmed = accountId.trim();
  if (!trimmed) return;

  writeLoginLastAccountIdOnly(trimmed);

  const next = [trimmed, ...readLoginRecentAccountIds().filter((id) => id !== trimmed)].slice(
    0,
    MAX_RECENT_LOGIN_ACCOUNTS
  );
  writeStorageStringArray(LOGIN_RECENT_ACCOUNTS_STORAGE_KEY, next);
}

/** @deprecated Preferuj rememberLoginAccountId — zachowane dla istniejących wywołań. */
export function writeLoginLastAccountId(accountId: string): void {
  rememberLoginAccountId(accountId);
}

export function readLoginRecentEmails(): string[] {
  return readStorageStringArray(LOGIN_RECENT_EMAILS_STORAGE_KEY).slice(
    0,
    MAX_RECENT_LOGIN_EMAILS
  );
}

export function rememberLoginEmail(email: string): void {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return;

  const next = [
    normalized,
    ...readLoginRecentEmails().filter((value) => value !== normalized),
  ].slice(0, MAX_RECENT_LOGIN_EMAILS);
  writeStorageStringArray(LOGIN_RECENT_EMAILS_STORAGE_KEY, next);
}

export function resolveLoginLastAccountId(
  accounts: Pick<LoginDirectoryAccount, "id">[],
  storedId: string | null = readLoginLastAccountId()
): string | null {
  if (!storedId) return null;
  return accounts.some((account) => account.id === storedId) ? storedId : null;
}

export function resolveLoginRecentAccountIds(
  accounts: Pick<LoginDirectoryAccount, "id">[],
  storedIds: string[] = readLoginRecentAccountIds()
): string[] {
  const validIds = new Set(accounts.map((account) => account.id));
  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const id of storedIds) {
    if (!validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    resolved.push(id);
  }

  return resolved;
}
