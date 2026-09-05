/** Typy i helpery katalogu logowania — bezpieczne dla klienta (bez klienta admin Supabase). */

import { resolveLoginDisplayName } from "@/lib/users/display-name";
import type { UserRole } from "@/types/database";
type AuthUserLike = {
  email?: string | null;
  is_anonymous?: boolean | null;
  banned_until?: string | null;
  email_confirmed_at?: string | null;
};

export type LoginDirectoryAccount = {
  id: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  displayName: string;
  salesPersonName: string | null;
  assignmentLabel: string | null;
};

/** Konto widoczne na ekranie logowania — bez adresu e-mail w kliencie. */
export type LoginDirectoryAccountPublic = Omit<LoginDirectoryAccount, "email">;

export const LOGIN_DIRECTORY_MIN_QUERY_LENGTH = 3;
export const LOGIN_DIRECTORY_MAX_RESULTS = 20;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLoginDirectoryQueryValid(query: string): boolean {
  return query.trim().length >= LOGIN_DIRECTORY_MIN_QUERY_LENGTH;
}

export function isLoginDirectoryAccountId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

const ROLE_SORT_ORDER: UserRole[] = [
  "admin",
  "zakupy",
  "magazyn",
  "sales_manager",
  "sales",
];

function roleSortIndex(role: UserRole): number {
  const index = ROLE_SORT_ORDER.indexOf(role);
  return index >= 0 ? index : ROLE_SORT_ORDER.length;
}

export function loginDirectoryDisplayName(input: {
  email: string;
  salesPersonName?: string | null;
}): string {
  return resolveLoginDisplayName(input);
}

export function sortLoginDirectoryAccounts(
  accounts: LoginDirectoryAccount[]
): LoginDirectoryAccount[] {
  return [...accounts].sort((a, b) => {
    const roleDiff = roleSortIndex(a.role) - roleSortIndex(b.role);
    if (roleDiff !== 0) return roleDiff;
    return a.displayName.localeCompare(b.displayName, "pl", { sensitivity: "base" });
  });
}

export function loginDirectoryAccountMatchesQuery(
  account: Pick<LoginDirectoryAccount, "displayName" | "salesPersonName">,
  normalizedQuery: string
): boolean {
  const haystack = [account.displayName, account.salesPersonName ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalizedQuery);
}

export function filterLoginDirectoryAccounts(
  accounts: LoginDirectoryAccountPublic[],
  query: string
): LoginDirectoryAccountPublic[] {
  const q = query.trim().toLowerCase();
  if (!q) return accounts;

  return accounts.filter((account) => loginDirectoryAccountMatchesQuery(account, q));
}

/** Czy konto Auth może pojawić się na liście logowania. */
export function isAuthUserLoginEligible(
  user: AuthUserLike
): boolean {
  if (user.is_anonymous) return false;
  if (!user.email?.trim()) return false;
  if (!user.email_confirmed_at) return false;

  if (user.banned_until) {
    const bannedUntil = Date.parse(user.banned_until);
    if (!Number.isNaN(bannedUntil) && bannedUntil > Date.now()) return false;
  }

  return true;
}
