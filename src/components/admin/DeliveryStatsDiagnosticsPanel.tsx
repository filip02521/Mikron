"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { ToastNotice } from "@/lib/ui/notice-copy";
import { adminPanelNotice } from "@/lib/ui/notice-copy";
import {
  actionFetchDeliveryStatsDiagnostics,
  actionRecalculateStats,
} from "@/app/actions/admin";
import { AdminActionButton } from "@/components/admin/AdminActionButton";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { AdminMetrics } from "@/components/admin/AdminMetrics";
import { Alert } from "@/components/ui/Alert";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { Spinner } from "@/components/ui/Spinner";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { cn } from "@/lib/cn";
import {
  deliveryStatsHealthLabel,
  formatStatsModeLabel,
  type DeliveryStatsDiagnostics,
  type DeliveryStatsHealth,
  type DeliveryStatsSupplierDiagnostic,
} from "@/lib/orders/delivery-stats-diagnostics";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import { matchesSearchWords } from "@/lib/search/keywords";

type HealthFilter = "all" | DeliveryStatsHealth | "issues";

function formatTimestamp(iso: string | null): string {
  if (!iso) return "-";
  return formatWarsawDateTime(iso);
}

function healthBadgeVariant(
  health: DeliveryStatsHealth
): "success" | "warning" | "danger" | "default" {
  switch (health) {
    case "ok":
      return "success";
    case "low_samples":
      return "warning";
    case "no_data":
      return "default";
    default:
      return "danger";
  }
}

function avgCell(avg: number | null, count: number | null): string {
  if (!count) return "-";
  return `${avg ?? "?"} d · n=${count}`;
}

function ComparisonRow({
  label,
  stored,
  recomputed,
}: {
  label: string;
  stored: string;
  recomputed: string;
  mismatch?: boolean;
}) {
  const mismatch = stored !== recomputed && stored !== "-" && recomputed !== "-";
  return (
    <tr className={cn(mismatch && "bg-red-50/60")}>
      <td className="px-2 py-1.5 text-xs font-medium text-slate-600">{label}</td>
      <td className="px-2 py-1.5 text-xs tabular-nums text-slate-800">{stored}</td>
      <td className="px-2 py-1.5 text-xs tabular-nums text-slate-800">{recomputed}</td>
    </tr>
  );
}

function SupplierDetailPanel({ row }: { row: DeliveryStatsSupplierDiagnostic }) {
  const [showAllSamples, setShowAllSamples] = useState(false);
  const visibleSamples = showAllSamples ? row.samples : row.samples.slice(0, 8);

  const storedMain = avgCell(row.stored?.main_avg ?? null, row.stored?.main_count ?? null);
  const storedSide = avgCell(row.stored?.side_avg ?? null, row.stored?.side_count ?? null);
  const recomputedMain = avgCell(row.recomputed.main_avg, row.recomputed.main_count);
  const recomputedSide = avgCell(row.recomputed.side_avg, row.recomputed.side_count);

  return (
    <div className="space-y-4 border-t border-slate-100 bg-slate-50 px-3 py-4 sm:px-4 lg:px-5">
      <div>
        <p className="text-xs font-semibold text-slate-800">Diagnoza</p>
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs leading-relaxed text-slate-700">
          {row.healthNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="mt-2 text-[0.6875rem] text-slate-500">
          Historia: {row.historyOrderCount} zrealizowanych w pełni · {row.unusedOrderCount}{" "}
          pominiętych (duplikaty dnia, brak daty, typ None itd.)
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500">
              <th className="px-2 py-2 font-medium">Pole</th>
              <th className="px-2 py-2 font-medium">W bazie (delivery_stats)</th>
              <th className="px-2 py-2 font-medium">Z historii (przeliczone)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <ComparisonRow label="Główne" stored={storedMain} recomputed={recomputedMain} />
            <ComparisonRow label="Poboczne" stored={storedSide} recomputed={recomputedSide} />
            <ComparisonRow
              label="Ostatnia aktualizacja"
              stored={formatTimestamp(row.storedUpdatedAt)}
              recomputed="-"
            />
          </tbody>
        </table>
      </div>

      {row.samples.length ? (
        <div className="overflow-x-auto">
          <div className="flex items-center justify-between gap-2 py-1">
            <p className="text-xs font-semibold text-slate-800">
              Próbki ({row.samples.length}) - jedna na dzień zamówienia
            </p>
            {row.samples.length > 8 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowAllSamples((v) => !v)}
              >
                {showAllSamples ? "Mniej" : `Pokaż wszystkie (${row.samples.length})`}
              </Button>
            ) : null}
          </div>
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500">
                <th className="px-2 py-2 font-medium">Zamówienie</th>
                <th className="px-2 py-2 font-medium">Data zam.</th>
                <th className="px-2 py-2 font-medium">Dostawa</th>
                <th className="px-2 py-2 font-medium">Dni rob.</th>
                <th className="px-2 py-2 font-medium">Typ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSamples.map((sample) => (
                <tr key={sample.dedupKey}>
                  <td className="px-2 py-1.5 font-mono text-[0.6875rem] text-slate-600">
                    {sample.orderId.slice(0, 8)}…
                  </td>
                  <td className="px-2 py-1.5 text-xs tabular-nums text-slate-800">
                    {sample.placementDate}
                  </td>
                  <td className="px-2 py-1.5 text-xs tabular-nums text-slate-800">
                    {sample.deliveryDate}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-medium tabular-nums text-slate-900">
                    {sample.businessDays}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-slate-700">
                    {sample.orderType === "Glowne" ? "Główne" : "Poboczne"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-600">
          Brak próbek w historii zrealizowanych zamówień dla tego dostawcy.
        </p>
      )}
    </div>
  );
}

function SupplierRow({
  row,
  expanded,
  onToggle,
}: {
  row: DeliveryStatsSupplierDiagnostic;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "cursor-pointer transition-colors hover:bg-slate-50",
          expanded && "bg-indigo-50 hover:bg-indigo-50"
        )}
        onClick={onToggle}
      >
        <td className="py-2.5 pl-3 pr-2 sm:pl-4 lg:pl-5">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex w-full items-start gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <IconChevronDown
              size={14}
              open={expanded}
              className="mt-0.5 shrink-0 text-slate-400"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">{row.supplierName}</span>
              {!row.isActive ? (
                <span className="block text-[0.6875rem] text-slate-500">Nieaktywny</span>
              ) : null}
            </span>
          </button>
        </td>
        <td className="px-2 py-2.5 sm:px-3">
          <Badge variant={healthBadgeVariant(row.health)} className="whitespace-nowrap">
            {deliveryStatsHealthLabel(row.health)}
          </Badge>
        </td>
        <td className="hidden px-2 py-2.5 text-xs text-slate-700 md:table-cell sm:px-3">
          {formatStatsModeLabel(row.statsMode)}
        </td>
        <td className="hidden px-2 py-2.5 text-xs tabular-nums text-slate-800 lg:table-cell sm:px-3">
          {avgCell(row.mainAvg, row.recomputed.main_count)}
        </td>
        <td className="hidden px-2 py-2.5 text-xs tabular-nums text-slate-800 lg:table-cell sm:px-3">
          {avgCell(row.sideAvg, row.recomputed.side_count)}
        </td>
        <td className="px-2 py-2.5 text-xs tabular-nums text-slate-800 sm:px-3">
          {row.combinedAvg != null ? `~${row.combinedAvg} d` : "-"}
        </td>
        <td className="hidden px-2 py-2.5 text-xs tabular-nums text-slate-700 sm:table-cell sm:px-3">
          {row.totalSamples}
          <span className="text-slate-500"> / {row.historyOrderCount}</span>
        </td>
        <td className="hidden px-2 py-2.5 text-xs text-slate-600 xl:table-cell sm:px-3">
          {formatTimestamp(row.storedUpdatedAt)}
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={8} className="p-0">
            <SupplierDetailPanel row={row} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

const HEALTH_FILTERS: { id: HealthFilter; label: string }[] = [
  { id: "all", label: "Wszyscy" },
  { id: "issues", label: "Wymagają uwagi" },
  { id: "ok", label: "OK" },
  { id: "low_samples", label: "Mało próbek" },
  { id: "no_data", label: "Brak danych" },
];

export function DeliveryStatsDiagnosticsPanel({
  initialData,
}: {
  initialData: DeliveryStatsDiagnostics | null;
}) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const dismissToast = useCallback(() => setToast(null), []);
  const notify = useCallback(
    (text: string, tone: "success" | "error" = "success") =>
      setToast(adminPanelNotice(text, tone, "Diagnostyka dostaw")),
    [],
  );

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const result = await actionFetchDeliveryStatsDiagnostics();
      if (result.error || !result.data) {
        notify(result.error ?? "Nie udało się odświeżyć danych", "error");
        return;
      }
      setData(result.data);
    });
  }, [notify]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.suppliers.filter((row) => {
      if (activeOnly && !row.isActive) return false;
      if (healthFilter === "issues") {
        if (row.health === "ok" || row.health === "low_samples" || row.health === "no_data") {
          return false;
        }
      } else if (healthFilter !== "all" && row.health !== healthFilter) {
        return false;
      }
      if (!matchesSearchWords(row.supplierName, q)) return false;
      return true;
    });
  }, [data, search, healthFilter, activeOnly]);

  const issueCount = useMemo(() => {
    if (!data) return 0;
    return data.suppliers.filter(
      (s) => s.health === "mismatch" || s.health === "integrity" || s.health === "missing_row"
    ).length;
  }, [data]);

  if (!data) {
    return (
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Czasy realizacji dostawców"
          description="Diagnostyka zbierania statystyk ETA - wymaga połączenia z bazą."
        />
        <div className="px-3 pb-4 sm:px-4 lg:px-5">
          <p className="text-sm text-slate-600">Brak danych - sprawdź połączenie z bazą danych (DATABASE_URL).</p>
        </div>
      </Card>
    );
  }

  const { summary } = data;

  return (
    <>
      {toast ? <NoticeToast notice={toast} onDismiss={dismissToast} /> : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Czasy realizacji dostawców"
          description="Podgląd statystyk ETA: co jest w bazie, skąd pochodzą próbki i czy dane są spójne z historią zamówień."
          action={
            <HelpPopover
              label="Pomoc - statystyki czasu realizacji"
              title="Statystyki czasu realizacji"
              shortLabel="Pomoc"
            >
              <HelpBlock title="Skąd biorą się dane">
                <p>
                  Z w pełni zrealizowanych zamówień indywidualnych u dostawcy (status{" "}
                  <strong>Zrealizowane</strong>).
                </p>
              </HelpBlock>

              <HelpBlock title="Reguły liczenia">
                <ul className="list-disc space-y-1.5 pl-4 text-xs">
                  <li>
                    Próbki w <code>delivery_stats_samples</code> (1 wiersz / zamówienie); mean ważony
                    dniem+typem. Zęby i cancel-disposition poza commodity.
                  </li>
                  <li>
                    Dni robocze po dacie kalendarzowej Warszawy (placement → delivery).
                  </li>
                  <li>
                    Pomijamy: informacje, częściowe realizacje, brak produktu, brak dat, zęby,
                    cancel-disposition.
                  </li>
                  <li>
                    Flagi: <code>DELIVERY_STATS_FROM_SAMPLES</code> /{" "}
                    <code>ETA_USE_P50</code> (env lub app_settings).
                  </li>
                  <li>Poniżej 5 próbek ETA oznaczone jest jako szacunek.</li>
                </ul>
              </HelpBlock>

              <HelpBlock title="Odświeżenie">
                <p className="text-xs text-slate-500">
                  Ostatnie odświeżenie widoku: {formatTimestamp(data.generatedAt)}
                  {data.summary.samplesSource
                    ? ` · źródło health: ${data.summary.samplesSource}`
                    : ""}
                </p>
                {data.summary.missingOrderedAtCount != null &&
                data.summary.missingOrderedAtCount > 0 ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Brak ordered_at: {data.summary.missingOrderedAtCount} zrealizowanych
                  </p>
                ) : null}
                {data.summary.skipEventsLast7Days &&
                data.summary.skipEventsLast7Days.length > 0 ? (
                  <div className="mt-2 text-xs text-slate-600">
                    <p className="font-medium">Skip events (7 dni):</p>
                    <ul className="mt-1 list-disc pl-4">
                      {data.summary.skipEventsLast7Days.slice(0, 8).map((row) => (
                        <li key={row.reason}>
                          {row.reason}: {row.count}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </HelpBlock>
            </HelpPopover>
          }
        />

        <div className="space-y-4 px-3 py-4 sm:px-4 lg:px-5">
          <AdminMetrics
            items={[
              {
                label: "Dostawcy z próbkami",
                value: summary.suppliersWithSamples,
                hint: `z ${summary.supplierCount} łącznie`,
              },
              {
                label: "Próbki łącznie",
                value: summary.totalSamples,
                hint: `${summary.totalHistoryOrders} w historii · ${summary.totalUnusedOrders} pominiętych`,
              },
              {
                label: "Wiersze w delivery_stats",
                value: summary.suppliersWithStoredStats,
                hint: summary.lastStatsUpdate
                  ? `Ostatnia akt. ${formatTimestamp(summary.lastStatsUpdate)}`
                  : "Brak aktualizacji",
              },
              {
                label: "Mało próbek (<3)",
                value: summary.suppliersLowConfidence,
                tone: summary.suppliersLowConfidence ? "warning" : "default",
              },
              {
                label: "Rozjazdy / brak wiersza",
                value: summary.suppliersMismatch,
                tone: summary.suppliersMismatch ? "danger" : "default",
              },
              {
                label: "Brak danych",
                value: summary.suppliersNoData,
                hint: "Bez historii i bez wiersza",
              },
            ]}
          />

          {issueCount > 0 ? (
            <Alert
              tone="error"
              title={`${issueCount} ${polishPluralWord(issueCount, "dostawca ma", "dostawcy mają", "dostawców ma")} rozjazd między bazą a historią`}
            >
              Albo brak wiersza mimo próbek. Użyj „Przelicz statystyki ETA”.
            </Alert>
          ) : summary.suppliersWithSamples > 0 ? (
            <p className="text-sm text-slate-600">
              Dane wyglądają spójnie - system zbiera próbki i zapisuje je w{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">delivery_stats</code>.
            </p>
          ) : (
            <Alert tone="warning" title="Brak próbek w historii">
              ETA pojawi się po pierwszych zrealizowanych dostawach.
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={refreshing} onClick={refresh}>
              {refreshing ? (
                <>
                  <Spinner size="sm" />
                  Odświeżanie…
                </>
              ) : (
                "Odśwież dane"
              )}
            </Button>
            <AdminActionButton
              action={async () => {
                const result = await actionRecalculateStats();
                refresh();
                return result;
              }}
              label="Przelicz statystyki ETA"
              onMessage={notify}
              loadingMessage="Przeliczanie statystyk dostaw…"
              loadingHint="Pełny przebieg historii zamówień"
              overlayVariant="section"
            />
          </div>

        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-3 sm:px-4 lg:px-5">
          <Input
            type="search"
            aria-label="Szukaj dostawcy"
            placeholder="Szukaj dostawcy…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Stan statystyk">
            {HEALTH_FILTERS.map((chip) => {
              const active = healthFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={active}
                  className={cn(
                    panelChoiceChipClass,
                    "min-h-9 px-2.5 py-1.5",
                    active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
                  )}
                  onClick={() => setHealthFilter(chip.id)}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            Tylko aktywni
          </label>
          <p className="ml-auto text-[0.6875rem] tabular-nums text-slate-500">
            {filtered.length} {polishPluralWord(filtered.length, "dostawca", "dostawcy", "dostawców")}
          </p>
        </div>

          <div className="overflow-x-auto border-t border-slate-200">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[0.8125rem] text-slate-500">
                  <th className="py-2.5 pl-3 pr-2 font-medium sm:pl-4 lg:pl-5">Dostawca</th>
                  <th className="px-2 py-2.5 font-medium sm:px-3">Status</th>
                  <th className="hidden px-2 py-2.5 font-medium md:table-cell sm:px-3">Tryb</th>
                  <th className="hidden px-2 py-2.5 font-medium lg:table-cell sm:px-3">Główne</th>
                  <th className="hidden px-2 py-2.5 font-medium lg:table-cell sm:px-3">Poboczne</th>
                  <th className="px-2 py-2.5 font-medium sm:px-3">Łącznie</th>
                  <th className="hidden px-2 py-2.5 font-medium sm:table-cell sm:px-3">Próbki</th>
                  <th className="hidden px-2 py-2.5 font-medium xl:table-cell sm:px-3">
                    Ostatnia akt.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-card">
                {filtered.length ? (
                  filtered.map((row) => (
                    <SupplierRow
                      key={row.supplierId}
                      row={row}
                      expanded={expandedId === row.supplierId}
                      onToggle={() =>
                        setExpandedId((id) => (id === row.supplierId ? null : row.supplierId))
                      }
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                      Brak dostawców pasujących do filtrów.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </Card>
    </>
  );
}
