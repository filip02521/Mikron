"use client";

import type { IndividualOrder } from "@/types/database";
import { formatPlDate } from "@/lib/display-labels";
import { getDeliveryProgress } from "@/lib/orders/individual";
import {
  individualHistoryRowClass,
  individualHistoryStatusBadgeVariant,
  individualHistoryStatusLabel,
} from "@/lib/orders/history-ui";
import {
  canEditProcurementCancelNote,
  canOperationsCancelIndividualOrder,
  normalizeProcurementCancelNote,
} from "@/lib/orders/procurement-cancel-note";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconTrash2, IconPencil, IconX } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { procurementCancelNoteLabelClass } from "@/lib/ui/ontime-theme";

export function HistoriaIndividualTable({
  rows,
  canOperateOrders,
  canManageHistory,
  pending,
  onCancel,
  onEditNote,
  onRemove,
}: {
  rows: IndividualOrder[];
  canOperateOrders: boolean;
  canManageHistory: boolean;
  pending: boolean;
  onCancel?: (order: IndividualOrder) => void;
  onEditNote?: (order: IndividualOrder) => void;
  onRemove: (id: string) => void;
}) {
  const showActions = canOperateOrders || canManageHistory;

  return (
    <TableScroll>
      <DataTable>
        <thead>
          <tr>
            <th>Data</th>
            <th>Dostawca</th>
            <th>Dla kogo</th>
            <th>Produkt</th>
            <th>Ilość</th>
            <th>Dostawa</th>
            <th>Status</th>
            {showActions ? <th aria-label="Akcje" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const progress = getDeliveryProgress(
              o.quantity,
              o.delivered_quantity && o.delivered_quantity !== "-"
                ? o.delivered_quantity
                : "0"
            );
            const procurementNote = normalizeProcurementCancelNote(o.procurement_cancel_note);
            const canCancel = canOperateOrders && canOperationsCancelIndividualOrder(o);
            const canEditNote = canOperateOrders && canEditProcurementCancelNote(o);

            return (
              <tr key={o.id} className={cn(individualHistoryRowClass(o.status), "transition-colors hover:bg-slate-50/50")}>
                <td className="whitespace-nowrap text-slate-800 tabular-nums">
                  {formatPlDate(o.action_at?.slice(0, 10))}
                </td>
                <td className="font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-100/60"
                      aria-hidden
                    >
                      {(o.supplier?.name ?? "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{o.supplier?.name ?? "—"}</span>
                  </div>
                </td>
                <td className="text-slate-700">{o.sales_person?.name ?? "—"}</td>
                <td className="max-w-[280px]">
                  <span className="line-clamp-2 text-slate-800">{o.products}</span>
                  {o.symbol ? (
                    <span className="mt-0.5 block text-xs text-slate-500">{o.symbol}</span>
                  ) : null}
                  {procurementNote ? (
                    <p className="mt-1 text-xs leading-snug text-slate-700">
                      <span className={procurementCancelNoteLabelClass}>Od dostaw</span>{" "}
                      <span className="whitespace-pre-wrap font-medium text-slate-800">
                        {procurementNote}
                      </span>
                    </p>
                  ) : null}
                </td>
                <td className="tabular-nums text-slate-800">{o.quantity}</td>
                <td className="tabular-nums text-sm text-slate-700">
                  {progress.hasNumericQty
                    ? progress.fractionLabel
                    : o.delivered_quantity || "—"}
                </td>
                <td>
                  <Badge variant={individualHistoryStatusBadgeVariant(o.status)}>
                    {individualHistoryStatusLabel(o.status)}
                  </Badge>
                </td>
                {showActions ? (
                  <td>
                    <div className="flex flex-col items-end gap-1">
                      {canCancel ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          disabled={pending}
                          onClick={() => onCancel?.(o)}
                        >
                          <IconX size={13} className="shrink-0" />
                          Anuluj
                        </Button>
                      ) : null}
                      {canEditNote ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          disabled={pending}
                          onClick={() => onEditNote?.(o)}
                        >
                          <IconPencil size={13} className="shrink-0" />
                          Edytuj wiadomość
                        </Button>
                      ) : null}
                      {canManageHistory ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-rose-600 hover:text-rose-700"
                          disabled={pending}
                          onClick={() => onRemove(o.id)}
                        >
                          <IconTrash2 size={13} className="shrink-0" />
                          Usuń
                        </Button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </TableScroll>
  );
}
