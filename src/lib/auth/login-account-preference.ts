import type { LoginDirectoryAccount } from "@/lib/auth/login-directory";

export const LOGIN_LAST_ACCOUNT_STORAGE_KEY = "mikron.login.lastAccountId";
export const LOGIN_RECENT_ACCOUNTS_STORAGE_KEY = "mikron.login.recentAccountIds";
export const LOGIN_RECENT_ACCOUNT_LABELS_STORAGE_KEY = "mikron.login.recentAccountLabels";
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
    // codeql[js/clear-text-storage-of-sensitive-data]: Login UX only — account ids and e-mails, never passwords.
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    /* prywatny tryb / zablokowany storage */
  }
}

function readLoginRecentAccountLabelsMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOGIN_RECENT_ACCOUNT_LABELS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) {
        result[key.trim()] = value.trim();
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeLoginRecentAccountLabelsMap(labels: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    // codeql[js/clear-text-storage-of-sensitive-data]: Display names for quick login, not credentials.
    window.localStorage.setItem(LOGIN_RECENT_ACCOUNT_LABELS_STORAGE_KEY, JSON.stringify(labels));
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
    // codeql[js/clear-text-storage-of-sensitive-data]: Account UUID for quick login picker, not a password.
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

export function readLoginAccountDisplayName(accountId: string): string | null {
  const trimmed = accountId.trim();
  if (!trimmed) return null;
  return readLoginRecentAccountLabelsMap()[trimmed] ?? null;
}

/** Etykieta ostatniego konta — do powitania zanim API zwróci katalog. */
export function readLoginLastAccountDisplayName(
  accountId: string | null = readLoginLastAccountId()
): string | null {
  if (!accountId) return null;
  return readLoginAccountDisplayName(accountId);
}

export function canShowCachedQuickLogin(): boolean {
  const accountId = readLoginLastAccountId();
  return Boolean(accountId && readLoginAccountDisplayName(accountId));
}

export function rememberLoginAccountId(accountId: string, displayName?: string): void {
  const trimmed = accountId.trim();
  if (!trimmed) return;

  writeLoginLastAccountIdOnly(trimmed);

  const next = [trimmed, ...readLoginRecentAccountIds().filter((id) => id !== trimmed)].slice(
    0,
    MAX_RECENT_LOGIN_ACCOUNTS
  );
  writeStorageStringArray(LOGIN_RECENT_ACCOUNTS_STORAGE_KEY, next);

  const normalizedLabel = displayName?.trim();
  if (normalizedLabel) {
    const labels = readLoginRecentAccountLabelsMap();
    const pruned: Record<string, string> = {};
    for (const id of next) {
      const label = id === trimmed ? normalizedLabel : labels[id];
      if (label) pruned[id] = label;
    }
    writeLoginRecentAccountLabelsMap(pruned);
  }
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

/** Ostatnie konto — z katalogu albo z cache etykiet (przed fetch API). */
export function resolveQuickLoginAccountId(
  accounts: Pick<LoginDirectoryAccount, "id">[],
  storedId: string | null = readLoginLastAccountId()
): string | null {
  const fromDirectory = resolveLoginLastAccountId(accounts, storedId);
  if (fromDirectory) return fromDirectory;
  if (!storedId) return null;
  return readLoginAccountDisplayName(storedId) ? storedId : null;
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
