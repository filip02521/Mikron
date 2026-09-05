import type { SessionUser } from "@/lib/auth";
import { isAdmin, isSalesManager } from "@/lib/auth-roles";
import { getManagedGroupIdsForUser } from "@/lib/data/sales-group-access";
import type { SalesTeamUiContext } from "@/lib/sales/team-ui";

export async function resolveSalesTeamUiContext(
  user: Pick<SessionUser, "id" | "role">,
  groupNames: string[] = []
): Promise<SalesTeamUiContext> {
  const admin = isAdmin(user.role);
  const manager = isSalesManager(user.role);

  if (admin) {
    return {
      isAdmin: true,
      isManager: false,
      canCreateGroups: true,
      hasTeamScope: true,
      groupNamesLabel: groupNames.length ? groupNames.join(", ") : "Sklep, Biuro",
    };
  }

  if (!manager) {
    return {
      isAdmin: false,
      isManager: false,
      canCreateGroups: false,
      hasTeamScope: false,
      groupNamesLabel: "",
    };
  }

  const scope = await getManagedGroupIdsForUser(user);
  const hasTeamScope = scope != null && scope.length > 0;
  const labels =
    groupNames.length > 0 ? groupNames.join(", ") : hasTeamScope ? "Twoje grupy" : "";

  return {
    isAdmin: false,
    isManager: true,
    canCreateGroups: false,
    hasTeamScope,
    groupNamesLabel: labels,
  };
}
