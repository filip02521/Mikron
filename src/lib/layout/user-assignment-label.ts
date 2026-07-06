import type { SessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { getManagedGroupIdsForUser } from "@/lib/data/sales-group-access";
import { fetchSalesGroups } from "@/lib/data/sales-groups";
import {
  isMagazyn,
  isSales,
  isSalesManager,
  isZakupy,
} from "@/lib/auth-roles";
import { OPERATIONS_DEPARTMENT_LABELS } from "@/lib/operations/notepad-department";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { UserRole, Workspace } from "@/types/database";

export async function fetchSalesPersonGroupName(
  salesPersonId: string
): Promise<string | null> {
  if (!salesPersonId || !hasSupabaseConfig()) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_people")
    .select("sales_groups(name)")
    .eq("id", salesPersonId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const group = data?.sales_groups as { name?: string } | null | undefined;
  const name = group?.name?.trim();
  return name || null;
}

async function fetchManagerGroupNames(
  user: Pick<SessionUser, "id" | "role">
): Promise<string | null> {
  const scope = await getManagedGroupIdsForUser(user);
  if (scope !== null && scope.length === 0) return null;

  const groups = await fetchSalesGroups({ countMode: "team" });
  const names = groups
    .filter((group) => scope === null || scope.includes(group.id))
    .map((group) => group.name.trim())
    .filter(Boolean);

  return names.length > 0 ? names.join(", ") : null;
}

function operationsDepartmentLabel(role: UserRole, workspaces?: Workspace[]): string | null {
  if (isZakupy(role)) {
    if (workspaces && workspaces.length > 0) {
      const labels: string[] = [];
      if (workspaces.includes("dostawy") || workspaces.includes("zeby")) labels.push(OPERATIONS_DEPARTMENT_LABELS.zakupy);
      if (workspaces.includes("magazyn")) labels.push(OPERATIONS_DEPARTMENT_LABELS.magazyn);
      return labels.length > 0 ? labels.join(", ") : OPERATIONS_DEPARTMENT_LABELS.zakupy;
    }
    return OPERATIONS_DEPARTMENT_LABELS.zakupy;
  }
  if (isMagazyn(role)) return OPERATIONS_DEPARTMENT_LABELS.magazyn;
  return null;
}

/** Etykieta przypisanego działu (zakupy/magazyn) lub grupy handlowej (Sklep, Biuro…). */
export async function resolveUserAssignmentLabel(input: {
  role: UserRole | null;
  session: SessionUser;
  salesPersonId?: string | null;
}): Promise<string | null> {
  const { role, session, salesPersonId } = input;
  if (!role) return null;

  if (isSalesManager(role)) {
    const managed = await fetchManagerGroupNames(session);
    if (managed) return managed;

    const own = await resolveSalesPersonForUser(session);
    if (own) return fetchSalesPersonGroupName(own.id);
    return null;
  }

  const explicitSalesPersonId = salesPersonId?.trim() || null;
  if (explicitSalesPersonId) {
    const groupName = await fetchSalesPersonGroupName(explicitSalesPersonId);
    if (groupName) return groupName;
  }

  if (role === "admin") return null;

  if (isSales(role)) {
    const resolvedId = (await resolveSalesPersonForUser(session))?.id || null;
    if (!resolvedId) return null;
    return fetchSalesPersonGroupName(resolvedId);
  }

  return operationsDepartmentLabel(role, session.assignedWorkspaces);
}
