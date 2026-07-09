import { requireSalesAccountOrTeamManagement } from "@/lib/auth";
import { SalesTeamScopeBanner } from "@/components/sales/SalesTeamScopeBanner";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { getZespolPageContext } from "@/lib/sales/zespol-page-context";
import { salesTeamPageShellClass } from "@/lib/ui/ontime-theme";

export default async function ZespolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSalesAccountOrTeamManagement();
  const { teamUi, groupsLoadError } = await getZespolPageContext(user);

  return (
    <div className={salesTeamPageShellClass}>
      {groupsLoadError ? (
        <SystemNotice
          variant="pinned"
          role="alert"
          title="Nie udało się wczytać grup"
          description={groupsLoadError}
        />
      ) : null}
      {teamUi.isManager && !teamUi.hasTeamScope ? <SalesTeamScopeBanner /> : null}
      {children}
    </div>
  );
}
