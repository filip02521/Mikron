import { requireSalesTeamManagement } from "@/lib/auth";
import { salesTeamPageCopy } from "@/lib/sales/team-ui";
import { resolveZespolTeamUiForPage } from "@/lib/sales/resolve-zespol-team-ui";
import { SalesGroupsClient } from "@/components/sales/SalesGroupsClient";
import { SalesTeamSubnav } from "@/components/sales/SalesTeamSubnav";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";
import { TeamPanelReadOnlyNotice } from "@/components/sales/TeamPanelReadOnlyNotice";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("teamGroups");

export default async function ZespolGrupyPage() {
  const user = await requireSalesTeamManagement();
  const { teamUi, groups, readOnlyPreview } = await resolveZespolTeamUiForPage(user);
  const copy = salesTeamPageCopy(teamUi, "grupy");

  return (
    <SalesTeamWorkspace title={copy.title} description={copy.description} iconKey="teamAccounts">
      <SalesTeamSubnav />
      {readOnlyPreview ? <TeamPanelReadOnlyNotice /> : null}
      <SalesGroupsClient
        initial={groups}
        canCreateGroups={teamUi.canCreateGroups}
        readOnlyPreview={readOnlyPreview}
      />
    </SalesTeamWorkspace>
  );
}
