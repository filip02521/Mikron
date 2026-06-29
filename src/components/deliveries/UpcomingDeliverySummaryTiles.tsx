import { cn } from "@/lib/cn";
import {
  panelMetricTileClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import type { UpcomingDeliverySummary } from "@/lib/data/upcoming-deliveries";

export function UpcomingDeliverySummaryTiles({
  summary,
}: {
  summary: UpcomingDeliverySummary;
}) {
  const tiles: { label: string; value: string | number; hint?: string }[] = [
    { label: "Dostawy", value: summary.dayCount, hint: "dni z dostawami" },
    { label: "Pozycje", value: summary.positionCount, hint: "zamówione" },
    { label: "Paczki", value: summary.estimatedPackages, hint: "prognoza" },
    { label: "Palety", value: summary.estimatedPallets, hint: "prognoza" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={cn(panelMetricTileClass, "border-slate-200/90 bg-white px-3 py-2.5")}
        >
          <p className={panelTypography.caption}>{tile.label}</p>
          <p className={cn(panelTypography.statValue, "mt-0.5 text-lg")}>{tile.value}</p>
          {tile.hint ? (
            <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{tile.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
