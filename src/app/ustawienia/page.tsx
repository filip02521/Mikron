import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isAdmin, isSalesAccount } from "@/lib/auth-roles";
import { VacationPanel } from "@/components/settings/VacationPanel";
import { NotificationSettingsSection } from "@/components/settings/NotificationSettingsSection";
import { AutoRefreshSettingsSection } from "@/components/settings/AutoRefreshSettingsSection";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import { fetchDelegationsForSalesPerson, fetchDelegateOptions, type VacationDelegationRow, type DelegateOption } from "@/lib/data/vacation-delegations";
import { fetchVacationPeriodsForSalesPerson, type VacationPeriodRow } from "@/lib/data/sales-vacation-periods";
import { salesPageShellClass } from "@/lib/ui/ontime-theme";
import { pageMetadata } from "@/lib/ui/page-metadata";

export const metadata = pageMetadata("Ustawienia", "Zarządzaj swoim kontem, urlopami i preferencjami.");

export const dynamic = "force-dynamic";

export default async function UstawieniaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const showSalesSections = isSalesAccount(user.role) || (isAdmin(user.role) && user.salesPersonId);

  let ownSalesPersonId: string | null = null;
  let ownDelegations: VacationDelegationRow[] = [];
  let delegateOptions: DelegateOption[] = [];
  let vacationPeriods: VacationPeriodRow[] = [];

  if (showSalesSections) {
    const own = await resolveSalesPersonForUser(user);
    if (own?.id) {
      ownSalesPersonId = own.id;

      const [delegations, periods] = await Promise.all([
        fetchDelegationsForSalesPerson(own.id).catch(() => [] as VacationDelegationRow[]),
        fetchVacationPeriodsForSalesPerson(own.id).catch(() => [] as VacationPeriodRow[]),
      ]);
      ownDelegations = delegations;
      vacationPeriods = periods;

      try {
        delegateOptions = await fetchDelegateOptions(user.id);
      } catch {}
    }
  }

  return (
    <div className={salesPageShellClass}>
      <SettingsWorkspace
        title="Ustawienia"
        description="Zarządzaj swoim kontem, urlopami i preferencjami."
      >
        {showSalesSections && ownSalesPersonId ? (
          <VacationPanel
            salesPersonId={ownSalesPersonId}
            delegates={delegateOptions}
            initialPeriods={vacationPeriods}
            initialDelegations={ownDelegations}
          />
        ) : null}

        <NotificationSettingsSection role={user.role} />

        <AutoRefreshSettingsSection role={user.role} />
      </SettingsWorkspace>
    </div>
  );
}
