"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
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
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { Spinner } from "@/components/ui/Spinner";
import { Toast } from "@/components/ui/Toast";
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

type HealthFilter = "all" | DeliveryStatsHealth | "issues";

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
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
  if (!count) return "—";
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
  const mismatch = stored !== recomputed && stored !== "—" && recomputed !== "—";
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
    <div className="space-y-4 border-t border-slate-100 bg-slate-50/40 px-3 py-4 sm:px-4">
      <div className="rounded-md border border-slate-200/80 bg-white p-3">
        <p className="text-xs font-semibold text-slate-800">Diagnoza</p>
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs leading-relaxed text-slate-700">
          {row.healthNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-500">
          Historia: {row.historyOrderCount} zrealizowanych w pełni · {row.unusedOrderCount}{" "}
          pominiętych (duplikaty dnia, brak daty, typ None itd.)
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200/80 bg-white">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2 font-semibold">Pole</th>
              <th className="px-2 py-2 font-semibold">W bazie (delivery_stats)</th>
              <th className="px-2 py-2 font-semibold">Z historii (przeliczone)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <ComparisonRow label="Główne" stored={storedMain} recomputed={recomputedMain} />
            <ComparisonRow label="Poboczne" stored={storedSide} recomputed={recomputedSide} />
            <ComparisonRow
              label="Ostatnia aktualizacja"
              stored={formatTimestamp(row.storedUpdatedAt)}
              recomputed="—"
            />
          </tbody>
        </table>
      </div>

      {row.samples.length ? (
        <div className="overflow-x-auto rounded-md border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <p className="text-xs font-semibold text-slate-800">
              Próbki ({row.samples.length}) — jedna na dzień zamówienia
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
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2 font-semibold">Zamówienie</th>
                <th className="px-2 py-2 font-semibold">Data zam.</th>
                <th className="px-2 py-2 font-semibold">Dostawa</th>
                <th className="px-2 py-2 font-semibold">Dni rob.</th>
                <th className="px-2 py-2 font-semibold">Typ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSamples.map((sample) => (
                <tr key={sample.dedupKey}>
                  <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600">
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
        <p className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-4 text-xs text-slate-600">
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
          "cursor-pointer transition hover:bg-indigo-50/30",
          expanded && "bg-indigo-50/20"
        )}
        onClick={onToggle}
      >
        <td className="px-2 py-2.5 sm:px-3">
          <div className="flex items-start gap-2">
            <IconChevronDown
              size={14}
              open={expanded}
              className="mt-0.5 shrink-0 text-slate-400"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{row.supplierName}</p>
              {!row.isActive ? (
                <p className="text-[11px] text-slate-500">Nieaktywny</p>
              ) : null}
            </div>
          </div>
        </td>
        <td className="px-2 py-2.5 sm:px-3">
          <Badge variant={healthBadgeVariant(row.health)}>
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
          {row.combinedAvg != null ? `~${row.combinedAvg} d` : "—"}
        </td>
        <td className="hidden px-2 py-2.5 text-xs tabular-nums text-slate-700 sm:table-cell sm:px-3">
          {row.totalSamples}
          <span className="text-slate-400"> / {row.historyOrderCount}</span>
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
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const dismissToast = useCallback(() => setToast(null), []);
  const notify = useCallback(
    (text: string, tone: "success" | "error" = "success") => setToast({ text, tone }),
    []
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
      if (q && !row.supplierName.toLowerCase().includes(q)) return false;
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
          description="Diagnostyka zbierania statystyk ETA — wymaga połączenia z bazą."
        />
        <div className="px-3 pb-4 sm:px-4 lg:px-5">
          <p className="text-sm text-slate-600">Brak danych — sprawdź konfigurację Supabase.</p>
        </div>
      </Card>
    );
  }

  const { summary } = data;

  return (
    <>
      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={dismissToast} /> : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Czasy realizacji dostawców"
          description="Podgląd statystyk ETA: co jest w bazie, skąd pochodzą próbki i czy dane są spójne z historią zamówień."
          action={
            <HelpPopover
              label="Pomoc — statystyki czasu realizacji"
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
                  <li>Jedna próbka na dostawcę i dzień zamówienia (wcześniejsza dostawa wygrywa).</li>
                  <li>
                    Liczymy dni robocze między datą zamówienia a datą dostawy na magazyn.
                  </li>
                  <li>
                    Pomijamy: informacje, częściowe realizacje, brak produktu, brak dat i
                    duplikaty.
                  </li>
                  <li>Przy zapisie pełnej realizacji statystyki aktualizują się przyrostowo.</li>
                  <li>Poniżej 3 próbek ETA w panelu oznaczone jest jako szacunek.</li>
                </ul>
              </HelpBlock>

              <HelpBlock title="Odświeżenie">
                <p className="text-xs text-slate-500">
                  Ostatnie odświeżenie widoku: {formatTimestamp(data.generatedAt)}
                </p>
              </HelpBlock>
            </HelpPopover>
          }
        />

        <div className="space-y-4 px-3 pb-4 sm:px-4 lg:px-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <PanelSummaryMetric
              label="Dostawcy z próbkami"
              value={summary.suppliersWithSamples}
              hint={`z ${summary.supplierCount} łącznie`}
              tone={summary.suppliersWithSamples > 0 ? "success" : "default"}
            />
            <PanelSummaryMetric
              label="Próbki łącznie"
              value={summary.totalSamples}
              hint={`${summary.totalHistoryOrders} w historii · ${summary.totalUnusedOrders} pominiętych`}
            />
            <PanelSummaryMetric
              label="Wiersze w delivery_stats"
              value={summary.suppliersWithStoredStats}
              hint={
                summary.lastStatsUpdate
                  ? `Ostatnia akt. ${formatTimestamp(summary.lastStatsUpdate)}`
                  : "Brak aktualizacji"
              }
            />
            <PanelSummaryMetric
              label="Mało próbek (&lt;3)"
              value={summary.suppliersLowConfidence}
              tone={summary.suppliersLowConfidence ? "warning" : "default"}
            />
            <PanelSummaryMetric
              label="Rozjazdy / brak wiersza"
              value={summary.suppliersMismatch}
              tone={summary.suppliersMismatch ? "danger" : "default"}
            />
            <PanelSummaryMetric
              label="Brak danych"
              value={summary.suppliersNoData}
              hint="Bez historii i bez wiersza"
            />
          </div>

          {issueCount > 0 ? (
            <div className="rounded-md border border-red-200/80 bg-red-50/50 px-3 py-2.5 text-sm text-red-900">
              <span className="font-medium">{issueCount} dostawców</span> ma rozjazd między bazą a
              historią lub brak wiersza mimo próbek — użyj „Przelicz statystyki ETA”.
            </div>
          ) : summary.suppliersWithSamples > 0 ? (
            <div className="rounded-md border border-emerald-200/80 bg-emerald-50/40 px-3 py-2.5 text-sm text-emerald-900">
              Dane wyglądają spójnie — system zbiera próbki i zapisuje je w{" "}
              <code className="rounded bg-white/80 px-1 text-xs">delivery_stats</code>.
            </div>
          ) : (
            <div className="rounded-md border border-amber-200/80 bg-amber-50/40 px-3 py-2.5 text-sm text-amber-900">
              Brak próbek w historii — ETA pojawi się po pierwszych zrealizowanych dostawach.
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 pb-4">
            <div className="min-w-[200px] flex-1">
              <label
                htmlFor="delivery-stats-search"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Szukaj dostawcy
              </label>
              <Input
                id="delivery-stats-search"
                type="search"
                placeholder="Nazwa dostawcy…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {HEALTH_FILTERS.map((chip) => {
                const active = healthFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={cn(
                      panelChoiceChipClass,
                      "px-2.5 py-1.5",
                      active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
                    )}
                    onClick={() => setHealthFilter(chip.id)}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <label className="flex cursor-pointer items-center gap-2 pb-1 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="rounded border-slate-300"
              />
              Tylko aktywni
            </label>
          </div>

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

          <div className="overflow-x-auto rounded-md border border-slate-200/90">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2.5 font-semibold sm:px-3">Dostawca</th>
                  <th className="px-2 py-2.5 font-semibold sm:px-3">Status</th>
                  <th className="hidden px-2 py-2.5 font-semibold md:table-cell sm:px-3">Tryb</th>
                  <th className="hidden px-2 py-2.5 font-semibold lg:table-cell sm:px-3">Główne</th>
                  <th className="hidden px-2 py-2.5 font-semibold lg:table-cell sm:px-3">Poboczne</th>
                  <th className="px-2 py-2.5 font-semibold sm:px-3">Łącznie</th>
                  <th className="hidden px-2 py-2.5 font-semibold sm:table-cell sm:px-3">Próbki</th>
                  <th className="hidden px-2 py-2.5 font-semibold xl:table-cell sm:px-3">
                    Ostatnia akt.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
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
        </div>
      </Card>
    </>
  );
}
