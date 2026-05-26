import { requireSalesTeamManagement } from "@/lib/auth";
import { filterGroupsByScope, getManagedGroupIdsForUser } from "@/lib/data/sales-group-access";
import { fetchSalesGroups } from "@/lib/data/sales-groups";
import { resolveSalesTeamUiContext } from "@/lib/sales/team-ui";
import { SalesTeamScopeBanner } from "@/components/sales/SalesTeamScopeBanner";
import { SalesTeamUiProvider } from "@/components/sales/SalesTeamUiContext";

export default async function ZespolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSalesTeamManagement();
  const scope = await getManagedGroupIdsForUser(user);
  const groups = filterGroupsByScope(await fetchSalesGroups(), scope);
  const teamUi = await resolveSalesTeamUiContext(
    user,
    groups.map((g) => g.name)
  );

  return (
    <SalesTeamUiProvider value={teamUi}>
      {teamUi.isManager && !teamUi.hasTeamScope ? <SalesTeamScopeBanner /> : null}
      {children}
    </SalesTeamUiProvider>
  );
}
