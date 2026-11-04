"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { IconSearch } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { polishPlural } from "@/lib/email/polish-plural";
import { formatPlDate } from "@/lib/display-labels";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ServicePartReportDialog } from "@/components/serwis/ServicePartReportDialog";
import {
  summarizeServiceParts,
  type ServicePartRequest,
  type ServicePartRow,
} from "@/lib/orders/service-parts-overview";

type Filter = "all" | "to_request" | "missing" | "below_min" | "requested";

const STATUS_LABEL: Record<string, string> = {
  Nowe: "nowa prośba",
  Weryfikacja: "w weryfikacji",
  Zamowione: "zamówione",
};

function matchesFilter(row: ServicePartRow, filter: Filter): boolean {
  switch (filter) {
    case "to_request":
      return row.state !== "ok" && row.requests.length === 0;
    case "missing":
      return row.state === "brak";
    case "below_min":
      return row.state === "ponizej_min";
    case "requested":
      return row.requests.length > 0;
    default:
      return true;
  }
}

function matchesQuery(row: ServicePartRow, q: string): boolean {
  if (!q) return true;
  const hay = `${row.symbol ?? ""} ${row.name} ${row.groupName ?? ""}`.toLocaleLowerCase("pl-PL");
  return q
    .toLocaleLowerCase("pl-PL")
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Bliskie daty względnie (DESIGN.md → Teksty). */
function formatNearDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (dayKey(d) === dayKey(today)) return "dziś";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(yesterday)) return "wczoraj";
  return formatPlDate(iso);
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pl-PL", { maximumFractionDigits: 3 });
}

/**
 * Pasek stanu: wypełnienie = dostępne, kreska = minimum z Kreatora.
 * Skala sięga 1,5× minimum, żeby „tuż nad minimum” nie wyglądało jak pełny magazyn.
 */
function StockMeter({ row }: { row: ServicePartRow }) {
  const min = row.minStock && row.minStock > 0 ? row.minStock : null;
  const scale = Math.max(min ? min * 1.5 : 0, row.available, 1);
  const fill = Math.max(0, Math.min(1, row.available / scale));
  const tone =
    row.state === "brak" ? "bg-red-500" : row.state === "ponizej_min" ? "bg-amber-500" : "bg-slate-400";
  return (
    <div className="flex min-w-[9rem] items-center gap-3">
      <div className="relative h-1.5 flex-1 rounded-full bg-slate-100" aria-hidden>
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${fill * 100}%` }} />
        {min ? (
          <div
            className="absolute -top-0.5 -bottom-0.5 w-px bg-slate-500"
            style={{ left: `${(min / scale) * 100}%` }}
          />
        ) : null}
      </div>
      <span
        className={cn(
          "w-8 text-right text-sm font-semibold tabular-nums",
          row.state === "brak" ? "text-red-700" : row.state === "ponizej_min" ? "text-amber-800" : "text-slate-900"
        )}
      >
        {formatQty(row.available)}
      </span>
    </div>
  );
}

function stockCaption(row: ServicePartRow): string {
  const parts: string[] = [];
  if (row.state === "brak") parts.push("brak na stanie");
  else if (row.state === "ponizej_min") parts.push("poniżej minimum");
  if (row.minStock) parts.push(`min. ${row.minStock}`);
  if (row.reserved) parts.push(`rez. ${formatQty(row.reserved)}`);
  if (row.takenWithoutRw) parts.push(`${formatQty(row.takenWithoutRw)} pobrane bez RW`);
  return parts.join(" · ");
}

function RequestPill({ req }: { req: ServicePartRequest }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium tabular-nums text-indigo-900">
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" aria-hidden />
      {`${req.quantity} szt. · ${STATUS_LABEL[req.status] ?? req.status} · ${formatNearDay(req.createdAt)}`}
    </span>
  );
}

type Tile = { id: Exclude<Filter, "all">; label: string; count: number; hint: string; tone: string };

/** Kafle z licznikiem (DESIGN.md → Navigation): liczba to pierwsze, co serwis chce wiedzieć. */
function FilterTiles({
  tiles,
  filter,
  onChange,
}: {
  tiles: Tile[];
  filter: Filter;
  onChange: (f: Filter) => void;
}) {
  return (
    <div role="group" aria-label="Filtr części" className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {tiles.map((t) => {
        const active = filter === t.id;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? "all" : t.id)}
            className={cn(
              "flex min-w-0 flex-col items-start rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm transition-colors duration-150 sm:px-4 sm:py-3",
              controlFocusClass,
              active
                ? "border-indigo-600 ring-1 ring-inset ring-indigo-600"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", t.tone)} aria-hidden />
              <span className="text-2xl font-semibold leading-none tabular-nums text-slate-900 sm:text-[1.75rem]">
                {t.count}
              </span>
            </span>
            <span className={cn("mt-1.5 text-sm font-semibold", active ? "text-indigo-800" : "text-slate-800")}>
              {t.label}
            </span>
            <span className="mt-0.5 hidden w-full truncate text-[0.8125rem] text-slate-500 sm:block">{t.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ServicePartsPanel({
  rows,
  cechaName,
  readAt,
  canReport,
}: {
  rows: ServicePartRow[];
  cechaName: string;
  readAt: string;
  canReport: boolean;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [reportPart, setReportPart] = useState<ServicePartRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const summary = useMemo(() => summarizeServiceParts(rows), [rows]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable=true]");
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(() => {
    const q = query.trim();
    const map = new Map<string, ServicePartRow[]>();
    for (const r of rows) {
      if (!matchesFilter(r, filter) || !matchesQuery(r, q)) continue;
      const key = r.groupName ?? "Bez grupy";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pl"));
  }, [rows, filter, query]);
  const visibleCount = groups.reduce((n, [, list]) => n + list.length, 0);

  const tiles: Tile[] = [
    {
      id: "to_request",
      label: "Do zgłoszenia",
      count: summary.toRequest,
      hint: "Brak albo poniżej minimum, bez prośby",
      tone: summary.toRequest > 0 ? "bg-amber-500" : "bg-slate-300",
    },
    {
      id: "missing",
      label: "Brak na stanie",
      count: summary.missing,
      hint: "0 po rezerwacjach i pobraniach",
      tone: summary.missing > 0 ? "bg-red-500" : "bg-slate-300",
    },
    {
      id: "below_min",
      label: "Poniżej minimum",
      count: summary.belowMin,
      hint: "Minimum z Kreatora ZD",
      tone: summary.belowMin > 0 ? "bg-amber-500" : "bg-slate-300",
    },
    {
      id: "requested",
      label: "Zgłoszone",
      count: summary.requested,
      hint: "Prośba czeka na ZD lub dostawę",
      tone: "bg-indigo-600",
    },
  ];

  const readTime = new Date(readAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-5">
      <FilterTiles tiles={tiles} filter={filter} onChange={setFilter} />

      <Card padding={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Szukaj części</span>
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={searchRef}
              id="service-parts-search"
              type="search"
              placeholder="Szukaj: symbol, nazwa, grupa"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-card pl-9 pr-10 text-base shadow-[var(--shadow-control)] transition-colors duration-150 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:h-10 sm:text-sm"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:block">
              <Kbd>/</Kbd>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-slate-500 sm:ml-auto">
            <span className="tabular-nums">
              {filter === "all" && !query.trim()
                ? polishPlural(visibleCount, "część", "części", "części")
                : `${visibleCount} z ${summary.total}`}
            </span>
            <span aria-hidden>·</span>
            <span>{`Subiekt, ${formatNearDay(readAt)} ${readTime}`}</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={refreshing}
              onClick={() => startRefresh(() => router.refresh())}
            >
              {refreshing ? "Odświeżam…" : "Odśwież"}
            </Button>
          </div>
        </div>

        {visibleCount === 0 ? (
          <div className="p-6">
            <EmptyState
              title={filter === "to_request" ? "Wszystkie braki są zgłoszone" : "Brak części w tym widoku"}
              description={
                filter === "to_request"
                  ? `Każda część z cechą „${cechaName}” bez stanu ma już prośbę.`
                  : "Zmień filtr albo wyczyść szukanie."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[0.8125rem] text-slate-500">
                  <th className="px-5 py-2.5 font-medium sm:px-6">Część</th>
                  <th className="px-4 py-2.5 font-medium">Dostępne</th>
                  <th className="px-4 py-2.5 font-medium">Zgłoszenie</th>
                  <th className="w-px px-5 py-2.5 max-sm:hidden sm:px-6">
                    <span className="sr-only">Akcje</span>
                  </th>
                </tr>
              </thead>
              {groups.map(([group, list]) => {
                const attention = list.filter((r) => r.state !== "ok").length;
                return (
                  <tbody key={group} className="border-t border-slate-200">
                    <tr>
                      <th
                        colSpan={4}
                        scope="rowgroup"
                        className="px-5 pb-1.5 pt-4 text-left text-[0.8125rem] font-semibold text-slate-600 sm:px-6"
                      >
                        {group}
                        <span className="ml-2 font-medium text-slate-500">
                          {polishPlural(list.length, "część", "części", "części")}
                          {attention > 0 ? ` · ${attention} do uwagi` : ""}
                        </span>
                      </th>
                    </tr>
                    {list.map((r) => {
                      const report =
                        r.state !== "ok" && r.requests.length === 0 && canReport ? (
                          <Button variant="secondary" size="sm" onClick={() => setReportPart(r)}>
                            Zgłoś brak
                          </Button>
                        ) : null;
                      return (
                      <tr
                        key={r.twId}
                        className="border-t border-slate-100 transition-colors duration-150 hover:bg-slate-50"
                      >
                        <td className="px-5 py-3 max-sm:max-w-[16rem] sm:px-6">
                          <div className="font-semibold text-slate-900">{r.name}</div>
                          <div className="mt-0.5 font-mono text-xs text-slate-500">{r.symbol ?? "-"}</div>
                          {/* Na telefonie pod nazwą — kolumna akcji jest poza ekranem, tabela przewija się w bok. */}
                          {report ? <div className="mt-2 sm:hidden">{report}</div> : null}
                        </td>
                        <td className="px-4 py-3">
                          <StockMeter row={r} />
                          {stockCaption(r) ? (
                            <div className="mt-1 text-xs text-slate-500">{stockCaption(r)}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {r.requests.length > 0 ? (
                            <div className="flex flex-col items-start gap-1">
                              {r.requests.map((req, i) => (
                                <RequestPill key={`${req.createdAt}-${i}`} req={req} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right max-sm:hidden sm:px-6">{report}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
      </Card>

      <ServicePartReportDialog
        key={reportPart?.twId ?? "none"}
        part={reportPart}
        onClose={() => setReportPart(null)}
        onReported={(message) => {
          setReportPart(null);
          setToast(message);
          startRefresh(() => router.refresh());
        }}
      />
      {toast ? <NoticeToast notice={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
