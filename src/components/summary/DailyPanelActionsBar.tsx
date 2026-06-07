"use client";

import { useRouter } from "next/navigation";
import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import { actionSyncData } from "@/app/actions/admin";
import {
  SupplierSearchField,
  type SupplierDirectoryEntry,
} from "@/components/procurement/SupplierSearchField";
import { Button } from "@/components/ui/Button";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { useActionPending } from "@/hooks/useActionPending";
import { IconPlusCircle } from "@/components/icons/StrokeIcons";
import { PanelDailyHelp } from "@/components/summary/PanelDailyHelp";
import {
  panelToolbarActionsClass,
  panelToolbarIconButtonClass,
  panelToolbarRowClass,
  panelToolbarSearchWrapClass,
  panelToolbarShellClass,
} from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import { useSupplierHubContext } from "@/components/layout/AppRoleContext";
import { supplierHubPaths, supplierVacationsHref } from "@/lib/supplier-hub";

export function DailyPanelActionsBar({
  summary,
  suppliers,
  onNewRequest,
  onSelectSupplier,
  onNewSupplier,
  onOpenOnDemand,
}: {
  summary: DailyInboxSummary;
  suppliers: SupplierDirectoryEntry[];
  onNewRequest: () => void;
  onSelectSupplier: (id: string) => void;
  onNewSupplier: () => void;
  onOpenOnDemand?: () => void;
}) {
  const router = useRouter();
  const hubContext = useSupplierHubContext();
  const { pending: syncPending, pendingMessage, run: runSync } = useActionPending();

  const runSyncSchedules = () => {
    runSync(async () => {
      const r = await actionSyncData();
      if (r.error) throw new Error(r.error);
      router.refresh();
    }, "Przeliczanie terminów wszystkich dostawców…");
  };

  return (
    <div className={cn(panelToolbarShellClass, "relative")}>
      {pendingMessage ? (
        <ActionLoadingOverlay
          variant="viewport"
          message={pendingMessage}
          hint="Urlopy i interwały — panel odświeży się automatycznie"
        />
      ) : null}
      <div className={panelToolbarRowClass}>
        <div className={panelToolbarSearchWrapClass}>
          <SupplierSearchField
            appearance="toolbar"
            suppliers={suppliers}
            onSelect={onSelectSupplier}
          />
        </div>
        <div className={panelToolbarActionsClass}>
          <Button
            size="sm"
            className="h-11 min-h-11 flex-1 gap-1.5 px-3 py-0 text-xs md:h-9 md:min-h-9 md:flex-none"
            onClick={onNewRequest}
          >
            <IconPlusCircle size={15} />
            Nowa prośba
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="hidden h-9 min-h-9 shrink-0 gap-1.5 px-3 py-0 text-xs md:inline-flex"
            onClick={runSyncSchedules}
            disabled={syncPending}
          >
            {syncPending ? "Przeliczanie…" : "Przelicz terminy"}
          </Button>
          <div className="hidden md:block">
            <PanelDailyHelp density="toolbar" />
          </div>
          <OverflowMenu
            label="Więcej akcji panelu"
            iconOnly
            align="end"
            triggerClassName={panelToolbarIconButtonClass}
          >
            <OverflowMenuItem onClick={() => document.getElementById("supplier-search")?.focus()}>
              Szukaj dostawcy…
            </OverflowMenuItem>
            <OverflowMenuItem onClick={onNewSupplier}>+ Nowy dostawca</OverflowMenuItem>
            {onOpenOnDemand && summary.onDemandCount > 0 ? (
              <OverflowMenuItem onClick={onOpenOnDemand}>
                Lista na żądanie ({summary.onDemandCount})
              </OverflowMenuItem>
            ) : null}
            <OverflowMenuItem onClick={() => router.push(supplierHubPaths(hubContext).cards)}>
              Karty dostawców
            </OverflowMenuItem>
            <OverflowMenuItem onClick={() => router.push("/lokalizacje/POLSKA")}>
              Terminy zamówień
            </OverflowMenuItem>
            <OverflowMenuItem onClick={runSyncSchedules} disabled={syncPending}>
              {syncPending ? "Przeliczanie terminów…" : "Przelicz terminy (menu)"}
            </OverflowMenuItem>
            <OverflowMenuItem onClick={() => router.push(supplierVacationsHref(hubContext))}>
              Urlopy
              {summary.vacationSupplierCount > 0
                ? ` (${summary.vacationSupplierCount})`
                : ""}
            </OverflowMenuItem>
          </OverflowMenu>
        </div>
      </div>
    </div>
  );
}
