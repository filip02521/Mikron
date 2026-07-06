import { isMagazyn, isSales, isSalesManager, isZakupy } from "@/lib/auth-roles";
import { fetchManagerGroupIdsByProfile } from "@/lib/data/sales-group-access";
import { fetchSalesGroups } from "@/lib/data/sales-groups";
import { OPERATIONS_DEPARTMENT_LABELS } from "@/lib/operations/notepad-department";
import type { UserRole, Workspace } from "@/types/database";

type SalesPeopleJoin = {
  sales_groups?: { name?: string | null } | { name?: string | null }[] | null;
} | null;

export type LoginDirectoryProfileForLabel = {
  id: string;
  role: UserRole;
  sales_people?: SalesPeopleJoin | SalesPeopleJoin[];
  assigned_workspaces?: Workspace[] | null;
};

function salesPersonGroupName(profile: LoginDirectoryProfileForLabel): string | null {
  const salesPerson = Array.isArray(profile.sales_people)
    ? profile.sales_people[0]
    : profile.sales_people;
  const group = salesPerson?.sales_groups;
  const groupRow = Array.isArray(group) ? group[0] : group;
  const name = groupRow?.name?.trim();
  return name || null;
}

export function resolveLoginDirectoryAssignmentLabel(
  profile: LoginDirectoryProfileForLabel,
  managerGroupIdsByProfile: Map<string, string[]>,
  groupNameById: Map<string, string>
): string | null {
  const role = profile.role;

  if (isSalesManager(role)) {
    const managedIds = managerGroupIdsByProfile.get(profile.id) ?? [];
    if (managedIds.length > 0) {
      const names = managedIds
        .map((groupId) => groupNameById.get(groupId)?.trim())
        .filter((name): name is string => Boolean(name));
      if (names.length > 0) return names.join(", ");
    }
  }

  if (isSales(role) || isSalesManager(role)) {
    return salesPersonGroupName(profile);
  }

  if (isZakupy(role)) {
    const workspaces = (profile.assigned_workspaces ?? []) as Workspace[];
    if (workspaces.length > 0) {
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

export async function buildLoginDirectoryAssignmentLabelMap(
  profiles: LoginDirectoryProfileForLabel[]
): Promise<Map<string, string | null>> {
  const needsManagerGroups = profiles.some((profile) => isSalesManager(profile.role));
  const managerGroupIdsByProfile = needsManagerGroups
    ? await fetchManagerGroupIdsByProfile()
    : new Map<string, string[]>();
  const groupNameById = needsManagerGroups
    ? new Map(
        (await fetchSalesGroups({ countMode: "team" })).map((group) => [
          group.id,
          group.name.trim(),
        ])
      )
    : new Map<string, string>();

  return new Map(
    profiles.map((profile) => [
      profile.id,
      resolveLoginDirectoryAssignmentLabel(profile, managerGroupIdsByProfile, groupNameById),
    ])
  );
}
