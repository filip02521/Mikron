"use client";

import { SalesPanelSyncControl } from "@/components/sales/SalesPanelSyncControl";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { SubiektStatusBar } from "@/components/subiekt/SubiektStatusBar";
import { cn } from "@/lib/cn";
import type { SubiektAvailability } from "@/lib/subiekt/availability";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";

/** Sync listy ZK + status magazynu w jednym pasku. */
export function NotatnikZkStatusChrome({
  subiektInitial,
  onSubiektStatusChange,
}: {
  subiektInitial?: SubiektAvailability;
  onSubiektStatusChange?: (status: SubiektAvailability) => void;
}) {
  const ctx = useSalesUpdates();
  if (!ctx) return null;

  return (
    <div className="border-b border-slate-100 bg-slate-50/45">
      <div
        className={cn(
          salesChromeInsetClass,
          "flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
        )}
      >
        <SalesPanelSyncControl variant="notatnik" embedded compact />
        {subiektInitial ? (
          <SubiektStatusBar
            initial={subiektInitial}
            embedded
            compact
            className="min-w-0 sm:max-w-md sm:flex-1"
            onStatusChange={onSubiektStatusChange}
          />
        ) : null}
      </div>
    </div>
  );
}
