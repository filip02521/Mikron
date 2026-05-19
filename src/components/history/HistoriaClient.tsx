"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder } from "@/types/database";
import { formatPlDate } from "@/lib/display-labels";
import { getDeliveryProgress } from "@/lib/orders/individual";
import { matchesIndividualSearch } from "@/lib/orders/history-search";
import { SUMMARY_COLORS } from "@/types/database";
import {
  actionDeleteIndividualHistory,
  actionDeleteNormalHistory,
} from "@/app/actions/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";

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

type NormalHistoryRow = {
  id: string;
  action_at: string;
  user_email: string;
  suppliers?: { name: string };
  action: string;
  next_date: string | null;
};

export function HistoriaClient({
  individual,
  normal,
  canManageHistory = false,
}: {
  individual: IndividualOrder[];
  normal: NormalHistoryRow[];
  canManageHistory?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [productQuery, setProductQuery] = useState("");
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );

  const filteredIndividual = useMemo(
    () => individual.filter((o) => matchesIndividualSearch(o, productQuery)),
    [individual, productQuery]
  );

  const individualDescription =
    productQuery.trim() === ""
      ? `${individual.length} wpisów`
      : `${filteredIndividual.length} z ${individual.length} wpisów`;

  const removeIndividual = (id: string) => {
    if (!confirm("Usunąć ten wpis z historii indywidualnej?")) return;
    start(async () => {
      try {
        await actionDeleteIndividualHistory(id);
        setMsg({ text: "Wpis usunięty.", tone: "success" });
        router.refresh();
      } catch (e) {
        setMsg({
          text: e instanceof Error ? e.message : "Błąd usuwania",
          tone: "error",
        });
      }
    });
  };

  const removeNormal = (id: string) => {
    if (!confirm("Usunąć ten wpis z historii standardowej?")) return;
    start(async () => {
      try {
        await actionDeleteNormalHistory(id);
        setMsg({ text: "Wpis usunięty.", tone: "success" });
        router.refresh();
      } catch (e) {
        setMsg({
          text: e instanceof Error ? e.message : "Błąd usuwania",
          tone: "error",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      {msg ? (
        <Toast message={msg.text} tone={msg.tone} onDismiss={() => setMsg(null)} />
      ) : null}

      <Card padding={false}>
        <CardHeader
          inset
          title="Historia indywidualna"
          description={`${individualDescription} · bez pozycji informacyjnych`}
        />
        {individual.length > 0 ? (
          <div className="border-b border-slate-100 px-6 pb-4">
            <label className="block max-w-md">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Szukaj po towarze
              </span>
              <Input
                type="search"
                placeholder="Nazwa produktu, symbol…"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
        ) : null}

        {!individual.length ? (
          <EmptyState title="Brak wpisów w historii indywidualnej" />
        ) : !filteredIndividual.length ? (
          <EmptyState
            title="Brak wyników"
            description={`Nie znaleziono towaru pasującego do „${productQuery.trim()}”.`}
          />
        ) : (
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
                {filteredIndividual.map((o) => {
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
                        <Badge variant="info">
                          {STATUS_LABELS[o.status] ?? o.status}
                        </Badge>
                      </td>
                      {canManageHistory ? (
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => removeIndividual(o.id)}
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
        )}
      </Card>

      <Card padding={false}>
        <CardHeader
          inset
          title="Zamówienia standardowe"
          description={`${normal.length} ostatnich akcji`}
        />
        {!normal.length ? (
          <EmptyState title="Brak historii zamówień standardowych" />
        ) : (
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
                {normal.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap text-slate-800 tabular-nums">
                      {formatPlDate(h.action_at?.slice(0, 10))}
                    </td>
                    <td className="max-w-[200px] truncate">{h.user_email}</td>
                    <td className="font-medium text-slate-900">
                      {h.suppliers?.name ?? "—"}
                    </td>
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
                          onClick={() => removeNormal(h.id)}
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
        )}
      </Card>
    </div>
  );
}
