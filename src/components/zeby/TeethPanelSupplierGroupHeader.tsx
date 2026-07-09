"use client";



import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { panelSubsectionInsetClass, panelTypography } from "@/lib/ui/ontime-theme";

import { teethPanelHeaderMetaClass, teethPanelSupplierHeaderClass } from "@/lib/teeth/teeth-panel-ui";

import { Button } from "@/components/ui/Button";

import { TeethPanelSupplierEta } from "@/components/zeby/TeethPanelSupplierEta";

import type { TeethQueueGroup } from "@/lib/data/teeth-queue";

import { plPozycja } from "@/lib/ui/polish-plurals";

import { IconTruck } from "@/components/icons/StrokeIcons";

import {

  TEETH_MARK_ORDERED_LABEL,

  TEETH_MARK_ORDERED_TITLE,

} from "@/components/zeby/teeth-panel-copy";

export function TeethPanelSupplierGroupHeader({

  group,

  orderCount,

  productLineLabels,

  /** Ukryj linie produktowe (np. historia — są na każdej karcie). */
  hideProductLines,

  actions,

}: {

  group: TeethQueueGroup;

  orderCount: number;

  productLineLabels?: string[];

  hideProductLines?: boolean;

  actions?: ReactNode;

}) {

  const hasSchedule = Boolean(group.dueSchedule?.computed_next_date);



  return (

    <div className={cn(teethPanelSupplierHeaderClass, panelSubsectionInsetClass)}>

      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">

        <span className={panelTypography.sectionTitle}>{group.supplierName}</span>

        {productLineLabels && productLineLabels.length > 0 && !hideProductLines ? (

          <span className={cn(teethPanelHeaderMetaClass, "font-medium text-slate-700")}>

            · {productLineLabels.join(" · ")}

          </span>

        ) : null}

        {orderCount > 0 ? (

          <span className={teethPanelHeaderMetaClass}>

            {orderCount} {plPozycja(orderCount)}

          </span>

        ) : null}

        {group.scheduledOnly ? (

          <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
            Harmonogram
          </span>

        ) : hasSchedule ? (

          <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600">
            Harmonogram
          </span>

        ) : null}

        <TeethPanelSupplierEta eta={group.deliveryEta} />

      </div>

      {actions ? (

        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>

      ) : null}

    </div>

  );

}



export function TeethPanelSupplierQueueActions({

  allSelected,

  pending,

  showSelectAll,

  canMark,

  onToggleAll,

  onMark,

}: {

  allSelected: boolean;

  pending: boolean;

  showSelectAll: boolean;

  canMark: boolean;

  onToggleAll: () => void;

  onMark: () => void;

}) {

  if (!canMark && !showSelectAll) return null;



  return (

    <>

      {showSelectAll ? (

        <button

          type="button"

          onClick={onToggleAll}

          className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-900"

        >

          {allSelected ? "Odznacz wszystkie" : "Zaznacz wszystkie"}

        </button>

      ) : null}

      {canMark ? (

        <Button

          type="button"

          size="sm"

          disabled={pending}

          className="min-h-8 text-xs"

          title={TEETH_MARK_ORDERED_TITLE}

          onClick={onMark}

        >

          <IconTruck size={14} strokeWidth={2} />

          {TEETH_MARK_ORDERED_LABEL}

        </Button>

      ) : null}

    </>

  );

}


