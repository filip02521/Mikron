"use client";



import { cn } from "@/lib/cn";

import { panelSubsectionInsetClass } from "@/lib/ui/ontime-theme";

import { teethPanelSupplierCardClass } from "@/lib/teeth/teeth-panel-ui";

import { plPozycja } from "@/lib/ui/polish-plurals";

import { Button } from "@/components/ui/Button";

import { TeethSupplierBatchSummary } from "@/components/teeth/TeethSupplierBatchSummary";

import { TeethPanelEmpty } from "@/components/zeby/TeethPanelSection";

import { TeethPanelOrderEntry } from "@/components/zeby/TeethPanelOrderEntry";

import {

  TeethPanelSupplierGroupHeader,

  TeethPanelSupplierQueueActions,

} from "@/components/zeby/TeethPanelSupplierGroupHeader";

import { buildTeethSupplierBatchSummary } from "@/lib/teeth/teeth-panel-aggregate";

import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";
import { distinctTeethProductLineLabelsForOrders } from "@/lib/teeth/teeth-panel-order-readiness";

import type { TeethQueueGroup, TeethQueueItem } from "@/lib/data/teeth-queue";

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

  selectedIds,

  pending,

  selectedCount,

  onToggleSelect,

  onToggleSelectAllInGroup,

  onRequestMarkOrdered,

  onMarkScheduleOrdered,

  onSetDeliveryDate,

  onEditSaved,

}: {

  groups: TeethQueueGroup[];

  readinessCtx?: TeethPanelReadinessContext;

  selectedIds: Set<string>;

  pending: boolean;

  selectedCount: number;

  onToggleSelect: (id: string) => void;

  onToggleSelectAllInGroup: (group: TeethQueueGroup) => void;

  onRequestMarkOrdered: (orderIds: string[], supplierName?: string | null) => void;

  onMarkScheduleOrdered: (supplierId: string, supplierName: string) => void;

  onSetDeliveryDate: () => void;

  onEditSaved?: (message?: string) => void;

}) {

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

      {selectedCount > 0 ? (

        <div

          className={cn(

            "sticky top-0 z-10 flex flex-col gap-2 rounded-md border border-slate-200/90 bg-white/95 py-2.5 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between",

            panelSubsectionInsetClass,

          )}

        >

          <span className="text-sm font-medium text-slate-800">

            Zaznaczono {selectedCount}{" "}

            {selectedCount === 1 ? "pozycję" : plPozycja(selectedCount)}

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

              onClick={() => onRequestMarkOrdered(Array.from(selectedIds))}

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

        const batchSummary =

          realItems.length >= 2 ? buildTeethSupplierBatchSummary(realItems, readinessCtx) : null;

        const groupOrderIds = realItems.map((item) => item.id);

        const allSelected =

          realItems.length > 0 && realItems.every((item) => selectedIds.has(item.id));

        const scheduleOnly = group.scheduledOnly || (realItems.length === 0 && Boolean(group.dueSchedule));

        const supplierId = group.supplierId ?? group.dueSchedule?.supplier_id ?? null;



        const handleMarkGroup = () => {

          if (realItems.length > 0) {

            onRequestMarkOrdered(groupOrderIds, group.supplierName);

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

                <TeethPanelSupplierQueueActions

                  allSelected={allSelected}

                  pending={pending}

                  showSelectAll={realItems.length > 0}

                  canMark={realItems.length > 0 || scheduleOnly}

                  onToggleAll={() => onToggleSelectAllInGroup(group)}

                  onMark={handleMarkGroup}

                />

              }

            />



            {batchSummary ? <TeethSupplierBatchSummary batch={batchSummary} /> : null}



            {batchSummary ? (

              <div

                className={cn(

                  "border-t border-slate-100 py-1.5",

                  panelSubsectionInsetClass,

                )}

              >

                <span className="text-xs text-slate-500">Prośby handlowców</span>

              </div>

            ) : null}



            {realItems.length > 0 ? (

              <div>

                {realItems.map((item) => (

                  <TeethPanelOrderEntry

                    key={item.id}

                    item={item}

                    variant="queue"

                    mergedBatch={Boolean(batchSummary)}

                    specIncludedInBatch={Boolean(batchSummary && batchSummary.mergedGroups.length > 0)}

                    supplierName={group.supplierName}

                    checked={selectedIds.has(item.id)}

                    onToggleSelect={() => onToggleSelect(item.id)}

                    onEditSaved={onEditSaved}

                  />

                ))}

              </div>

            ) : null}

          </div>

        );

      })}

    </>

  );

}


