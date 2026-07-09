import { cache } from "react";
import type { SessionUser } from "@/lib/auth";
import { isAdminReadOnlyPanelPreview } from "@/lib/auth/admin-panel-context";
import { readAdminPanelContextForSession } from "@/lib/auth/read-admin-panel-context";
import { isAdmin } from "@/lib/auth-roles";
import { filterGroupsByScope, getManagedGroupIdsForUser } from "@/lib/data/sales-group-access";
import { fetchSalesGroups } from "@/lib/data/sales-groups";
import type { SalesGroupRow } from "@/lib/data/sales-groups";
import {
  applyAdminPanelReadOnlyTeamUi,
  resolveSalesTeamUiContext,
  type SalesTeamUiContext,
} from "@/lib/sales/team-ui";
import { zespolLoadErrorMessage } from "@/lib/sales/zespol-load-errors";

export type ZespolPageContext = {
  teamUi: SalesTeamUiContext;
  groups: SalesGroupRow[];
  readOnlyPreview: boolean;
  groupsLoadError: string | null;
};

/** Jedno resolve na request (layout + strony /zespol/*). */
export const getZespolPageContext = cache(
  async (user: Pick<SessionUser, "id" | "role">): Promise<ZespolPageContext> => {
    const { panelContext } = await readAdminPanelContextForSession();
    const readOnlyPreview = isAdminReadOnlyPanelPreview(user.role, panelContext);
    const scope = await getManagedGroupIdsForUser(user);

    let groups: SalesGroupRow[] = [];
    let groupsLoadError: string | null = null;
    if (scope !== null && scope.length === 0) {
      groups = [];
    } else {
      try {
        const countMode = isAdmin(user.role) ? "all" : "team";
        groups = filterGroupsByScope(await fetchSalesGroups({ countMode }), scope);
      } catch (e) {
        groupsLoadError = zespolLoadErrorMessage(e, "groups");
        groups = [];
      }
    }

    const teamUi = applyAdminPanelReadOnlyTeamUi(
      await resolveSalesTeamUiContext(
        user,
        groups.map((group) => group.name)
      ),
      readOnlyPreview
    );

    return { teamUi, groups, readOnlyPreview, groupsLoadError };
  }
);
