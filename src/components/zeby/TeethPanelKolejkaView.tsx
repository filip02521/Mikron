"use client";



import { cn } from "@/lib/cn";

import { panelSubsectionInsetClass } from "@/lib/ui/ontime-theme";

import { teethPanelSupplierCardClass } from "@/lib/teeth/teeth-panel-ui";

import { plPozycja } from "@/lib/ui/polish-plurals";

import { Button } from "@/components/ui/Button";

import { TeethPanelEmpty } from "@/components/zeby/TeethPanelSection";

import { TeethQueueBatchTable } from "@/components/zeby/TeethQueueBatchTable";
import { TeethPanelScheduleBanner } from "@/components/zeby/TeethPanelScheduleBanner";
import { TeethCsvExportButton } from "@/components/zeby/TeethCsvExportButton";
import { TeethPanelStatsBar } from "@/components/zeby/TeethPanelStatsBar";
import { detectTeethDuplicates } from "@/lib/teeth/teeth-duplicate-detect";
import { useMemo } from "react";
import { IconAlertCircle } from "@/components/icons/StrokeIcons";

import {

  TeethPanelSupplierGroupHeader,

  TeethPanelSupplierQueueActions,

} from "@/components/zeby/TeethPanelSupplierGroupHeader";

import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";
import { distinctTeethProductLineLabelsForOrders } from "@/lib/teeth/teeth-panel-order-readiness";

import type { TeethQueueGroup, TeethQueueItem, TeethPositionSelection } from "@/lib/data/teeth-queue";

import { isScheduledItem } from "@/lib/data/teeth-queue";

import {

  IconClipboardList,

  IconTruck,

  IconCalendar,

} from "@/components/icons/StrokeIcons";

import {

  TEETH_MARK_ORDERED_LABEL,

  TEETH_MARK_ORDERED_TITLE,

} from "@/components/zeby/teeth-panel-copy";



export function TeethPanelKolejkaView({

  groups,

  readinessCtx,

  positionSelection,

  pending,

  selectedPositionCount,

  selectedOrderCount,

  onTogglePosition,

  onToggleSelectAllInGroup,

  onRequestMarkPositionsOrdered,

  onMarkScheduleOrdered,

  onSetDeliveryDate,

  onEditSaved,

}: {

  groups: TeethQueueGroup[];

  readinessCtx?: TeethPanelReadinessContext;

  positionSelection: Map<string, Set<number>>;

  pending: boolean;

  selectedPositionCount: number;

  selectedOrderCount: number;

  onTogglePosition: (orderId: string, position: number) => void;

  onToggleSelectAllInGroup: (group: TeethQueueGroup) => void;

  onRequestMarkPositionsOrdered: (
    selections: TeethPositionSelection[],
    supplierName?: string | null,
  ) => void;

  onMarkScheduleOrdered: (supplierId: string, supplierName: string) => void;

  onSetDeliveryDate: () => void;

  onEditSaved?: (message?: string) => void;

}) {

  const duplicates = useMemo(() => detectTeethDuplicates(groups), [groups]);
  const today = new Date().toISOString().slice(0, 10);
  const dueToday = groups.filter(
    (g) => g.dueSchedule?.computed_next_date && g.dueSchedule.computed_next_date <= today,
  );

  if (!groups.length || groups.every((g) => !g.items.length)) {

    return (

      <TeethPanelEmpty

        title="Brak pozycji spełniających filtry"

        description="Zmień filtry albo poczekaj na nowe prośby handlowców na zęby syntetyczne."

        icon={<IconClipboardList size={24} strokeWidth={1.75} />}

      />

    );

  }

  return (

    <>

      <TeethPanelStatsBar groups={groups} readinessCtx={readinessCtx} className="mb-3" />

      {dueToday.length > 0 ? (
        <div className="mb-3 rounded-md border border-sky-200/80 bg-sky-50/80 px-3 py-2 text-sm text-sky-800">
          <p className="font-semibold">Do zamówienia dzisiaj</p>
          <p className="mt-0.5 text-xs text-sky-700">
            {dueToday.map((g) => g.supplierName).join(", ")}
          </p>
        </div>
      ) : null}

      {duplicates.length > 0 ? (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-800">
            <IconAlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Możliwe duplikaty ({duplicates.length})</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {duplicates.slice(0, 5).map((d) => (
                  <li key={`${d.salesPersonName}-${d.color}-${d.mould}-${d.jaw}-${d.kind}`}>
                    {d.salesPersonName}: {d.color}
                    {d.mould ? ` ${d.mould}` : ""}
                    {d.jaw ? ` ${d.jaw === "upper" ? "Góra" : "Dół"}` : ""}
                    {d.kind ? ` ${d.kind === "anterior" ? "przednie" : "boczne"}` : ""}
                    {" — "}
                    {d.orderIds.length}×
                  </li>
                ))}
                {duplicates.length > 5 ? <li>… i {duplicates.length - 5} więcej</li> : null}
              </ul>
            </div>
          </div>
      ) : null}

      {selectedPositionCount > 0 ? (

        <div

          className={cn(

            "sticky top-0 z-10 flex flex-col gap-2 rounded-md border border-slate-200/90 bg-white/95 py-2.5 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between",

            panelSubsectionInsetClass,

          )}

        >

          <span className="text-sm font-medium text-slate-800">

            Zaznaczono {selectedPositionCount} {plPozycja(selectedPositionCount)}

            {selectedOrderCount > 0 ? ` z ${selectedOrderCount} ${selectedOrderCount === 1 ? "zamówienia" : "zamówień"}` : ""}

          </span>

          <div className="flex shrink-0 flex-wrap items-center gap-2">

            <Button

              size="sm"

              variant="ghost"

              onClick={onSetDeliveryDate}

              disabled={pending}

              className="min-h-9 text-slate-700 hover:bg-slate-100"

            >

              <IconCalendar size={16} strokeWidth={2} />

              Ustaw datę dostawy

            </Button>

            <Button

              size="sm"

              onClick={() => {

                const selections: TeethPositionSelection[] = [];

                for (const [orderId, positions] of positionSelection) {

                  if (positions.size > 0) {

                    selections.push({ orderId, positions: Array.from(positions) });

                  }

                }

                onRequestMarkPositionsOrdered(selections);

              }}

              disabled={pending}

              className="min-h-9"

              title={TEETH_MARK_ORDERED_TITLE}

            >

              <IconTruck size={16} strokeWidth={2} />

              {TEETH_MARK_ORDERED_LABEL}

            </Button>

          </div>

        </div>

      ) : null}



      {groups.map((group) => {

        const realItems = group.items.filter(

          (i): i is TeethQueueItem => !isScheduledItem(i),

        );

        const allSelected =

          realItems.length > 0 && realItems.every((item) => {
            const unordered = (item.teeth_details ?? []).filter((d) => !d.ordered_at);
            if (unordered.length === 0) return true;
            const sel = positionSelection.get(item.id);
            return sel && unordered.every((d) => sel.has(d.position));
          });

        const scheduleOnly = group.scheduledOnly || (realItems.length === 0 && Boolean(group.dueSchedule));

        const supplierId = group.supplierId ?? group.dueSchedule?.supplier_id ?? null;



        const handleMarkGroup = () => {

          if (realItems.length > 0) {

            const selections: TeethPositionSelection[] = [];
            for (const item of realItems) {
              const unordered = (item.teeth_details ?? [])
                .filter((d) => !d.ordered_at)
                .map((d) => d.position);
              if (unordered.length > 0) {
                selections.push({ orderId: item.id, positions: unordered });
              }
            }
            if (selections.length > 0) {
              onRequestMarkPositionsOrdered(selections, group.supplierName);
            }
            return;

          }

          if (supplierId) {

            onMarkScheduleOrdered(supplierId, group.supplierName);

          }

        };



        return (

          <div key={group.supplierId ?? "__no_supplier"} className={teethPanelSupplierCardClass}>

            <TeethPanelSupplierGroupHeader

              group={group}

              orderCount={realItems.length}

              productLineLabels={distinctTeethProductLineLabelsForOrders(realItems, readinessCtx)}

              actions={

                <div className="flex items-center gap-2">

                  {group.supplierId ? <TeethCsvExportButton supplierId={group.supplierId} /> : null}

                  <TeethPanelSupplierQueueActions

                    allSelected={allSelected}

                    pending={pending}

                    showSelectAll={realItems.length > 0}

                    canMark={realItems.length > 0 || scheduleOnly}

                    onToggleAll={() => onToggleSelectAllInGroup(group)}

                    onMark={handleMarkGroup}

                  />

                </div>

              }

            />

            {group.dueSchedule ? (
              <TeethPanelScheduleBanner
                schedule={group.dueSchedule}
                scheduleOnly={scheduleOnly}
              />
            ) : null}

            {realItems.length > 0 ? (
              <TeethQueueBatchTable
                items={realItems}
                positionSelection={positionSelection}
                onTogglePosition={onTogglePosition}
                onEditSaved={onEditSaved}
              />
            ) : null}
          </div>

        );

      })}

    </>

  );

}


