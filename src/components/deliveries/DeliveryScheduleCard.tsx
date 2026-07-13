import { cn } from "@/lib/cn";
import { locationLabel } from "@/lib/display-labels";
import { getVacationMessage } from "@/lib/orders/colors";
import { IconSun, IconMapPin } from "@/components/icons/StrokeIcons";
import type { DeliveryScheduleSupplier } from "@/lib/data/upcoming-deliveries";

export function DeliveryScheduleCard({
  supplier,
  compact = false,
}: {
  supplier: DeliveryScheduleSupplier;
  compact?: boolean;
}) {
  const vacationText = supplier.vacationNote
    ? getVacationMessage(supplier.vacationNote, null)
    : null;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white shadow-sm transition hover:shadow-md",
        supplier.isOverduePlan
          ? "border-rose-200/70 bg-rose-50/20"
          : "border-slate-200/80",
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md text-xs font-bold ring-1 ring-inset",
            supplier.isOverduePlan
              ? "bg-rose-100 text-rose-600 ring-rose-200/60"
              : "bg-indigo-50 text-indigo-700 ring-indigo-100/60",
            compact ? "h-7 w-7" : "h-8 w-8"
          )}
          aria-hidden
        >
          {supplier.supplierName.charAt(0).toUpperCase() || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={cn("min-w-0 truncate font-semibold text-slate-900", compact ? "text-xs" : "text-sm")}>
              {supplier.supplierName}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full font-semibold",
                compact ? "px-1.5 py-0 text-[9px] leading-tight" : "px-2 py-0.5 text-[10px]",
                supplier.isOverduePlan
                  ? "bg-rose-100 text-rose-700"
                  : "bg-indigo-100 text-indigo-700"
              )}
            >
              {supplier.isOverduePlan ? "Po planie" : "Plan"}
            </span>
          </div>
          {!compact ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
              <IconMapPin size={11} className="text-slate-400" />
              {locationLabel(supplier.location)}
            </p>
          ) : null}
          {vacationText ? (
            <p className={cn("inline-flex items-center gap-1 text-amber-600", compact ? "mt-0.5 text-[10px]" : "mt-0.5 text-[10px]")}>
              <IconSun size={compact ? 11 : 12} className="text-amber-500" />
              {vacationText}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
