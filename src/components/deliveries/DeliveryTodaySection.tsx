import type { DeliveryScheduleDay } from "@/lib/data/upcoming-deliveries-shared";
import { UpcomingDeliverySupplierCard } from "@/components/deliveries/UpcomingDeliverySupplierCard";
import { DeliveryScheduleCard } from "@/components/deliveries/DeliveryScheduleCard";
import { Card } from "@/components/ui/Card";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { polishPluralWord } from "@/lib/email/polish-plural";

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
  const overdueCount = zdSuppliers.filter((s) => s.isOverdueDeadline).length;

  return (
    <Card padding={false} className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-3 pb-3 pt-4 sm:px-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Dziś <span className="font-normal text-slate-600">· {todayDay.dateLabel}</span>
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {totalCount > 0
              ? `${totalCount} ${polishPluralWord(totalCount, "dostawa", "dostawy", "dostaw")}: ${zdSuppliers.length} z ZD · ${scheduledSuppliers.length} z planu${
                  overdueCount > 0 ? ` · ${overdueCount} po terminie` : ""
                }`
              : "Brak zaplanowanych dostaw"}
          </p>
        </div>
      </div>

      {totalCount === 0 && !pending ? (
        <p className="px-4 py-6 text-center text-sm text-slate-600">
          Na dziś nic nie zaplanowano. Sprawdź kolejkę przyjęcia albo inne dni poniżej.
        </p>
      ) : null}

      {totalCount > 0 ? (
        <div className="space-y-2 p-3 sm:p-4">
          {zdSuppliers.map((supplier) => (
            <UpcomingDeliverySupplierCard key={`zd-${supplier.supplierId}`} supplier={supplier} />
          ))}
          {scheduledSuppliers.map((supplier) => (
            <DeliveryScheduleCard key={`plan-${supplier.supplierId}`} supplier={supplier} />
          ))}
        </div>
      ) : null}

      {pending && totalCount === 0 ? (
        <div role="status" className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-slate-600">
          <BrandLoader size="md" tile={false} />
          Wczytuję dostawy na dziś…
        </div>
      ) : null}
    </Card>
  );
}
