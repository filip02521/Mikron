import { requireSalesTeamManagement } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { fetchSalesPeopleAdminForUser } from "@/lib/data/sales-people-admin";
import { salesTeamPageCopy } from "@/lib/sales/team-ui";
import { resolveZespolTeamUiForPage } from "@/lib/sales/resolve-zespol-team-ui";
import { SalesTeamOverview } from "@/components/sales/SalesTeamOverview";
import { SalesTeamSubnav } from "@/components/sales/SalesTeamSubnav";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";
import { TeamPanelReadOnlyNotice } from "@/components/sales/TeamPanelReadOnlyNotice";
import { Alert } from "@/components/ui/Alert";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("team");

export default async function ZespolPage() {
  const user = await requireSalesTeamManagement();
  const { teamUi, groups, readOnlyPreview } = await resolveZespolTeamUiForPage(user);
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
      {readOnlyPreview ? <TeamPanelReadOnlyNotice /> : null}
      {loadError ? (
        <Alert tone="warning" className="mb-4 text-xs leading-relaxed">
          {loadError}
        </Alert>
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
