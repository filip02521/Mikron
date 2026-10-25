"use client";

import { useCallback } from "react";
import { usePersistedFlag } from "@/lib/client/use-persisted-flag";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { salesAutoRefreshStore } from "@/lib/client/sales-auto-refresh-store";
import { operationsAutoRefreshStore } from "@/lib/client/operations-auto-refresh-store";
import { teethAutoRefreshStore } from "@/lib/client/teeth-auto-refresh-store";
import { useOperationsUpdates } from "@/components/operations/OperationsUpdatesContext";
import { useTeethUpdates } from "@/components/zeby/TeethUpdatesContext";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { SettingToggleRow, settingRowsClass } from "@/components/settings/SettingToggleRow";
import type { UserRole } from "@/types/database";

type AutoRefreshSettingsSectionProps = {
  role: UserRole;
};

export function AutoRefreshSettingsSection({ role }: AutoRefreshSettingsSectionProps) {
  const isSales = role === "sales" || role === "sales_manager";
  const isOperations = role === "admin" || role === "zakupy";
  const isTeeth = role === "zakupy_zeby";
  const isMagazyn = role === "magazyn";

  const salesAutoRefresh = usePersistedFlag(salesAutoRefreshStore);
  const opsAutoRefresh = usePersistedFlag(operationsAutoRefreshStore);
  const teethAutoRefresh = usePersistedFlag(teethAutoRefreshStore);
  const hydrated = useClientHydrated();

  const opsSetAutoRefresh = useOperationsUpdates()?.setAutoRefresh;
  const teethSetAutoRefresh = useTeethUpdates()?.setAutoRefresh;
  const salesSetAutoRefresh = useSalesUpdates()?.setAutoRefresh;

  const salesValue = hydrated ? salesAutoRefresh : false;
  const opsValue = hydrated ? opsAutoRefresh : false;
  const teethValue = hydrated ? teethAutoRefresh : false;

  const setSales = useCallback(
    (value: boolean) => {
      if (salesSetAutoRefresh) salesSetAutoRefresh(value);
      else salesAutoRefreshStore.setValue(value);
    },
    [salesSetAutoRefresh]
  );
  const setOps = useCallback(
    (value: boolean) => {
      if (opsSetAutoRefresh) opsSetAutoRefresh(value);
      else operationsAutoRefreshStore.setValue(value);
    },
    [opsSetAutoRefresh]
  );
  const setTeeth = useCallback(
    (value: boolean) => {
      if (teethSetAutoRefresh) teethSetAutoRefresh(value);
      else teethAutoRefreshStore.setValue(value);
    },
    [teethSetAutoRefresh]
  );

  const showSales = isSales;
  const showOps = isOperations || isMagazyn;
  const showTeeth = isTeeth;
  const hasAny = showSales || showOps || showTeeth;

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        title="Auto-odświeżanie"
        description="Automatyczne odświeżanie listy po wykryciu zmian."
      />
      <div className={settingRowsClass}>
        {showSales ? (
          <SettingToggleRow
            label="Odświeżaj pozostałe strony po zmianach"
            description="„Moje” i notatnik odświeżają się zawsze. Ta opcja odświeża też pozostałe strony sprzedaży zaraz po wykryciu zmian."
            checked={salesValue}
            onChange={setSales}
          />
        ) : null}
        {showOps ? (
          <SettingToggleRow
            label="Odświeżaj pozostałe strony po zmianach"
            description="Dziś, weryfikacja i tablica odświeżają się zawsze. Ta opcja obejmuje też pozostałe strony (kolejka, historia…) zaraz po wykryciu zmian."
            checked={opsValue}
            onChange={setOps}
          />
        ) : null}
        {showTeeth ? (
          <SettingToggleRow
            label="Odświeżaj pozostałe strony po zmianach"
            description="Strony panelu zębów odświeżają się zawsze. Ta opcja obejmuje też pozostałe strony zaraz po wykryciu zmian."
            checked={teethValue}
            onChange={setTeeth}
          />
        ) : null}
        {!hasAny ? (
          <p className="px-5 py-4 text-sm text-slate-500 sm:px-6">
            Brak dostępnych ustawień auto-odświeżania dla Twojej roli.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
