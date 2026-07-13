import { requireSalesTeamManagement } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { fetchSalesPeopleAdminForUser } from "@/lib/data/sales-people-admin";
import { salesTeamPageCopy } from "@/lib/sales/team-ui";
import { SALES_PAGE_HEADER_HINTS } from "@/lib/sales/sales-page-ui-copy";
import { getZespolPageContext } from "@/lib/sales/zespol-page-context";
import { zespolLoadErrorMessage } from "@/lib/sales/zespol-load-errors";
import { SalesTeamOverview } from "@/components/sales/SalesTeamOverview";
import { SalesTeamSubnav } from "@/components/sales/SalesTeamSubnav";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";
import { SystemNotice } from "@/components/ui/SystemNotice";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("team");
export const dynamic = "force-dynamic";

export default async function ZespolPage() {
  const user = await requireSalesTeamManagement();
  const { teamUi, groups } = await getZespolPageContext(user);
  const copy = salesTeamPageCopy(teamUi, "overview");

  let rows: Awaited<ReturnType<typeof fetchSalesPeopleAdminForUser>> = [];
  let loadError: string | null = null;
  try {
    rows = await fetchSalesPeopleAdminForUser(user);
  } catch (e) {
    loadError = zespolLoadErrorMessage(e, "team");
  }
  const ownSalesPerson = await resolveSalesPersonForUser(user);

  return (
    <SalesTeamWorkspace
      title={copy.title}
      description={copy.description}
      hint={SALES_PAGE_HEADER_HINTS.teamOverview}
      subnav={<SalesTeamSubnav />}
      notices={
        loadError ? (
          <SystemNotice
            variant="pinned"
            role="alert"
            title="Nie udało się wczytać zespołu"
            description={loadError}
          />
        ) : null
      }
    >
      <SalesTeamOverview
        rows={rows}
        groups={groups}
        managerSalesPersonId={ownSalesPerson?.id ?? null}
        teamUi={teamUi}
        loadError={loadError}
      />
    </SalesTeamWorkspace>
  );
}
