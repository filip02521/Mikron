import { cn } from "@/lib/cn";
import type { DeliveryScheduleDay } from "@/lib/data/upcoming-deliveries";
import { UpcomingDeliverySupplierCard } from "@/components/deliveries/UpcomingDeliverySupplierCard";
import { DeliveryScheduleCard } from "@/components/deliveries/DeliveryScheduleCard";

export function DeliveryWeekGrid({
  days,
  pending,
}: {
  days: DeliveryScheduleDay[];
  pending: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {days.map((day) => (
        <DeliveryWeekDayColumn key={day.dateKey} day={day} pending={pending} />
      ))}
    </div>
  );
}

function DeliveryWeekDayColumn({
  day,
  pending,
}: {
  day: DeliveryScheduleDay;
  pending: boolean;
}) {
  const zdSuppliers = day.deliveryDay?.suppliers ?? [];
  const scheduledSuppliers = day.scheduledSuppliers;
  const totalCount = zdSuppliers.length + scheduledSuppliers.length;

  const receivedCount = zdSuppliers.filter(
    (s) => s.totalDelivered > 0 && s.totalDelivered >= s.totalQuantity && s.totalQuantity > 0
  ).length;
  const partialCount = zdSuppliers.filter(
    (s) => s.totalDelivered > 0 && (s.totalQuantity === 0 || s.totalDelivered < s.totalQuantity)
  ).length;
  const pendingCount = zdSuppliers.length - receivedCount - partialCount;

  const sortedZdSuppliers = [...zdSuppliers].sort((a, b) => {
    const aComplete = a.totalDelivered > 0 && a.totalDelivered >= a.totalQuantity && a.totalQuantity > 0;
    const bComplete = b.totalDelivered > 0 && b.totalDelivered >= b.totalQuantity && b.totalQuantity > 0;
    if (aComplete && !bComplete) return 1;
    if (!aComplete && bComplete) return -1;
    return 0;
  });

  return (
    <section
      className={cn(
        "flex min-h-[120px] flex-col transition-colors",
        day.isToday
          ? "bg-sky-50/40"
          : day.isPast
            ? "bg-slate-50/40"
            : "bg-white"
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-2 border-b px-3 py-2.5",
          day.isToday ? "border-sky-200/80 bg-sky-100/50" : "border-slate-100"
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              day.isToday ? "text-sky-800" : "text-slate-500"
            )}
          >
            {day.weekdayLabel}
          </p>
          <p className={cn("text-sm font-semibold", day.isToday ? "text-sky-900" : "text-slate-900")}>
            {day.dateLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {day.isToday ? (
            <span className="rounded-full bg-sky-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-800">
              Dziś
            </span>
          ) : null}
          {totalCount > 0 ? (
            <div className="flex items-center gap-1">
              {receivedCount > 0 ? (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-700">
                  ✓{receivedCount}
                </span>
              ) : null}
              {partialCount > 0 ? (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-700">
                  {partialCount}
                </span>
              ) : null}
              {pendingCount > 0 ? (
                <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sky-700">
                  {pendingCount}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-400">
              0
            </span>
          )}
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2">
        {totalCount === 0 && !pending ? (
          <div className="flex flex-1 items-center justify-center py-4 text-center text-xs text-slate-400">
            Brak
          </div>
        ) : null}

        {sortedZdSuppliers.map((supplier) => (
          <UpcomingDeliverySupplierCard
            key={`zd-${day.dateKey}-${supplier.supplierId}`}
            supplier={supplier}
            compact
          />
        ))}

        {scheduledSuppliers.map((supplier) => (
          <DeliveryScheduleCard
            key={`plan-${day.dateKey}-${supplier.supplierId}`}
            supplier={supplier}
            compact
          />
        ))}

        {pending && totalCount === 0 ? (
          <div className="h-14 animate-pulse rounded-lg bg-slate-100" />
        ) : null}
      </div>
    </section>
  );
}
