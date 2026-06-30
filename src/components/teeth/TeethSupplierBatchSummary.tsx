"use client";



import { TeethGroupChips } from "@/components/teeth/TeethGroupChips";

import { Badge } from "@/components/ui/Badge";

import { cn } from "@/lib/cn";

import { panelSubsectionInsetClass, panelTypography } from "@/lib/ui/ontime-theme";

import { plPozycja } from "@/lib/ui/polish-plurals";

import type { TeethSupplierBatchSummary } from "@/lib/teeth/teeth-panel-aggregate";

import { teethPanelBatchStripClass, teethPanelIncompleteDetailClass, teethPanelIncompleteShellClass, teethPanelIncompleteTitleClass } from "@/lib/teeth/teeth-panel-ui";



/** Zbiorcza specyfikacja do zamówienia u dostawcy (wiersze poniżej = kto prosi, bez powtórzenia listy). */

export function TeethSupplierBatchSummary({

  batch,

  className,

}: {

  batch: TeethSupplierBatchSummary;

  className?: string;

}) {

  if (batch.orderCount < 2) return null;



  return (

    <div className={cn(teethPanelBatchStripClass, className)}>

      <div className={cn("space-y-2 py-2.5", panelSubsectionInsetClass)}>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">

          <span className={panelTypography.rowTitle}>

            Do zamówienia

            {batch.totalPieces > 0 ? (

              <span className="font-normal text-slate-600">

                {" "}

                · {batch.totalPieces} {plPozycja(batch.totalPieces)}

              </span>

            ) : null}

          </span>

          {batch.ordersMissingSpec > 0 ? (

            <Badge variant="warning" className="text-[10px]">

              {batch.ordersMissingSpec}{" "}

              {batch.ordersMissingSpec === 1 ? "do uzupełnienia" : "do uzupełnienia"}

            </Badge>

          ) : null}

        </div>



        {batch.mergedGroups.length > 0 ? (

          <TeethGroupChips groups={batch.mergedGroups} compact variant="panel" />

        ) : (

          <div className={cn(teethPanelIncompleteShellClass, "px-2.5 py-2")}>

            <p className={teethPanelIncompleteTitleClass}>Brak specyfikacji do scalenia</p>

            <p className={teethPanelIncompleteDetailClass}>

              Żadna z {batch.orderCount} prośb nie ma uzupełnionej listy zębów.

            </p>

          </div>

        )}

      </div>

    </div>

  );

}

