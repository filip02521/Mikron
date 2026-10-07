"use client";

import { useMemo, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { IconTooth } from "@/components/icons/StrokeIcons";
import {
  groupTeethDetails,
  formatTeethGroupLabel,
  type TeethGroupedDetail,
  type TeethLineDetail,
} from "@/lib/teeth/teeth-catalog";
import {
  teethReceiveDeliveredAllocationByGroup,
  teethReceiveGroupKey,
} from "@/lib/teeth/teeth-receive-picker";
import { cn } from "@/lib/cn";
import type { IndividualOrder } from "@/types/database";
import {
  mojeShipmentLinesShellClass,
  mojeShipmentSectionHeaderClass,
  mojeShipmentSectionHeaderTitleClass,
  mojeShipmentLineRowClass,
} from "@/lib/ui/moje-shipment-row-styles";

type TeethLineSummary = {
  group: TeethGroupedDetail;
  groupKey: string;
  ordered: number;
  delivered: number;
  remaining: number;
};

function buildTeethLineSummaries(
  details: TeethLineDetail[] | undefined,
  teethLineDelivered: Record<string, number> | null | undefined,
  deliveredQuantity: string | null | undefined,
): TeethLineSummary[] {
  const groups = groupTeethDetails(details);
  if (groups.length === 0) return [];

  const fakeOrder = {
    delivered_quantity: deliveredQuantity ?? "",
    teeth_line_delivered: teethLineDelivered ?? null,
  } as IndividualOrder;

  const allocation = teethReceiveDeliveredAllocationByGroup(fakeOrder, groups);

  return groups.map((group) => {
    const groupKey = teethReceiveGroupKey(group);
    const ordered = Math.max(1, group.count);
    const delivered = allocation[groupKey] ?? 0;
    return {
      group,
      groupKey,
      ordered,
      delivered,
      remaining: Math.max(0, ordered - delivered),
    };
  });
}

function DeliveryBadge({ delivered, ordered }: { delivered: number; ordered: number }) {
  if (delivered <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200/80">
        czeka
      </span>
    );
  }
  if (delivered >= ordered) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
        komplet
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200/80">
      częściowo
    </span>
  );
}

export function TeethOrderDetailDialog({
  teethDetails,
  teethLineDelivered,
  deliveredQuantity,
  triggerClassName,
  triggerSize = "sm",
  triggerVariant = "ghost",
}: {
  teethDetails?: TeethLineDetail[] | undefined;
  teethLineDelivered?: Record<string, number> | null | undefined;
  deliveredQuantity?: string | null | undefined;
  triggerClassName?: string;
  triggerSize?: "sm" | "md";
  triggerVariant?: "ghost" | "outline";
}) {
  const [open, setOpen] = useState(false);

  const summaries = useMemo(
    () => buildTeethLineSummaries(teethDetails, teethLineDelivered, deliveredQuantity),
    [teethDetails, teethLineDelivered, deliveredQuantity],
  );

  if (summaries.length === 0) return null;

  const totalOrdered = summaries.reduce((sum, s) => sum + s.ordered, 0);
  const totalDelivered = summaries.reduce((sum, s) => sum + s.delivered, 0);
  const totalRemaining = Math.max(0, totalOrdered - totalDelivered);

  return (
    <>
      <Button
        type="button"
        size={triggerSize}
        variant={triggerVariant}
        onClick={() => setOpen(true)}
        className={cn("gap-1.5", triggerClassName)}
      >
        <IconTooth size={14} strokeWidth={1.75} />
        Szczegóły zębów
      </Button>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title="Szczegóły zamówienia zębów"
        description="Porównaj co zamówiono z tym, co dotarło na magazyn."
        size="lg"
        tier="standard"
        footer={
          <div className="flex w-full justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Zamknij
            </Button>
          </div>
        }
      >
        <div className="space-y-2 px-3 py-3 sm:px-4">
          {/* Detail table */}
          <section className={mojeShipmentLinesShellClass}>
            <div className={mojeShipmentSectionHeaderClass}>
              <h4 className={mojeShipmentSectionHeaderTitleClass}>Pozycje</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-slate-500">
                      Specyfikacja
                    </th>
                    <th className="px-3 py-1.5 text-center text-[11px] font-semibold text-slate-500">
                      Zam.
                    </th>
                    <th className="px-3 py-1.5 text-center text-[11px] font-semibold text-slate-500">
                      Przyj.
                    </th>
                    <th className="px-3 py-1.5 text-center text-[11px] font-semibold text-slate-500">
                      Brak
                    </th>
                    <th className="px-3 py-1.5 text-center text-[11px] font-semibold text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr
                      key={s.groupKey}
                      className={mojeShipmentLineRowClass}
                    >
                      <td className="px-3 py-2 font-medium text-slate-800 text-xs">
                        {formatTeethGroupLabel(s.group, { includeCount: false })}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums font-semibold text-slate-600 text-xs">
                        {s.ordered}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums font-semibold text-emerald-700 text-xs">
                        {s.delivered > 0 ? s.delivered : "-"}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums font-semibold text-amber-700 text-xs">
                        {s.remaining > 0 ? s.remaining : "-"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <DeliveryBadge delivered={s.delivered} ordered={s.ordered} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold">
                    <td className="px-3 py-2 text-slate-600">Razem</td>
                    <td className="px-3 py-2 text-center tabular-nums text-slate-700">{totalOrdered}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-emerald-700">{totalDelivered}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-amber-700">{totalRemaining}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {totalRemaining > 0 ? (
            <p className="text-xs leading-relaxed text-slate-500">
              Brakuje jeszcze {totalRemaining} {totalRemaining === 1 ? "sztuki" : "szt."} - reszta czeka u dostawcy.
              Magazynier przyjmie je w kolejnej dostawie, a status zaktualizuje się automatycznie.
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-emerald-700">
              Całość zamówienia jest przyjęta na magazyn. Potwierdź odbiór osobisty, aby pozycja zniknęła z listy.
            </p>
          )}
        </div>
      </ModalShell>
    </>
  );
}
