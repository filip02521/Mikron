"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  actionSearchDeliveryJournal,
  actionSummarizeDeliveryJournal,
} from "@/app/actions/warehouse-delivery";
import type { WarehouseDeliveryReceipt } from "@/lib/warehouse/delivery-receipts";
import {
  deliveryJournalPresetRange,
  formatJournalPresetLabel,
  journalInsightsDefaultRange,
  type DeliveryJournalDatePreset,
  type DeliveryJournalRangeSummary,
} from "@/lib/warehouse/delivery-journal-insights";
import {
  WAREHOUSE_CARRIERS,
  warehouseCarrierLabel,
  type WarehouseCarrier,
} from "@/lib/warehouse/delivery-carriers";
import { DeliveryJournalReceiptCard } from "@/components/queue/delivery-journal/DeliveryJournalReceiptCard";
import { DeliveryJournalSearchField } from "@/components/queue/delivery-journal/DeliveryJournalSearchField";
import { QueueSupplierDirectoryField } from "@/components/queue/QueueSupplierDirectoryField";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import {
  panelMetricTileClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import {
  QUEUE_LIST_BODY_CLASS,
  queueToolbarFieldLabelClass,
  queueToolbarShellClass,
} from "@/lib/ui/queue-panel-styles";

type SupplierOption = { id: string; name: string; subiektKhId: number | null };

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={cn(panelMetricTileClass, "border-slate-200/90 bg-white px-3 py-2.5")}>
      <p className={panelTypography.caption}>{label}</p>
      <p className={cn(panelTypography.statValue, "mt-0.5 text-lg")}>{value}</p>
    </div>
  );
}

function readInitialArchiveState(initialQuery: string) {
  const seed = initialQuery.trim();
  const defaultRange = journalInsightsDefaultRange();
  if (!seed) {
    return {
      query: "",
      preset: "week" as DeliveryJournalDatePreset,
      dateFrom: defaultRange.dateFrom,
      dateTo: defaultRange.dateTo,
    };
  }
  if (seed.length >= 2) {
    const range = deliveryJournalPresetRange("last90");
    return {
      query: seed,
      preset: "last90" as DeliveryJournalDatePreset,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    };
  }
  return {
    query: seed,
    preset: "week" as DeliveryJournalDatePreset,
    dateFrom: defaultRange.dateFrom,
    dateTo: defaultRange.dateTo,
  };
}

export function DeliveryJournalInsightsPanel({
  suppliers,
  todayDateKey,
  initialQuery = "",
}: {
  suppliers: SupplierOption[];
  todayDateKey: string;
  /** Fraza przeniesiona z wyszukiwania dnia — wstępne wypełnienie i opcjonalne auto-wyszukiwanie. */
  initialQuery?: string;
}) {
  const [initialArchive] = useState(() => readInitialArchiveState(initialQuery));
  const [pending, start] = useTransition();
  const [preset, setPreset] = useState<DeliveryJournalDatePreset>(initialArchive.preset);
  const [dateFrom, setDateFrom] = useState(initialArchive.dateFrom);
  const [dateTo, setDateTo] = useState(initialArchive.dateTo);
  const [supplierId, setSupplierId] = useState("");
  const [carrier, setCarrier] = useState<"" | WarehouseCarrier>("");
  const [query, setQuery] = useState(initialArchive.query);
  const [receipts, setReceipts] = useState<WarehouseDeliveryReceipt[]>([]);
  const [summary, setSummary] = useState<DeliveryJournalRangeSummary | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasExtraFilters = Boolean(supplierId || carrier);
  const hasQuery = Boolean(query.trim());

  const applyPreset = useCallback((next: DeliveryJournalDatePreset) => {
    setPreset(next);
    const range = deliveryJournalPresetRange(next);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
  }, []);

  const resetFilters = useCallback(() => {
    setQuery("");
    setSupplierId("");
    setCarrier("");
    applyPreset("week");
    setReceipts([]);
    setSummary(null);
    setSearched(false);
    setError(null);
  }, [applyPreset]);

  const runSearch = useCallback(() => {
    setError(null);
    const filters = {
      dateFrom,
      dateTo,
      supplierId: supplierId || null,
      carrier: carrier || null,
      query: query.trim() || null,
    };
    start(async () => {
      try {
        const [searchResult, summaryResult] = await Promise.all([
          actionSearchDeliveryJournal(filters),
          actionSummarizeDeliveryJournal(filters),
        ]);
        setReceipts(searchResult.receipts);
        setSummary(summaryResult);
        setSearched(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd wyszukiwania");
        setReceipts([]);
        setSummary(null);
        setSearched(true);
      }
    });
  }, [dateFrom, dateTo, supplierId, carrier, query]);

  useEffect(() => {
    const seed = initialQuery.trim();
    if (!seed) return;

    const filters = {
      dateFrom,
      dateTo,
      supplierId: supplierId || null,
      carrier: carrier || null,
      query: seed,
    };
    start(async () => {
      try {
        const [searchResult, summaryResult] = await Promise.all([
          actionSearchDeliveryJournal(filters),
          actionSummarizeDeliveryJournal(filters),
        ]);
        setReceipts(searchResult.receipts);
        setSummary(summaryResult);
        setSearched(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd wyszukiwania");
        setReceipts([]);
        setSummary(null);
        setSearched(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-search once when opened with seed query
  }, [initialQuery]);

  const dateRangeLabel =
    dateFrom === dateTo
      ? formatDateLabel(dateFrom)
      : `${formatDateLabel(dateFrom)} – ${formatDateLabel(dateTo)}`;

  return (
    <div className="px-4 py-5 sm:px-6">
      <p className={panelTypography.sectionDesc}>
        Sprawdź, czy paczka dotarła — po numerze listu, dostawcy lub kurierze. Edycja wpisów tylko w
        zakładce <strong className="font-medium text-slate-700">Wpisy na dziś</strong>.
      </p>

      <div className="mt-4 space-y-3">
        <div className={queueToolbarShellClass}>
          <DeliveryJournalSearchField
            id="journal-archive-search"
            label="Szukaj paczki"
            value={query}
            disabled={pending}
            placeholder="Nr listu, dostawca, kurier…"
            hint={
              hasQuery
                ? "Przy frazie wyszukiwania możesz przeszukać do 365 dni wstecz."
                : undefined
            }
            onChange={setQuery}
            onSubmit={runSearch}
          />
          <div className="flex shrink-0 flex-col gap-1 sm:w-auto">
            <span className={cn(queueToolbarFieldLabelClass, "hidden sm:block sm:invisible")}>
              Szukaj
            </span>
            <Button
              variant="primary"
              size="md"
              className="min-h-[2.375rem] w-full sm:w-auto"
              disabled={pending}
              onClick={runSearch}
            >
              {pending ? "Szukam…" : "Szukaj"}
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-emerald-100/70 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className={queueToolbarFieldLabelClass}>Zakres dat</span>
              <SegmentedControl<DeliveryJournalDatePreset>
                ariaLabel="Zakres dat"
                value={preset}
                onChange={applyPreset}
                touchFriendly
                className="mt-0.5 w-full sm:w-auto"
                options={(
                  ["today", "week", "last7", "last30", "last90", "month"] as DeliveryJournalDatePreset[]
                ).map((p) => ({
                  value: p,
                  label: formatJournalPresetLabel(p),
                }))}
              />
            </div>
            {(hasQuery || hasExtraFilters || searched) && !pending ? (
              <Button variant="ghost" size="sm" className="shrink-0" onClick={resetFilters}>
                Wyczyść filtry
              </Button>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Od">
              <Input
                type="date"
                value={dateFrom}
                max={dateTo || todayDateKey}
                disabled={pending}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </Field>
            <Field label="Do">
              <Input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={todayDateKey}
                disabled={pending}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </Field>
            <Field label="Dostawca">
              <QueueSupplierDirectoryField
                suppliers={suppliers}
                value={supplierId}
                onChange={setSupplierId}
                disabled={pending}
                includeAllOption
                placeholder="Wszyscy lub szukaj…"
              />
            </Field>
            <Field label="Kurier">
              <Select
                value={carrier}
                disabled={pending}
                onChange={(e) => setCarrier(e.target.value as "" | WarehouseCarrier)}
              >
                <option value="">Wszyscy</option>
                {WAREHOUSE_CARRIERS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </div>

      {summary && searched ? (
        <div className="mt-5 space-y-3">
          <h3 className={panelTypography.sectionLabel}>Podsumowanie · {dateRangeLabel}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryStat label="Dostawy" value={summary.receiptCount} />
            <SummaryStat label="Paczki" value={summary.packageCount} />
            <SummaryStat label="Palety" value={summary.palletCount} />
            <SummaryStat label="Dostawcy" value={summary.supplierCount} />
          </div>
          {summary.byCarrier.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Kurier</th>
                    <th className="px-3 py-2 font-medium">Dostawy</th>
                    <th className="px-3 py-2 font-medium">Paczki</th>
                    <th className="px-3 py-2 font-medium">Palety</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCarrier.map((row) => (
                    <tr key={row.carrier} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {warehouseCarrierLabel(row.carrier)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">{row.receiptCount}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">{row.packageCount}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">{row.palletCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {searched ? (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className={panelTypography.sectionLabel}>
              Wyniki
              {!pending ? (
                <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">
                  · {receipts.length}{" "}
                  {receipts.length === 1 ? "dostawa" : receipts.length < 5 ? "dostawy" : "dostaw"}
                </span>
              ) : null}
            </h3>
            {hasQuery ? (
              <p className={panelTypography.caption}>
                fraza: <span className="font-medium text-slate-700">„{query.trim()}”</span>
              </p>
            ) : null}
          </div>

          {receipts.length > 0 ? (
            <ul className={cn("space-y-2", QUEUE_LIST_BODY_CLASS, pending && "opacity-60")}>
              {receipts.map((r) => (
                <DeliveryJournalReceiptCard
                  key={r.id}
                  receipt={r}
                  showDate
                  highlightQuery={query.trim() || undefined}
                />
              ))}
            </ul>
          ) : !pending ? (
            <EmptyState
              title="Brak wyników"
              description={
                hasQuery
                  ? "Nie znaleziono dostawy z tą frazą. Spróbuj innego numeru listu, poszerz zakres (np. 90 dni) albo usuń filtr kuriera."
                  : "Brak wpisów w wybranym zakresie — zmień daty lub filtry."
              }
            />
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-center text-xs text-slate-500">
          Wpisz numer listu lub wybierz zakres dat, potem kliknij{" "}
          <span className="font-medium text-slate-700">Szukaj</span>.
        </p>
      )}
    </div>
  );
}
