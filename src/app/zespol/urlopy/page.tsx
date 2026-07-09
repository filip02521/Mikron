import { requireSalesAccountOrTeamManagement } from "@/lib/auth";
import { canManageSalesTeam } from "@/lib/auth-roles";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import {
  fetchSalesPeopleAdminForUser,
  fetchSalesPeopleInSameGroup,
} from "@/lib/data/sales-people-admin";
import {
  fetchDelegationsForSalesPeople,
  fetchDelegateOptions,
} from "@/lib/data/vacation-delegations";
import { fetchVacationPeriodsForSalesPeople } from "@/lib/data/sales-vacation-periods";
import { getZespolPageContext } from "@/lib/sales/zespol-page-context";
import { zespolLoadErrorMessage } from "@/lib/sales/zespol-load-errors";
import { VacationCalendar } from "@/components/settings/VacationCalendar";
import { SalesTeamSubnav } from "@/components/sales/SalesTeamSubnav";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconSun } from "@/components/icons/StrokeIcons";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("team", {
  title: "Urlopy",
  description: "Kalendarz urlopów grupy handlowców",
});

type CalendarSalesPerson = {
  id: string;
  name: string;
  linkedUserId: string | null;
};

export default async function ZespolUrlopyPage() {
  const user = await requireSalesAccountOrTeamManagement();
  const { readOnlyPreview } = await getZespolPageContext(user);
  const isManager = canManageSalesTeam(user.role);
  const ownSalesPerson = !isManager ? await resolveSalesPersonForUser(user) : null;
  const ownSalesPersonId = ownSalesPerson?.id ?? null;

  let salesPeopleForCalendar: CalendarSalesPerson[] = [];
  let loadError: string | null = null;

  if (isManager) {
    try {
      const rows = await fetchSalesPeopleAdminForUser(user);
      salesPeopleForCalendar = rows.map((sp) => ({
        id: sp.id,
        name: sp.name,
        linkedUserId: sp.linkedUserId,
      }));
    } catch (e) {
      loadError = zespolLoadErrorMessage(e, "people");
    }
  } else if (ownSalesPersonId) {
    try {
      salesPeopleForCalendar = await fetchSalesPeopleInSameGroup(ownSalesPersonId);
      if (!salesPeopleForCalendar.some((sp) => sp.id === ownSalesPersonId)) {
        salesPeopleForCalendar = [
          { id: ownSalesPersonId, name: ownSalesPerson!.name, linkedUserId: user.id },
          ...salesPeopleForCalendar,
        ];
      }
    } catch (e) {
      loadError = zespolLoadErrorMessage(e, "people");
    }
  }

  const ids = salesPeopleForCalendar.map((sp) => sp.id);
  const [periodsBySalesPerson, delegationsBySalesPerson] = await Promise.all([
    fetchVacationPeriodsForSalesPeople(ids).catch(() => ({})),
    fetchDelegationsForSalesPeople(ids).catch(() => ({})),
  ]);

  let delegateOptions: Awaited<ReturnType<typeof fetchDelegateOptions>> = [];
  try {
    delegateOptions = await fetchDelegateOptions(user.id);
  } catch {}

  return (
    <SalesTeamWorkspace
      title={isManager ? "Urlopy i zastępstwa" : "Urlopy"}
      description={
        isManager
          ? "Przeglądaj urlopy i wyznaczaj zastępców dla handlowców. Zastępca zyskuje dostęp do panelu (odczyt + potwierdzenie odbioru + zamykanie ZK)."
          : "Kalendarz urlopów Twojej grupy. Dodaj swój urlop i sprawdź kto jest na urlopie."
      }
      hint={
        isManager
          ? "Zastępca widzi panel przez przełącznik w /moje z parametrem ?dla="
          : undefined
      }
      iconKey={isManager ? "team" : "vacation"}
      subnav={isManager ? <SalesTeamSubnav /> : null}
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
      {!salesPeopleForCalendar.length ? (
        isManager ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Brak handlowców do zarządzania zastępstwami.
          </p>
        ) : (
          <EmptyState
            brandAccent
            icon={<IconSun size={28} />}
            title="Brak grupy handlowców"
            description="Nie masz przypisanej grupy zespołu. Skontaktuj się z administratorem, aby zostać przypisanym do grupy (np. Sklep, Biuro)."
          />
        )
      ) : (
        <VacationCalendar
          salesPeople={salesPeopleForCalendar}
          periodsBySalesPerson={periodsBySalesPerson}
          delegationsBySalesPerson={delegationsBySalesPerson}
          delegateOptions={delegateOptions}
          canManage={!readOnlyPreview}
          readOnlyPreview={readOnlyPreview}
          editableSalesPersonId={isManager ? null : ownSalesPersonId}
          todayDateKey={todayDateKeyInWarsaw()}
        />
      )}
    </SalesTeamWorkspace>
  );
}
