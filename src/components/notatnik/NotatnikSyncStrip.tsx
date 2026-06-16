"use client";

import { SalesPanelSyncControl } from "@/components/sales/SalesPanelSyncControl";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { cn } from "@/lib/cn";
import { panelStickyChromeClass, salesChromeInsetClass } from "@/lib/ui/ontime-theme";

/** Sticky pasek sync na stronie ZK / notatnik — jak Moje zamówienia. */
export function NotatnikSyncStrip({ className }: { className?: string }) {
  const ctx = useSalesUpdates();
  if (!ctx) return null;

  return (
    <div
      className={cn(
        panelStickyChromeClass,
        "border-t-0 border-b-0 py-2 shadow-[var(--shadow-card-elevated)]",
        salesChromeInsetClass,
        className
      )}
    >
      <SalesPanelSyncControl variant="notatnik" />
    </div>
  );
}
