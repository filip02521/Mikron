import { requireSalesTeamManagement } from "@/lib/auth";
import { isAdminReadOnlyPanelPreview } from "@/lib/auth/admin-panel-context";
import { readAdminPanelContextForSession } from "@/lib/auth/read-admin-panel-context";
import { filterGroupsByScope, getManagedGroupIdsForUser } from "@/lib/data/sales-group-access";
import { fetchSalesGroups } from "@/lib/data/sales-groups";
import {
  applyAdminPanelReadOnlyTeamUi,
  resolveSalesTeamUiContext,
} from "@/lib/sales/team-ui";
import { SalesTeamScopeBanner } from "@/components/sales/SalesTeamScopeBanner";
import { SalesTeamUiProvider } from "@/components/sales/SalesTeamUiContext";

export default async function ZespolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSalesTeamManagement();
  const { panelContext } = await readAdminPanelContextForSession();
  const readOnlyPreview = isAdminReadOnlyPanelPreview(user.role, panelContext);
  const scope = await getManagedGroupIdsForUser(user);
  const groups = filterGroupsByScope(await fetchSalesGroups(), scope);
  const teamUi = applyAdminPanelReadOnlyTeamUi(
    await resolveSalesTeamUiContext(
      user,
      groups.map((g) => g.name)
    ),
    readOnlyPreview
  );

  return (
    <SalesTeamUiProvider value={teamUi}>
      {teamUi.isManager && !teamUi.hasTeamScope ? <SalesTeamScopeBanner /> : null}
      {children}
    </SalesTeamUiProvider>
  );
}
