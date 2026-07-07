"use client";

import { useCallback } from "react";
import { usePersistedFlag } from "@/lib/client/use-persisted-flag";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { salesAutoRefreshStore } from "@/lib/client/sales-auto-refresh-store";
import { operationsAutoRefreshStore } from "@/lib/client/operations-auto-refresh-store";
import { teethAutoRefreshStore } from "@/lib/client/teeth-auto-refresh-store";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconClock } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass, salesTypography, panelTypography } from "@/lib/ui/ontime-theme";
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

  const salesValue = hydrated ? salesAutoRefresh : false;
  const opsValue = hydrated ? opsAutoRefresh : false;
  const teethValue = hydrated ? teethAutoRefresh : false;

  const setSales = useCallback((value: boolean) => {
    salesAutoRefreshStore.setValue(value);
  }, []);
  const setOps = useCallback((value: boolean) => {
    operationsAutoRefreshStore.setValue(value);
  }, []);
  const setTeeth = useCallback((value: boolean) => {
    teethAutoRefreshStore.setValue(value);
  }, []);

  const typography = isSales ? salesTypography : panelTypography;

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
      <div className={cn(salesChromeInsetClass, "space-y-3 py-3")}>
        {showSales ? (
          <label
            className={cn(
              "inline-flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 font-medium shadow-sm transition-colors",
              typography.chrome,
              salesValue
                ? "border-indigo-200/90 bg-indigo-50/50 text-indigo-900"
                : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-indigo-100 hover:bg-indigo-50/30"
            )}
          >
            <span className="whitespace-nowrap">Auto przy zmianach (panel sprzedaży)</span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={salesValue}
              aria-label="Automatyczne odświeżanie panelu sprzedaży przy wykrytych zmianach"
              checked={salesValue}
              onChange={(e) => setSales(e.target.checked)}
              className="size-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 sm:size-4"
            />
          </label>
        ) : null}

        {showOps ? (
          <label
            className={cn(
              "inline-flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 font-medium shadow-sm transition-colors",
              typography.chrome,
              opsValue
                ? "border-indigo-200/90 bg-indigo-50/50 text-indigo-900"
                : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-indigo-100 hover:bg-indigo-50/30"
            )}
          >
            <span className="whitespace-nowrap">Auto przy zmianach (panel operacji)</span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={opsValue}
              aria-label="Automatyczne odświeżanie panelu operacji przy wykrytych zmianach"
              checked={opsValue}
              onChange={(e) => setOps(e.target.checked)}
              className="size-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 sm:size-4"
            />
          </label>
        ) : null}

        {showTeeth ? (
          <label
            className={cn(
              "inline-flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 font-medium shadow-sm transition-colors",
              typography.chrome,
              teethValue
                ? "border-indigo-200/90 bg-indigo-50/50 text-indigo-900"
                : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-indigo-100 hover:bg-indigo-50/30"
            )}
          >
            <span className="whitespace-nowrap">Auto przy zmianach (panel zębów)</span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={teethValue}
              aria-label="Automatyczne odświeżanie panelu zębów przy wykrytych zmianach"
              checked={teethValue}
              onChange={(e) => setTeeth(e.target.checked)}
              className="size-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 sm:size-4"
            />
          </label>
        ) : null}

        {!hasAny ? (
          <p className="py-2 text-center text-sm text-slate-500">
            Brak dostępnych ustawień auto-odświeżania dla Twojej roli.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
