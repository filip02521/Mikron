"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { polishPlural } from "@/lib/email/polish-plural";
import { formatPlDate } from "@/lib/display-labels";
import {
  summarizeServiceParts,
  type ServicePartRow,
} from "@/lib/orders/service-parts-overview";

type Filter = "all" | "to_request" | "missing" | "requested";

const STATUS_LABEL: Record<string, string> = {
  Nowe: "nowa",
  Weryfikacja: "w weryfikacji",
  Zamowione: "zamówione",
};

function matches(row: ServicePartRow, filter: Filter, q: string): boolean {
  if (filter === "to_request" && (row.state === "ok" || row.requests.length > 0)) return false;
  if (filter === "missing" && row.state !== "brak") return false;
  if (filter === "requested" && row.requests.length === 0) return false;
  if (!q) return true;
  const hay = `${row.symbol ?? ""} ${row.name} ${row.groupName ?? ""}`.toLocaleLowerCase("pl-PL");
  return q
    .toLocaleLowerCase("pl-PL")
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function StockBadge({ row }: { row: ServicePartRow }) {
  if (row.state === "brak") return <Badge variant="danger">brak</Badge>;
  if (row.state === "ponizej_min") return <Badge variant="warning">poniżej minimum</Badge>;
  return null;
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pl-PL", { maximumFractionDigits: 3 });
}

export function ServicePartsPanel({
  rows,
  cechaName,
  readAt,
  prosbaHref,
}: {
  rows: ServicePartRow[];
  cechaName: string;
  readAt: string;
  prosbaHref: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const summary = useMemo(() => summarizeServiceParts(rows), [rows]);
  const visible = useMemo(
    () => rows.filter((r) => matches(r, filter, query.trim())),
    [rows, filter, query]
  );

  const statusTitle =
    summary.toRequest > 0
      ? `${polishPlural(summary.toRequest, "część czeka", "części czekają", "części czeka")} na zgłoszenie`
      : "Wszystkie braki są zgłoszone";
  const statusText = `${polishPlural(summary.missing, "część", "części", "części")} bez stanu, ${polishPlural(summary.requested, "zgłoszona", "zgłoszone", "zgłoszonych")}. Zakupy zamawiają części serwisowe tylko po prośbie.`;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="font-display text-lg font-bold tracking-tight text-slate-900">{statusTitle}</p>
            <p className="text-sm text-slate-600">{statusText}</p>
          </div>
          {summary.toRequest > 0 ? (
            <Button type="button" onClick={() => setFilter("to_request")}>
              {`Pokaż ${polishPlural(summary.toRequest, "część", "części", "części")}`}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card padding={false}>
        <CardHeader
          title={`Cecha „${cechaName}”`}
          description={`Stany z Subiekta, odczyt ${formatPlDate(readAt)} ${new Date(readAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}. Stan dostępny = stan − rezerwacje.`}
          inset
          action={
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl<Filter>
                ariaLabel="Filtr części"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `Wszystkie ${summary.total}` },
                  { value: "to_request", label: `Do zgłoszenia ${summary.toRequest}` },
                  { value: "missing", label: `Brak ${summary.missing}` },
                  { value: "requested", label: `Zgłoszone ${summary.requested}` },
                ]}
              />
              <input
                id="service-parts-search"
                type="search"
                aria-label="Szukaj części"
                placeholder="Szukaj: symbol, nazwa"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 w-full max-w-xs rounded-md border border-line bg-card px-3 text-base shadow-control sm:h-10 sm:text-sm"
              />
              <span className="text-[11px] text-slate-500">
                {polishPlural(visible.length, "część", "części", "części")}
              </span>
            </div>
          }
        />
        {visible.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Brak części w tym widoku"
              description="Zmień filtr albo wyczyść szukanie."
            />
          </div>
        ) : (
          <TableScroll>
            <DataTable>
              <thead>
                <tr>
                  <th>Część</th>
                  <th>Grupa</th>
                  <th className="text-right">Dostępne</th>
                  <th className="text-right">Rezerwacje</th>
                  <th className="text-right">Minimum</th>
                  <th>Zgłoszenie</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.twId}>
                    <td className="min-w-[16rem]">
                      <div className="font-semibold text-slate-900">{r.name}</div>
                      {r.symbol ? <div className="text-xs text-slate-500">{r.symbol}</div> : null}
                    </td>
                    <td className="text-slate-500">{r.groupName ?? "-"}</td>
                    <td className="text-right tabular-nums">
                      <span className="inline-flex items-center justify-end gap-2">
                        <StockBadge row={r} />
                        <span className="font-semibold text-slate-900">{formatQty(r.available)}</span>
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{r.reserved ? formatQty(r.reserved) : "-"}</td>
                    <td className="text-right tabular-nums">{r.minStock ?? "-"}</td>
                    <td>
                      {r.requests.length > 0 ? (
                        <span className="flex flex-col gap-1">
                          {r.requests.map((req, i) => (
                            <Badge key={`${req.createdAt}-${i}`} variant="info">
                              {`${req.quantity} szt. · ${STATUS_LABEL[req.status] ?? req.status} · ${formatPlDate(req.createdAt)}`}
                            </Badge>
                          ))}
                        </span>
                      ) : r.state !== "ok" && prosbaHref ? (
                        <Link
                          href={prosbaHref}
                          className="text-sm font-medium text-indigo-700 underline-offset-2 hover:underline"
                        >
                          Zgłoś brak
                        </Link>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
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
