import { requireSalesTeamManagement } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { fetchSalesGroups } from "@/lib/data/sales-groups";
import { fetchSalesPeopleAdminForUser } from "@/lib/data/sales-people-admin";
import { filterGroupsByScope, getManagedGroupIdsForUser } from "@/lib/data/sales-group-access";
import { resolveSalesTeamUiContext, salesTeamPageCopy } from "@/lib/sales/team-ui";
import { SalesTeamOverview } from "@/components/sales/SalesTeamOverview";
import { SalesTeamSubnav } from "@/components/sales/SalesTeamSubnav";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("team");

export default async function ZespolPage() {
  const user = await requireSalesTeamManagement();
  const scope = await getManagedGroupIdsForUser(user);
  const allGroups = await fetchSalesGroups();
  const groups = filterGroupsByScope(allGroups, scope);
  const teamUi = await resolveSalesTeamUiContext(
    user,
    groups.map((g) => g.name)
  );
  const copy = salesTeamPageCopy(teamUi, "overview");

  let rows: Awaited<ReturnType<typeof fetchSalesPeopleAdminForUser>> = [];
  let loadError: string | null = null;
  try {
    rows = await fetchSalesPeopleAdminForUser(user);
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Nie udało się wczytać zespołu. Sprawdź migrację 028_sales_groups.sql.";
  }
  const ownSalesPerson = await resolveSalesPersonForUser(user);

  return (
    <SalesTeamWorkspace title={copy.title} description={copy.description}>
      <SalesTeamSubnav />
      {loadError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          {loadError}
        </p>
      ) : null}
      <SalesTeamOverview
        rows={rows}
        groups={groups}
        managerSalesPersonId={ownSalesPerson?.id ?? null}
        teamUi={teamUi}
      />
    </SalesTeamWorkspace>
  );
}
