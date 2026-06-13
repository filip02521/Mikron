import { requireSalesTeamManagement } from "@/lib/auth";
import { fetchSalesPeopleAdminForUser } from "@/lib/data/sales-people-admin";
import { salesTeamPageCopy } from "@/lib/sales/team-ui";
import { resolveZespolTeamUiForPage } from "@/lib/sales/resolve-zespol-team-ui";
import { SalesAdminClient } from "@/components/admin/SalesAdminClient";
import { SalesTeamOverview } from "@/components/sales/SalesTeamOverview";
import { SalesTeamSubnav } from "@/components/sales/SalesTeamSubnav";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";
import { TeamPanelReadOnlyNotice } from "@/components/sales/TeamPanelReadOnlyNotice";
import { Alert } from "@/components/ui/Alert";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("teamSales");

export default async function ZespolHandlowcyPage() {
  const user = await requireSalesTeamManagement();
  const { teamUi, groups, readOnlyPreview } = await resolveZespolTeamUiForPage(user);
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
      {readOnlyPreview ? <TeamPanelReadOnlyNotice /> : null}
      {loadError ? (
        <Alert tone="warning" className="mb-4 text-xs leading-relaxed">
          {loadError}
        </Alert>
      ) : null}
      {readOnlyPreview ? (
        <SalesTeamOverview rows={rows} groups={groups} managerSalesPersonId={null} teamUi={teamUi} />
      ) : (
        <SalesAdminClient
          initial={rows}
          groups={groups}
          managerMode={teamUi.isManager}
          requireGroupOnCreate={teamUi.isManager && teamUi.hasTeamScope}
        />
      )}
    </SalesTeamWorkspace>
  );
}
