"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import {
  controlFocusClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import type { ForSomeoneLine } from "@/lib/orders/summary-workspace";
import {
  processLinesConfirmLabel,
  processLinesModalTitle,
  processLinesScheduleAlert,
  processLinesSubtitle,
  type ProcurementProcessAction,
} from "@/lib/orders/procurement-process-lines";
import { PROCUREMENT_PROCESS_LINES_COPY } from "@/lib/orders/procurement-process-lines-copy";

function linePrimaryLabel(line: ForSomeoneLine): string {
  const sym = line.symbol?.trim() && line.symbol !== "-" ? line.symbol : null;
  const prod = line.products?.trim() || "Pozycja";
  return sym ? `${sym} — ${prod}` : prod;
}

export function ProcurementProcessLinesModal({
  open,
  action,
  lines,
  supplierName,
  personName,
  supplierOrderOnDemand = false,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  action: ProcurementProcessAction;
  lines: ForSomeoneLine[];
  supplierName: string;
  personName: string;
  supplierOrderOnDemand?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (orderIds: string[]) => void;
}) {
  if (!open || lines.length === 0) return null;

  const remountKey = `${action}:${lines.map((l) => l.id).join(",")}`;

  return (
    <ProcurementProcessLinesModalForm
      key={remountKey}
      action={action}
      lines={lines}
      supplierName={supplierName}
      personName={personName}
      supplierOrderOnDemand={supplierOrderOnDemand}
      pending={pending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function ProcurementProcessLinesModalForm({
  action,
  lines,
  supplierName,
  personName,
  supplierOrderOnDemand,
  pending,
  onCancel,
  onConfirm,
}: {
  action: ProcurementProcessAction;
  lines: ForSomeoneLine[];
  supplierName: string;
  personName: string;
  supplierOrderOnDemand: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (orderIds: string[]) => void;
}) {
  const allIds = useMemo(() => lines.map((l) => l.id), [lines]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(allIds)
  );

  const selectedCount = selectedIds.size;
  const totalCount = allIds.length;
  const scheduleAlert = processLinesScheduleAlert({
    action,
    supplierOrderOnDemand,
    selectedCount,
    totalCount,
  });
  const allSelected = selectedCount === totalCount && totalCount > 0;

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ModalShell
      open
      onClose={onCancel}
      title={processLinesModalTitle(action)}
      titleId="procurement-process-lines-title"
      size="sm"
      tier="raised"
      disableBackdropClose={pending}
      loadingMessage={pending ? PROCUREMENT_PROCESS_LINES_COPY.loading : null}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={onCancel}
            disabled={pending}
          >
            {PROCUREMENT_PROCESS_LINES_COPY.cancel}
          </Button>
          <Button
            className="min-h-11 w-full sm:w-auto"
            disabled={pending || selectedCount === 0}
            onClick={() => {
              const ids = allIds.filter((id) => selectedIds.has(id));
              if (!ids.length) return;
              onConfirm(ids);
            }}
          >
            {processLinesConfirmLabel(selectedCount, totalCount)}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className={cn(panelTypography.rowMeta, "font-medium text-slate-700")}>
            {processLinesSubtitle(supplierName, personName)}
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            {PROCUREMENT_PROCESS_LINES_COPY.modalHint}
          </p>
        </div>

        <fieldset className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <legend className="text-[11px] font-medium text-slate-600">
              {PROCUREMENT_PROCESS_LINES_COPY.selectLines}
            </legend>
            <span className="text-[11px] tabular-nums text-slate-500">
              {PROCUREMENT_PROCESS_LINES_COPY.selectedCount(
                selectedCount,
                totalCount
              )}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <button
              type="button"
              className={cn(
                "font-medium text-indigo-700 transition hover:text-indigo-950 hover:underline",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline"
              )}
              disabled={pending || allSelected}
              onClick={() => setSelectedIds(new Set(allIds))}
            >
              {PROCUREMENT_PROCESS_LINES_COPY.selectAll}
            </button>
            <button
              type="button"
              className={cn(
                "font-medium text-slate-600 transition hover:text-slate-900 hover:underline",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline"
              )}
              disabled={pending || selectedCount === 0}
              onClick={() => setSelectedIds(new Set())}
            >
              {PROCUREMENT_PROCESS_LINES_COPY.deselectAll}
            </button>
          </div>

          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200/80 bg-slate-50/40 p-2">
            {lines.map((line) => {
              const checked = selectedIds.has(line.id);
              const qty = line.quantity?.trim();
              return (
                <li key={line.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 text-xs text-slate-800",
                      "hover:bg-slate-50",
                      checked && "bg-white shadow-[inset_0_0_0_1px_rgba(199,210,254,0.7)]"
                    )}
                  >
                    <input
                      type="checkbox"
                      className={cn("mt-0.5 rounded border-slate-300", controlFocusClass)}
                      checked={checked}
                      disabled={pending}
                      onChange={() => toggleId(line.id)}
                    />
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 font-medium text-slate-900">
                          {linePrimaryLabel(line)}
                        </span>
                        {qty ? (
                          <span className="shrink-0 tabular-nums text-[11px] text-slate-500">
                            {PROCUREMENT_PROCESS_LINES_COPY.qtyPrefix} {qty}
                          </span>
                        ) : null}
                      </span>
                      {(line.informacjaViaPanel || line.informacjaStockOut) && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                          {line.informacjaViaPanel ? (
                            <span className="rounded bg-slate-100 px-1 py-0.5 font-semibold uppercase tracking-wide text-slate-500">
                              {PROCUREMENT_PROCESS_LINES_COPY.badgeInfo}
                            </span>
                          ) : null}
                          {line.informacjaStockOut ? (
                            <span className="rounded bg-amber-100 px-1 py-0.5 font-semibold uppercase tracking-wide text-amber-800">
                              {PROCUREMENT_PROCESS_LINES_COPY.badgeStockOut}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        {scheduleAlert ? (
          <p
            className={cn(
              "rounded-md border px-3 py-2.5 text-xs leading-relaxed",
              supplierOrderOnDemand
                ? "border-slate-200/90 bg-slate-50 text-slate-700"
                : "border-amber-200/80 bg-amber-50/90 text-amber-950"
            )}
            role="status"
          >
            {scheduleAlert}
          </p>
        ) : null}
      </div>
    </ModalShell>
  );
}
