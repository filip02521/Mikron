import { requireSalesTeamManagement } from "@/lib/auth";
import { filterGroupsByScope, getManagedGroupIdsForUser } from "@/lib/data/sales-group-access";
import { fetchSalesGroups } from "@/lib/data/sales-groups";
import { fetchSalesPeopleAdminForUser } from "@/lib/data/sales-people-admin";
import { resolveSalesTeamUiContext, salesTeamPageCopy } from "@/lib/sales/team-ui";
import { SalesAdminClient } from "@/components/admin/SalesAdminClient";
import { SalesTeamSubnav } from "@/components/sales/SalesTeamSubnav";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("teamSales");

export default async function ZespolHandlowcyPage() {
  const user = await requireSalesTeamManagement();
  const scope = await getManagedGroupIdsForUser(user);
  const groups = filterGroupsByScope(await fetchSalesGroups(), scope);
  const teamUi = await resolveSalesTeamUiContext(
    user,
    groups.map((g) => g.name)
  );
  const copy = salesTeamPageCopy(teamUi, "handlowcy");

  let rows: Awaited<ReturnType<typeof fetchSalesPeopleAdminForUser>> = [];
  let loadError: string | null = null;
  try {
    rows = await fetchSalesPeopleAdminForUser(user);
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Nie udało się wczytać listy. Uruchom migrację 028_sales_groups.sql w Supabase.";
  }

  return (
    <SalesTeamWorkspace
      title={copy.title}
      description={copy.description}
      iconKey="teamAccounts"
    >
      <SalesTeamSubnav />
      {loadError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          {loadError}
        </p>
      ) : null}
      <SalesAdminClient
        initial={rows}
        groups={groups}
        managerMode={teamUi.isManager}
        requireGroupOnCreate={teamUi.isManager && teamUi.hasTeamScope}
      />
    </SalesTeamWorkspace>
  );
}
