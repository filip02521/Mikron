"use client";

import { useRouter } from "next/navigation";
import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import { actionSyncData } from "@/app/actions/admin";
import {
  SupplierSearchField,
  type SupplierDirectoryEntry,
} from "@/components/procurement/SupplierSearchField";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { useActionPending } from "@/hooks/useActionPending";
import { IconPlusCircle } from "@/components/icons/StrokeIcons";

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
  const { pending: syncPending, pendingMessage, run: runSync } = useActionPending();

  const runSyncSchedules = () => {
    runSync(async () => {
      const r = await actionSyncData();
      if (r.error) throw new Error(r.error);
    }, "Przeliczanie terminów wszystkich dostawców…");
  };

  return (
    <div className="relative flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
      {pendingMessage ? (
        <ActionLoadingOverlay
          variant="viewport"
          message={pendingMessage}
          hint="Urlopy i interwały — panel odświeży się automatycznie"
        />
      ) : null}
      <div className="min-w-0 w-full basis-full sm:w-auto sm:max-w-[14rem] sm:flex-1 lg:max-w-xs">
        <SupplierSearchField suppliers={suppliers} onSelect={onSelectSupplier} />
      </div>
      <Button size="sm" className="shrink-0 gap-1.5" onClick={onNewRequest}>
        <IconPlusCircle size={16} />
        Nowa prośba
      </Button>
      <OverflowMenu label="Więcej akcji panelu" iconOnly align="end">
        <OverflowMenuItem onClick={() => document.getElementById("supplier-search")?.focus()}>
          Szukaj dostawcy…
        </OverflowMenuItem>
        <OverflowMenuItem onClick={onNewSupplier}>+ Nowy dostawca</OverflowMenuItem>
        {onOpenOnDemand && summary.onDemandCount > 0 ? (
          <OverflowMenuItem onClick={onOpenOnDemand}>
            Lista na żądanie ({summary.onDemandCount})
          </OverflowMenuItem>
        ) : null}
        <OverflowMenuItem onClick={runSyncSchedules} disabled={syncPending}>
          {syncPending ? "Przeliczanie terminów…" : "Przelicz terminy"}
        </OverflowMenuItem>
        <OverflowMenuItem onClick={() => router.push("/zakupy/urlopy")}>
          Urlopy
          {summary.vacationSupplierCount > 0
            ? ` (${summary.vacationSupplierCount})`
            : ""}
        </OverflowMenuItem>
      </OverflowMenu>
    </div>
  );
}
