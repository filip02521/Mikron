import { requireSalesTeamManagement } from "@/lib/auth";
import { fetchSalesPeopleAdminForUser } from "@/lib/data/sales-people-admin";
import { fetchDelegationsForSalesPerson } from "@/lib/data/vacation-delegations";
import { fetchVacationPeriodsForSalesPerson } from "@/lib/data/sales-vacation-periods";
import { getZespolPageContext } from "@/lib/sales/zespol-page-context";
import { zespolLoadErrorMessage } from "@/lib/sales/zespol-load-errors";
import { VacationCalendar } from "@/components/settings/VacationCalendar";
import { SalesTeamSubnav } from "@/components/sales/SalesTeamSubnav";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("team");

export default async function ZespolUrlopyPage() {
  const user = await requireSalesTeamManagement();
  const { readOnlyPreview } = await getZespolPageContext(user);

  let salesPeopleRows: Awaited<ReturnType<typeof fetchSalesPeopleAdminForUser>> = [];
  let loadError: string | null = null;
  try {
    salesPeopleRows = await fetchSalesPeopleAdminForUser(user);
  } catch (e) {
    loadError = zespolLoadErrorMessage(e, "people");
  }

  // Fetch delegations and vacation periods for all sales people
  const delegationsBySalesPerson: Record<string, Awaited<ReturnType<typeof fetchDelegationsForSalesPerson>>> = {};
  const periodsBySalesPerson: Record<string, Awaited<ReturnType<typeof fetchVacationPeriodsForSalesPerson>>> = {};
  for (const sp of salesPeopleRows) {
    try {
      const [delegations, periods] = await Promise.all([
        fetchDelegationsForSalesPerson(sp.id),
        fetchVacationPeriodsForSalesPerson(sp.id),
      ]);
      delegationsBySalesPerson[sp.id] = delegations;
      periodsBySalesPerson[sp.id] = periods;
    } catch {
      delegationsBySalesPerson[sp.id] = [];
      periodsBySalesPerson[sp.id] = [];
    }
  }

  // Fetch potential delegates (all sales accounts + sales managers)
  const supabase = createAdminClient();
  const { data: delegateProfiles } = await supabase
    .from("profiles")
    .select("id, email, role, sales_person_id")
    .in("role", ["sales", "sales_manager"]);

  const delegateOptions = (delegateProfiles ?? []).map((p) => {
    const sp = salesPeopleRows.find((r) => r.id === p.sales_person_id);
    return {
      id: p.id as string,
      name: sp?.name ?? p.email ?? p.id,
      email: p.email ?? "",
    };
  });

  return (
    <SalesTeamWorkspace
      title="Urlopy i zastępstwa"
      description="Przeglądaj urlopy i wyznaczaj zastępców dla handlowców. Zastępca zyskuje dostęp do panelu (odczyt + potwierdzenie odbioru + zamykanie ZK)."
      hint="Zastępca widzi panel przez przełącznik w /moje z parametrem ?dla="
      iconKey="team"
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
      {!salesPeopleRows.length ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Brak handlowców do zarządzania zastępstwami.
        </p>
      ) : (
        <VacationCalendar
          salesPeople={salesPeopleRows.map((sp) => ({
            id: sp.id,
            name: sp.name,
            linkedUserId: sp.linkedUserId,
          }))}
          periodsBySalesPerson={periodsBySalesPerson}
          delegationsBySalesPerson={delegationsBySalesPerson}
          delegateOptions={delegateOptions}
          canManage={!readOnlyPreview}
          readOnlyPreview={readOnlyPreview}
          todayDateKey={todayDateKeyInWarsaw()}
        />
      )}
    </SalesTeamWorkspace>
  );
}
