import { IconCalendarRange } from "@/components/icons/StrokeIcons";
import type { DeliveryScheduleDay } from "@/lib/data/upcoming-deliveries";
import { UpcomingDeliverySupplierCard } from "@/components/deliveries/UpcomingDeliverySupplierCard";
import { DeliveryScheduleCard } from "@/components/deliveries/DeliveryScheduleCard";

export function DeliveryTodaySection({
  todayDay,
  pending,
}: {
  todayDay: DeliveryScheduleDay;
  pending: boolean;
}) {
  const zdSuppliers = todayDay.deliveryDay?.suppliers ?? [];
  const scheduledSuppliers = todayDay.scheduledSuppliers;
  const totalCount = zdSuppliers.length + scheduledSuppliers.length;

  return (
    <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/30 shadow-sm">
      <div className="flex items-center gap-3 border-b border-emerald-100/80 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <IconCalendarRange size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Dziś — <span className="font-normal text-slate-600">{todayDay.dateLabel}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            {totalCount > 0
              ? `${zdSuppliers.length} dostaw ZD · ${scheduledSuppliers.length} planowych`
              : "Brak zaplanowanych dostaw"}
          </p>
        </div>
        {totalCount > 0 ? (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-800">
            {totalCount}
          </span>
        ) : null}
      </div>

      {totalCount === 0 && !pending ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-slate-500">Brak zaplanowanych dostaw na dziś</p>
          <p className="mt-1 text-xs text-slate-400">Sprawdź kolejkę przyjęcia towaru lub nawiguj do innych dni.</p>
        </div>
      ) : null}

      {totalCount > 0 ? (
        <div className="space-y-2 p-3 sm:p-4">
          {zdSuppliers.map((supplier) => (
            <UpcomingDeliverySupplierCard key={`zd-${supplier.supplierId}`} supplier={supplier} />
          ))}
          {scheduledSuppliers.map((supplier) => (
            <DeliveryScheduleCard
              key={`plan-${supplier.supplierId}`}
              supplier={supplier}
            />
          ))}
        </div>
      ) : null}

      {pending && totalCount === 0 ? (
        <div className="space-y-2 p-3 sm:p-4">
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : null}
    </div>
  );
}
