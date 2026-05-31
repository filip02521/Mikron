import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isAdmin, isSalesManager } from "@/lib/auth-roles";

/** Karta handlowca powiązana z kontem kierownika (profil lub e-mail). */
export async function isManagersOwnSalesPerson(
  user: Pick<SessionUser, "id" | "role">,
  salesPersonId: string
): Promise<boolean> {
  if (!isSalesManager(user.role) || !salesPersonId) return false;
  if (!hasSupabaseConfig()) return false;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("sales_person_id, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.sales_person_id === salesPersonId) return true;

  const own = await resolveSalesPersonForUser({
    id: user.id,
    role: user.role,
    email: (profile?.email as string | undefined) ?? "",
    salesPersonId: (profile?.sales_person_id as string | null | undefined) ?? null,
  });
  return own?.id === salesPersonId;
}

/** null = pełny dostęp (admin), [] = brak grup, string[] = tylko te grupy */
export async function getManagedGroupIdsForUser(
  user: Pick<SessionUser, "id" | "role">
): Promise<string[] | null> {
  if (isAdmin(user.role)) return null;
  if (!isSalesManager(user.role)) return [];

  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_group_managers")
    .select("group_id")
    .eq("profile_id", user.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.group_id as string);
}

export async function fetchManagerGroupIdsByProfile(): Promise<Map<string, string[]>> {
  if (!hasSupabaseConfig()) return new Map();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_group_managers")
    .select("profile_id, group_id");
  if (error) throw new Error(error.message);

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const pid = row.profile_id as string;
    const gid = row.group_id as string;
    const list = map.get(pid) ?? [];
    list.push(gid);
    map.set(pid, list);
  }
  return map;
}

export async function canAccessSalesPerson(
  user: Pick<SessionUser, "id" | "role">,
  salesPersonId: string
): Promise<boolean> {
  if (isAdmin(user.role)) return true;
  if (!isSalesManager(user.role)) return false;

  if (await isManagersOwnSalesPerson(user, salesPersonId)) return true;

  const scope = await getManagedGroupIdsForUser(user);
  if (scope === null) return true;
  if (!scope.length) return false;

  if (!hasSupabaseConfig()) return false;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("sales_people")
    .select("group_id")
    .eq("id", salesPersonId)
    .maybeSingle();

  if (!data?.group_id) return false;
  return scope.includes(data.group_id as string);
}

export async function assertManagerCanUseGroupId(
  user: Pick<SessionUser, "id" | "role">,
  groupId: string | null | undefined
): Promise<void> {
  if (!groupId) return;
  if (isAdmin(user.role)) return;
  if (!isSalesManager(user.role)) return;

  const scope = await getManagedGroupIdsForUser(user);
  if (scope === null) return;
  if (!scope.includes(groupId)) {
    throw new Error("Nie masz uprawnień do tej grupy zespołu.");
  }
}

export function filterRowsByGroupScope<T extends { groupId: string | null }>(
  rows: T[],
  scope: string[] | null
): T[] {
  if (scope === null) return rows;
  if (!scope.length) return [];
  return rows.filter((r) => r.groupId != null && scope.includes(r.groupId));
}

export function filterGroupsByScope<T extends { id: string }>(
  groups: T[],
  scope: string[] | null
): T[] {
  if (scope === null) return groups;
  if (!scope.length) return [];
  return groups.filter((g) => scope.includes(g.id));
}
