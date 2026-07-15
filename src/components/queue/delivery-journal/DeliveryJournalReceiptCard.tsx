"use client";

import type { ReactNode } from "react";
import type { WarehouseDeliveryReceipt } from "@/lib/warehouse/delivery-receipts";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import {
  formatShipmentQuantitySuffix,
  warehouseCarrierLabel,
  warehouseShipmentFormLabel,
} from "@/lib/warehouse/delivery-carriers";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { IconClipboardList } from "@/components/icons/StrokeIcons";

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

function HighlightedNote({ note, query }: { note: string; query?: string }) {
  const q = query?.trim().toLowerCase();
  if (!q || !note.toLowerCase().includes(q)) {
    return <span>{note}</span>;
  }
  const idx = note.toLowerCase().indexOf(q);
  return (
    <>
      {note.slice(0, idx)}
      <mark className="rounded bg-emerald-100 px-0.5 font-medium text-emerald-950 ring-1 ring-emerald-200/80">
        {note.slice(idx, idx + q.length)}
      </mark>
      {note.slice(idx + q.length)}
    </>
  );
}

export function DeliveryJournalReceiptCard({
  receipt,
  highlightQuery,
  showDate = false,
  actions,
  carrierCatalog,
  pendingCount,
}: {
  receipt: WarehouseDeliveryReceipt;
  highlightQuery?: string;
  showDate?: boolean;
  actions?: ReactNode;
  carrierCatalog?: WarehouseCarrierRow[];
  pendingCount?: number;
}) {
  const note = receipt.note.trim();
  const quantitySuffix = formatShipmentQuantitySuffix(
    receipt.shipmentForm,
    receipt.packageCount,
    receipt.palletCount
  );
  const hasPending = pendingCount != null && pendingCount > 0;

  const goToReceiveQueue = () => {
    const params = new URLSearchParams();
    if (receipt.supplierName && receipt.supplierName !== "—") {
      params.set("supplier", receipt.supplierName);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    window.location.href = `/kolejka${query}#kolejka-przyjecie`;
  };

  return (
    <li className="rounded-md border border-slate-200/90 bg-white px-4 py-3 shadow-sm shadow-slate-900/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showDate ? (
            <p className={panelTypography.caption}>{formatDateLabel(receipt.receivedDate)}</p>
          ) : null}
          <div className={cn("flex items-center gap-2", showDate && "mt-0.5")}>
            <p className={cn(panelTypography.rowTitle, "min-w-0 truncate")}>
              {receipt.supplierName}
            </p>
            {hasPending ? (
              <button
                type="button"
                onClick={goToReceiveQueue}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200/80 transition hover:bg-amber-100 hover:text-amber-900"
                title={`${pendingCount} oczekujących próśb — przejdź do przyjęcia`}
              >
                <IconClipboardList size={11} className="shrink-0" aria-hidden />
                {pendingCount} oczekuje
              </button>
            ) : null}
          </div>
          <p className={cn(panelTypography.rowMeta, "mt-1")}>
            <span className="font-medium text-slate-700">
              {warehouseCarrierLabel(receipt.carrier, carrierCatalog)}
            </span>
            <span aria-hidden className="text-slate-300">
              {" "}
              ·{" "}
            </span>
            {warehouseShipmentFormLabel(receipt.shipmentForm)}
            {quantitySuffix ? (
              <span className="tabular-nums text-slate-600">{quantitySuffix}</span>
            ) : null}
          </p>
          {note ? (
            <p className={cn(panelTypography.caption, "mt-1.5")}>
              <span className="text-slate-400">List / uwagi: </span>
              <HighlightedNote note={note} query={highlightQuery} />
            </p>
          ) : null}
          {hasPending ? (
            <button
              type="button"
              onClick={goToReceiveQueue}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 transition hover:text-sky-800 hover:underline"
            >
              Przejdź do przyjęcia →
            </button>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </li>);
}
