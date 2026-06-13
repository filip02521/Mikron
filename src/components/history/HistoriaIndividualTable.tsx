"use client";

import type { IndividualOrder } from "@/types/database";
import { formatPlDate } from "@/lib/display-labels";
import { getDeliveryProgress } from "@/lib/orders/individual";
import {
  individualHistoryRowClass,
  individualHistoryStatusBadgeVariant,
  individualHistoryStatusLabel,
} from "@/lib/orders/history-ui";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function HistoriaIndividualTable({
  rows,
  canManageHistory,
  pending,
  onRemove,
}: {
  rows: IndividualOrder[];
  canManageHistory: boolean;
  pending: boolean;
  onRemove: (id: string) => void;
}) {
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
            {canManageHistory ? <th aria-label="Akcje" /> : null}
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
            return (
              <tr key={o.id} className={cn(individualHistoryRowClass(o.status))}>
                <td className="whitespace-nowrap text-slate-800 tabular-nums">
                  {formatPlDate(o.action_at?.slice(0, 10))}
                </td>
                <td className="font-medium text-slate-900">
                  {o.supplier?.name ?? "—"}
                </td>
                <td className="text-slate-700">{o.sales_person?.name ?? "—"}</td>
                <td className="max-w-[280px]">
                  <span className="line-clamp-2 text-slate-800">{o.products}</span>
                  {o.symbol ? (
                    <span className="mt-0.5 block text-xs text-slate-500">{o.symbol}</span>
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
                {canManageHistory ? (
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => onRemove(o.id)}
                    >
                      Usuń
                    </Button>
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
