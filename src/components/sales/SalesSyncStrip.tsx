"use client";

import { SalesPanelSyncControl } from "@/components/sales/SalesPanelSyncControl";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";

/** Dyskretny pasek synchronizacji — wspólny dla Moje, ZK i notatnika. */
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
        "py-1 text-xs text-slate-400",
        salesChromeInsetClass,
        className
      )}
    >
      <SalesPanelSyncControl variant={variant} />
    </div>
  );
}
