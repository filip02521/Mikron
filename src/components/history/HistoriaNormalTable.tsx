"use client";

import { formatPlDate } from "@/lib/display-labels";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
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
            {canManageHistory ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.id}>
              <td className="whitespace-nowrap text-slate-800 tabular-nums">
                {formatPlDate(h.action_at?.slice(0, 10))}
              </td>
              <td className="max-w-[200px] truncate">{h.user_email}</td>
              <td className="font-medium text-slate-900">{h.suppliers?.name ?? "—"}</td>
              <td>{h.action}</td>
              <td className="whitespace-nowrap tabular-nums">
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
          ))}
        </tbody>
      </DataTable>
    </TableScroll>
  );
}
