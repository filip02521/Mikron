import { requireSalesTeamManagement } from "@/lib/auth";
import { fetchSalesPeopleAdminForUser } from "@/lib/data/sales-people-admin";
import { salesTeamPageCopy } from "@/lib/sales/team-ui";
import { SALES_PAGE_HEADER_HINTS } from "@/lib/sales/sales-page-ui-copy";
import { getZespolPageContext } from "@/lib/sales/zespol-page-context";
import { zespolLoadErrorMessage } from "@/lib/sales/zespol-load-errors";
import { SalesAdminClient } from "@/components/admin/SalesAdminClient";
import { SalesTeamSubnav } from "@/components/sales/SalesTeamSubnav";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";
import { SystemNotice } from "@/components/ui/SystemNotice";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("teamSales");

export default async function ZespolHandlowcyPage() {
  const user = await requireSalesTeamManagement();
  const { teamUi, groups } = await getZespolPageContext(user);
  const copy = salesTeamPageCopy(teamUi, "handlowcy");

  let rows: Awaited<ReturnType<typeof fetchSalesPeopleAdminForUser>> = [];
  let loadError: string | null = null;
  try {
    rows = await fetchSalesPeopleAdminForUser(user);
  } catch (e) {
    loadError = zespolLoadErrorMessage(e, "people");
  }

  return (
    <SalesTeamWorkspace
      title={copy.title}
      description={copy.description}
      hint={SALES_PAGE_HEADER_HINTS.teamHandlowcy}
      iconKey="teamAccounts"
      subnav={<SalesTeamSubnav />}
      notices={
        loadError ? (
          <SystemNotice
            variant="pinned"
            role="alert"
            title="Nie udało się wczytać listy"
            description={loadError}
          />
        ) : null
      }
    >
      {loadError ? null : (
        <SalesAdminClient
          initial={rows}
          groups={groups}
          managerMode={teamUi.isManager}
          managerHasTeamScope={teamUi.hasTeamScope}
          requireGroupOnCreate={teamUi.isManager && teamUi.hasTeamScope}
          embeddedInTeamWorkspace
        />
      )}
    </SalesTeamWorkspace>
  );
}
