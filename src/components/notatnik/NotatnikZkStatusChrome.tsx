"use client";

import { SalesPanelSyncControl } from "@/components/sales/SalesPanelSyncControl";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { SubiektStatusBar } from "@/components/subiekt/SubiektStatusBar";
import { cn } from "@/lib/cn";
import type { SubiektAvailability } from "@/lib/subiekt/availability";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";

/** Sync listy ZK + opcjonalnie status magazynu — jeden spójny pasek w karcie. */
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
      <div className={cn(salesChromeInsetClass, "py-2")}>
        <SalesPanelSyncControl variant="notatnik" embedded compact />
      </div>
      {subiektInitial ? (
        <SubiektStatusBar
          initial={subiektInitial}
          embedded
          compact
          onStatusChange={onSubiektStatusChange}
        />
      ) : null}
    </div>
  );
}
