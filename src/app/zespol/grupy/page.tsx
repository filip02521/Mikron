import { requireSalesTeamManagement } from "@/lib/auth";
import { salesTeamPageCopy } from "@/lib/sales/team-ui";
import { SALES_PAGE_HEADER_HINTS } from "@/lib/sales/sales-page-ui-copy";
import { getZespolPageContext } from "@/lib/sales/zespol-page-context";
import { SalesGroupsClient } from "@/components/sales/SalesGroupsClient";
import { SalesTeamSubnav } from "@/components/sales/SalesTeamSubnav";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("teamGroups");

export default async function ZespolGrupyPage() {
  const user = await requireSalesTeamManagement();
  const { teamUi, groups, readOnlyPreview, groupsLoadError } = await getZespolPageContext(user);
  const copy = salesTeamPageCopy(teamUi, "grupy");

  return (
    <SalesTeamWorkspace
      title={copy.title}
      description={copy.description}
      hint={SALES_PAGE_HEADER_HINTS.teamGroups}
      iconKey="teamGroups"
      subnav={<SalesTeamSubnav />}
    >
      <SalesGroupsClient
        initial={groups}
        canCreateGroups={teamUi.canCreateGroups}
        readOnlyPreview={readOnlyPreview}
        embeddedInTeamWorkspace
        loadError={groupsLoadError}
      />
    </SalesTeamWorkspace>
  );
}
