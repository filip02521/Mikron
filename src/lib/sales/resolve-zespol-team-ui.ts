import type { SessionUser } from "@/lib/auth";
import { isAdminReadOnlyPanelPreview } from "@/lib/auth/admin-panel-context";
import { readAdminPanelContextForSession } from "@/lib/auth/read-admin-panel-context";
import { filterGroupsByScope, getManagedGroupIdsForUser } from "@/lib/data/sales-group-access";
import { fetchSalesGroups } from "@/lib/data/sales-groups";
import {
  applyAdminPanelReadOnlyTeamUi,
  resolveSalesTeamUiContext,
  type SalesTeamUiContext,
} from "@/lib/sales/team-ui";
import type { SalesGroupRow } from "@/lib/data/sales-groups";

export async function resolveZespolTeamUiForPage(user: Pick<SessionUser, "id" | "role">): Promise<{
  teamUi: SalesTeamUiContext;
  groups: SalesGroupRow[];
  readOnlyPreview: boolean;
}> {
  const { panelContext } = await readAdminPanelContextForSession();
  const readOnlyPreview = isAdminReadOnlyPanelPreview(user.role, panelContext);
  const scope = await getManagedGroupIdsForUser(user);
  const groups = filterGroupsByScope(await fetchSalesGroups(), scope);
  const teamUi = applyAdminPanelReadOnlyTeamUi(
    await resolveSalesTeamUiContext(
      user,
      groups.map((group) => group.name)
    ),
    readOnlyPreview
  );

  return { teamUi, groups, readOnlyPreview };
}
