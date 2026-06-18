"use client";

import { SalesPanelSyncControl } from "@/components/sales/SalesPanelSyncControl";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { cn } from "@/lib/cn";
import { panelStickyChromeClass, salesChromeInsetClass } from "@/lib/ui/ontime-theme";

/** Sticky pasek synchronizacji — wspólny dla Moje, ZK i notatnika. */
export function SalesSyncStrip({
  variant = "orders",
  className,
}: {
  variant?: "orders" | "notatnik";
  className?: string;
}) {
  const ctx = useSalesUpdates();
  if (!ctx) return null;

  return (
    <div
      className={cn(
        panelStickyChromeClass,
        "border-t-0 border-b-0 py-2",
        salesChromeInsetClass,
        className
      )}
    >
      <SalesPanelSyncControl variant={variant} />
    </div>
  );
}
