import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { isE2ELab, E2E_LOGIN_DIRECTORY_FIXTURE } from "@/lib/e2e-lab/mode";
import { buildLoginDirectoryAssignmentLabelMap } from "@/lib/auth/login-directory-assignment-label";
import { ROLE_LABELS } from "@/lib/users/labels";
import type { UserRole, Workspace } from "@/types/database";
import {
  filterLoginDirectoryAccounts,
  isAuthUserLoginEligible,
  isLoginDirectoryAccountId,
  isLoginDirectoryQueryValid,
  loginDirectoryAccountMatchesQuery,
  loginDirectoryDisplayName,
  LOGIN_DIRECTORY_MAX_RESULTS,
  LOGIN_DIRECTORY_MIN_QUERY_LENGTH,
  sortLoginDirectoryAccounts,
  type LoginDirectoryAccount,
} from "@/lib/auth/login-directory-shared";

export type { LoginDirectoryAccount };
export type { LoginDirectoryAccountPublic } from "@/lib/auth/login-directory-shared";
export {
  filterLoginDirectoryAccounts,
  isAuthUserLoginEligible,
  isLoginDirectoryAccountId,
  isLoginDirectoryQueryValid,
  loginDirectoryAccountMatchesQuery,
  loginDirectoryDisplayName,
  LOGIN_DIRECTORY_MAX_RESULTS,
  LOGIN_DIRECTORY_MIN_QUERY_LENGTH,
  sortLoginDirectoryAccounts,
};

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
    .select("id, email, role, assigned_workspaces, sales_people(name, sales_groups(name))")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[login-directory] Nie można wczytać kont:", error.message);
    return [];
  }

  const profileRows = profiles ?? [];
  const assignmentLabels = await buildLoginDirectoryAssignmentLabelMap(
    profileRows.map((profile) => ({
      id: profile.id,
      role: profile.role as UserRole,
      sales_people: profile.sales_people,
      assigned_workspaces: (profile.assigned_workspaces ?? null) as Workspace[] | null,
    }))
  );

  const accounts = profileRows
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
        assignmentLabel: assignmentLabels.get(profile.id) ?? null,
      } satisfies LoginDirectoryAccount;
    })
    .filter((row): row is LoginDirectoryAccount => row != null);

  return sortLoginDirectoryAccounts(accounts);
}

/** Wyszukiwanie kont (min. 3 znaki) — bez pełnej listy w kliencie. */
export async function searchLoginDirectoryAccounts(
  query: string
): Promise<LoginDirectoryAccount[]> {
  if (!isLoginDirectoryQueryValid(query)) return [];

  if (isE2ELab()) {
    const q = query.trim().toLowerCase();
    return sortLoginDirectoryAccounts(
      E2E_LOGIN_DIRECTORY_FIXTURE.filter((account) =>
        loginDirectoryAccountMatchesQuery(account, q)
      )
    ).slice(0, LOGIN_DIRECTORY_MAX_RESULTS);
  }

  const all = await fetchLoginDirectoryAccounts();
  const q = query.trim().toLowerCase();
  return all
    .filter((account) => loginDirectoryAccountMatchesQuery(account, q))
    .slice(0, LOGIN_DIRECTORY_MAX_RESULTS);
}

/** Pojedyncze konto (np. ostatnie logowanie) — rate limit w API. */
export async function fetchLoginDirectoryAccountById(
  accountId: string
): Promise<LoginDirectoryAccount | null> {
  if (!isLoginDirectoryAccountId(accountId)) return null;

  if (isE2ELab()) {
    return E2E_LOGIN_DIRECTORY_FIXTURE.find((account) => account.id === accountId) ?? null;
  }

  const all = await fetchLoginDirectoryAccounts();
  return all.find((account) => account.id === accountId) ?? null;
}

/** Ostatnie konta z przeglądarki (batch) — rate limit w API. */
export async function fetchLoginDirectoryAccountsByIds(
  accountIds: string[]
): Promise<LoginDirectoryAccount[]> {
  const uniqueIds = [...new Set(accountIds.map((id) => id.trim()).filter(isLoginDirectoryAccountId))];
  if (uniqueIds.length === 0) return [];

  if (isE2ELab()) {
    const byId = new Map(E2E_LOGIN_DIRECTORY_FIXTURE.map((account) => [account.id, account]));
    return uniqueIds
      .map((id) => byId.get(id) ?? null)
      .filter((account): account is LoginDirectoryAccount => account != null);
  }

  const all = await fetchLoginDirectoryAccounts();
  const byId = new Map(all.map((account) => [account.id, account]));
  return uniqueIds
    .map((id) => byId.get(id) ?? null)
    .filter((account): account is LoginDirectoryAccount => account != null);
}
