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
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconClock } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";
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
        density="compact"
        title="Auto-odświeżanie"
        description="Automatyczne odświeżanie listy po wykryciu zmian."
        leading={
          <SectionHeadingIcon tileClassName="bg-indigo-100 text-indigo-800">
            <IconClock size={20} />
          </SectionHeadingIcon>
        }
      />
      <div className={cn(salesChromeInsetClass, "space-y-2.5 py-3.5")}>
        {showSales ? (
          <label
            className={cn(
              "flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all",
              salesValue
                ? "border-indigo-200/80 bg-indigo-50/40"
                : "border-slate-200/70 bg-white hover:border-slate-300/80 hover:bg-slate-50/40"
            )}
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-slate-800">
                Auto przy zmianach (panel sprzedaży)
              </span>
              <span className="text-[11px] leading-snug text-slate-400">
                „Moje” i notatnik odświeżają się zawsze. Ta opcja odświeża też pozostałe
                strony sprzedaży zaraz po wykryciu zmian.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={salesValue}
              aria-label="Automatyczne odświeżanie panelu sprzedaży przy wykrytych zmianach"
              checked={salesValue}
              onChange={(e) => setSales(e.target.checked)}
              className="toggle-switch toggle-indigo"
            />
          </label>
        ) : null}

        {showOps ? (
          <label
            className={cn(
              "flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all",
              opsValue
                ? "border-indigo-200/80 bg-indigo-50/40"
                : "border-slate-200/70 bg-white hover:border-slate-300/80 hover:bg-slate-50/40"
            )}
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-slate-800">
                Auto przy zmianach (panel operacji)
              </span>
              <span className="text-[11px] leading-snug text-slate-400">
                Dziś, weryfikacja i tablica odświeżają się zawsze. Ta opcja obejmuje też
                pozostałe strony (kolejka, historia…) zaraz po wykryciu zmian.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={opsValue}
              aria-label="Automatyczne odświeżanie panelu operacji przy wykrytych zmianach"
              checked={opsValue}
              onChange={(e) => setOps(e.target.checked)}
              className="toggle-switch toggle-indigo"
            />
          </label>
        ) : null}

        {showTeeth ? (
          <label
            className={cn(
              "flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all",
              teethValue
                ? "border-indigo-200/80 bg-indigo-50/40"
                : "border-slate-200/70 bg-white hover:border-slate-300/80 hover:bg-slate-50/40"
            )}
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-slate-800">
                Auto przy zmianach (panel zębów)
              </span>
              <span className="text-[11px] leading-snug text-slate-400">
                Ścieżki /zeby odświeżają się zawsze. Ta opcja obejmuje też pozostałe strony
                zaraz po wykryciu zmian.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={teethValue}
              aria-label="Automatyczne odświeżanie panelu zębów przy wykrytych zmianach"
              checked={teethValue}
              onChange={(e) => setTeeth(e.target.checked)}
              className="toggle-switch toggle-indigo"
            />
          </label>
        ) : null}

        {!hasAny ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Brak dostępnych ustawień auto-odświeżania dla Twojej roli.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
