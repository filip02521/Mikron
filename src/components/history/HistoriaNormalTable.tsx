"use client";

import { formatPlDate } from "@/lib/display-labels";
import { normalHistoryActionPresentation } from "@/lib/orders/history-ui";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export type NormalHistoryRow = {
  id: string;
  action_at: string;
  user_email: string;
  suppliers?: { name: string };
  action: string;
  next_date: string | null;
};

export function HistoriaNormalTable({
  rows,
  canManageHistory,
  pending,
  onRemove,
}: {
  rows: NormalHistoryRow[];
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
            <th>Użytkownik</th>
            <th>Dostawca</th>
            <th>Akcja</th>
            <th>Następna data</th>
            {canManageHistory ? <th aria-label="Akcje" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const action = normalHistoryActionPresentation(h.action);
            return (
              <tr key={h.id}>
                <td className="whitespace-nowrap text-slate-800 tabular-nums">
                  {formatPlDate(h.action_at?.slice(0, 10))}
                </td>
                <td className="max-w-[200px] truncate text-slate-700">{h.user_email}</td>
                <td className="font-medium text-slate-900">{h.suppliers?.name ?? "—"}</td>
                <td className="max-w-[280px]">
                  {action.emphasize ? (
                    <Badge variant={action.badgeVariant}>{action.label}</Badge>
                  ) : (
                    <span className="text-slate-700">{action.label}</span>
                  )}
                </td>
                <td className="whitespace-nowrap tabular-nums text-slate-700">
                  {formatPlDate(h.next_date)}
                </td>
                {canManageHistory ? (
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => onRemove(h.id)}
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
