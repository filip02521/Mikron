"use client";

import type { IndividualOrder } from "@/types/database";
import { formatPlDate } from "@/lib/display-labels";
import { getDeliveryProgress } from "@/lib/orders/individual";
import { SUMMARY_COLORS } from "@/types/database";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const STATUS_COLORS: Record<string, string> = {
  Nowe: SUMMARY_COLORS.historyNew,
  Zamowione: SUMMARY_COLORS.historyPending,
  Czesciowo_zrealizowane: SUMMARY_COLORS.historyPartial,
  Zrealizowane: SUMMARY_COLORS.historyCompleted,
  Anulowane: SUMMARY_COLORS.historyCancelled,
};

const STATUS_LABELS: Record<string, string> = {
  Nowe: "Nowe",
  Zamowione: "Zamówione",
  Czesciowo_zrealizowane: "Częściowo",
  Zrealizowane: "Zrealizowane",
  Anulowane: "Anulowane",
};

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
            {canManageHistory ? <th /> : null}
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
              <tr
                key={o.id}
                style={{
                  backgroundColor: STATUS_COLORS[o.status] ?? "#fff",
                }}
              >
                <td className="whitespace-nowrap text-slate-800 tabular-nums">
                  {formatPlDate(o.action_at?.slice(0, 10))}
                </td>
                <td className="font-medium text-slate-900">
                  {o.supplier?.name ?? "—"}
                </td>
                <td>{o.sales_person?.name ?? "—"}</td>
                <td className="max-w-[280px]">
                  <span className="line-clamp-2">{o.products}</span>
                </td>
                <td className="tabular-nums">{o.quantity}</td>
                <td className="tabular-nums text-sm">
                  {progress.hasNumericQty
                    ? progress.fractionLabel
                    : o.delivered_quantity || "—"}
                </td>
                <td>
                  <Badge variant="info">{STATUS_LABELS[o.status] ?? o.status}</Badge>
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
