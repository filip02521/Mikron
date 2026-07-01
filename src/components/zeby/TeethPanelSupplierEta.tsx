"use client";



import { formatPlDate } from "@/lib/display-labels";

import type { TeethSupplierDeliveryEta } from "@/lib/data/teeth-queue";

import { teethPanelHeaderMetaClass } from "@/lib/teeth/teeth-panel-ui";



export function TeethPanelSupplierEta({

  eta,

}: {

  eta: TeethSupplierDeliveryEta | null | undefined;

}) {

  if (!eta) return null;



  return (

    <span className={teethPanelHeaderMetaClass}>

      · dostawa ~{formatPlDate(eta.expectedDate)}

      {eta.lowConfidence ? " (mała próbka)" : null}

    </span>

  );

}

