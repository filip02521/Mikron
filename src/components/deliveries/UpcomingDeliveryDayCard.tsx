"use client";

import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import type { UpcomingDeliveryDay } from "@/lib/data/upcoming-deliveries";
import { UpcomingDeliverySupplierCard } from "@/components/deliveries/UpcomingDeliverySupplierCard";

function dayBadgeClass(day: UpcomingDeliveryDay): string {
  if (day.isOverdue) return "bg-rose-100 text-rose-800 ring-1 ring-rose-200/80";
  if (day.isToday) return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80";
  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80";
}

function dayBadgeLabel(day: UpcomingDeliveryDay): string {
  if (day.isOverdue) return "Zaległe";
  if (day.isToday) return "Dziś";
  return day.weekdayLabel;
}

function supplierCountLabel(count: number): string {
  return count === 1 ? "dostawca" : "dostawców";
}

export function UpcomingDeliveryDayCard({ day }: { day: UpcomingDeliveryDay }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white shadow-sm transition hover:shadow-md",
        day.isOverdue
          ? "border-amber-200/70"
          : day.isToday
            ? "border-emerald-200/70"
            : "border-slate-200/70"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-3 py-2.5 sm:px-4",
          day.isOverdue
            ? "border-amber-100 bg-amber-50/40"
            : day.isToday
              ? "border-emerald-100 bg-emerald-50/40"
              : "border-slate-100 bg-slate-50/30"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600">
          <span className="text-xs font-bold tabular-nums">
            {day.dateKey.split("-")[2]}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={panelTypography.rowTitle}>
            {day.weekdayLabel.charAt(0).toUpperCase() + day.weekdayLabel.slice(1)}
            {", "}
            <span className="font-normal text-slate-600">{day.dateLabel}</span>
          </p>
          <p className={panelTypography.caption}>
            {day.suppliers.length}{" "}
            {supplierCountLabel(day.suppliers.length)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            dayBadgeClass(day)
          )}
        >
          {dayBadgeLabel(day)}
        </span>
      </div>
      <div className="space-y-2 p-3 sm:p-4">
        {day.suppliers.map((supplier) => (
          <UpcomingDeliverySupplierCard key={supplier.supplierId} supplier={supplier} />
        ))}
      </div>
    </div>
  );
}
