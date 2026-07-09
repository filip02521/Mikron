import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import {
  IconTruck,
  IconPackage,
  IconWarehouse,
  IconBuilding,
  IconCalendar,
} from "@/components/icons/StrokeIcons";
import type { ExtendedDeliverySummary } from "@/lib/data/upcoming-deliveries";

export function UpcomingDeliverySummaryTiles({
  summary,
}: {
  summary: ExtendedDeliverySummary;
}) {
  const todayTotal = summary.todayDeliveryCount + summary.todayScheduledCount;

  const tiles: {
    label: string;
    value: string | number;
    hint?: string;
    icon: React.ReactNode;
    highlight?: boolean;
  }[] = [
    {
      label: "Dostawy",
      value: summary.dayCount,
      hint: "dni z dostawami",
      icon: <IconTruck size={14} className="text-slate-400" />,
    },
    {
      label: "Pozycje",
      value: summary.positionCount,
      hint: "zamówione",
      icon: <IconPackage size={14} className="text-slate-400" />,
    },
    {
      label: "Paczki",
      value: summary.estimatedPackages,
      hint: "prognoza",
      icon: <IconPackage size={14} className="text-slate-400" />,
    },
    {
      label: "Palety",
      value: summary.estimatedPallets,
      hint: "prognoza",
      icon: <IconWarehouse size={14} className="text-slate-400" />,
    },
    {
      label: "Dostawcy",
      value: summary.scheduledSupplierCount,
      hint: "z planu",
      icon: <IconBuilding size={14} className="text-slate-400" />,
    },
    {
      label: "Na dziś",
      value: todayTotal,
      hint: `${summary.todayDeliveryCount} ZD · ${summary.todayScheduledCount} plan`,
      icon: <IconCalendar size={14} className="text-emerald-500" />,
      highlight: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={cn(
            "rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-left shadow-[var(--shadow-card)] ring-1 ring-inset transition hover:shadow-sm",
            tile.highlight
              ? "ring-emerald-200/50 bg-emerald-50/20"
              : "ring-slate-100/50"
          )}
        >
          <div className="flex items-center gap-1.5">
            {tile.icon}
            <p className={panelTypography.caption}>{tile.label}</p>
          </div>
          <p className={cn(panelTypography.statValue, "mt-0.5 text-lg")}>{tile.value}</p>
          {tile.hint ? (
            <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{tile.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
