import { requireSalesTeamManagement } from "@/lib/auth";
import { isAdminReadOnlyPanelPreview } from "@/lib/auth/admin-panel-context";
import { readAdminPanelContextForSession } from "@/lib/auth/read-admin-panel-context";
import { filterGroupsByScope, getManagedGroupIdsForUser } from "@/lib/data/sales-group-access";
import { fetchSalesGroups } from "@/lib/data/sales-groups";
import { fetchSalesPeopleAdminForUser } from "@/lib/data/sales-people-admin";
import {
  applyAdminPanelReadOnlyTeamUi,
  resolveSalesTeamUiContext,
  salesTeamPageCopy,
} from "@/lib/sales/team-ui";
import { SalesAdminClient } from "@/components/admin/SalesAdminClient";
import { SalesTeamOverview } from "@/components/sales/SalesTeamOverview";
import { SalesTeamSubnav } from "@/components/sales/SalesTeamSubnav";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";
import { Alert } from "@/components/ui/Alert";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("teamSales");

export default async function ZespolHandlowcyPage() {
  const user = await requireSalesTeamManagement();
  const { panelContext } = await readAdminPanelContextForSession();
  const readOnlyPreview = isAdminReadOnlyPanelPreview(user.role, panelContext);
  const scope = await getManagedGroupIdsForUser(user);
  const groups = filterGroupsByScope(await fetchSalesGroups(), scope);
  const teamUi = applyAdminPanelReadOnlyTeamUi(
    await resolveSalesTeamUiContext(
      user,
      groups.map((g) => g.name)
    ),
    readOnlyPreview
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
      {readOnlyPreview ? (
        <Alert tone="info" className="mb-4 text-xs">
          Podgląd tylko do odczytu — zarządzanie handlowcami w panelu administracji.
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
