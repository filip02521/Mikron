import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { isE2ELab, E2E_LOGIN_DIRECTORY_FIXTURE } from "@/lib/e2e-lab/mode";
import type { LoginDirectoryAccountPublic } from "@/lib/auth/login-directory-public";
import { resolveLoginDisplayName } from "@/lib/users/display-name";
import { ROLE_LABELS } from "@/lib/users/labels";
import type { UserRole } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export type LoginDirectoryAccount = {
  id: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  displayName: string;
  salesPersonName: string | null;
};

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

export function filterLoginDirectoryAccounts(
  accounts: LoginDirectoryAccountPublic[],
  query: string
): LoginDirectoryAccountPublic[] {
  const q = query.trim().toLowerCase();
  if (!q) return accounts;

  return accounts.filter((account) => {
    const haystack = [account.displayName, account.salesPersonName ?? ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Czy konto Auth może pojawić się na liście logowania. */
export function isAuthUserLoginEligible(user: Pick<User, "email" | "is_anonymous" | "banned_until" | "email_confirmed_at">): boolean {
  if (user.is_anonymous) return false;
  if (!user.email?.trim()) return false;
  if (!user.email_confirmed_at) return false;

  if (user.banned_until) {
    const bannedUntil = Date.parse(user.banned_until);
    if (!Number.isNaN(bannedUntil) && bannedUntil > Date.now()) return false;
  }

  return true;
}

async function fetchLoginEligibleUserIds(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Set<string>> {
  const eligible = new Set<string>();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);

    for (const user of data.users) {
      if (isAuthUserLoginEligible(user)) {
        eligible.add(user.id);
      }
    }

    if (data.users.length < 1000) break;
    page += 1;
  }

  return eligible;
}

/** Katalog kont do ekranu logowania (tylko sieć firmowa — service role). */
export async function fetchLoginDirectoryAccounts(): Promise<LoginDirectoryAccount[]> {
  if (isE2ELab()) {
    return sortLoginDirectoryAccounts(E2E_LOGIN_DIRECTORY_FIXTURE);
  }

  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  let eligibleUserIds: Set<string>;

  try {
    eligibleUserIds = await fetchLoginEligibleUserIds(supabase);
  } catch (error) {
    console.error(
      "[login-directory] Nie można wczytać kont Auth:",
      error instanceof Error ? error.message : error
    );
    return [];
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, role, sales_people(name)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[login-directory] Nie można wczytać kont:", error.message);
    return [];
  }

  const accounts = (profiles ?? [])
    .map((profile) => {
      if (!eligibleUserIds.has(profile.id)) return null;

      const email = profile.email?.trim().toLowerCase() ?? "";
      if (!email) return null;

      const salesPerson = Array.isArray(profile.sales_people)
        ? profile.sales_people[0]
        : profile.sales_people;
      const salesPersonName = salesPerson?.name?.trim() || null;
      const role = profile.role as UserRole;

      return {
        id: profile.id,
        email,
        role,
        roleLabel: ROLE_LABELS[role] ?? role,
        salesPersonName,
        displayName: loginDirectoryDisplayName({ email, salesPersonName }),
      } satisfies LoginDirectoryAccount;
    })
    .filter((row): row is LoginDirectoryAccount => row != null);

  return sortLoginDirectoryAccounts(accounts);
}
