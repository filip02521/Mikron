"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import {
  actionSearchDeliveryJournal,
  actionSummarizeDeliveryJournal,
} from "@/app/actions/warehouse-delivery";
import type { WarehouseDeliveryReceipt } from "@/lib/warehouse/delivery-receipts-shared";
import {
  deliveryJournalPresetRange,
  formatJournalPresetLabel,
  journalInsightsDefaultRange,
  type DeliveryJournalDatePreset,
  type DeliveryJournalRangeSummary,
} from "@/lib/warehouse/delivery-journal-shared";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import {
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
import { panelTypography } from "@/lib/ui/ontime-theme";
import { Alert } from "@/components/ui/Alert";
import {
  QUEUE_LIST_BODY_CLASS,
  queueToolbarShellClass,
} from "@/lib/ui/queue-panel-styles";
import { polishPluralWord } from "@/lib/email/polish-plural";

type SupplierOption = { id: string; name: string; subiektKhId: number | null };

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
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
  carriers,
  todayDateKey,
  initialQuery = "",
}: {
  suppliers: SupplierOption[];
  carriers: WarehouseCarrierRow[];
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
  const carrierFilterOptions = useMemo(
    () =>
      [...carriers].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pl")
      ),
    [carriers]
  );

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
        setError(userFacingErrorText(e, "Błąd wyszukiwania"));
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
        setError(userFacingErrorText(e, "Błąd wyszukiwania"));
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
      : `${formatDateLabel(dateFrom)} - ${formatDateLabel(dateTo)}`;

  return (
    <div className="px-3 py-4 sm:px-4 lg:px-6">
      <p className="text-sm leading-relaxed text-slate-600">
        Sprawdź, czy paczka dotarła - po numerze listu, dostawcy lub kurierze. Edycja wpisów tylko w
        zakładce <strong className="font-medium text-slate-700">Dzień</strong> (dziś).
      </p>

      <div className="mt-4 space-y-3">
        <div className={queueToolbarShellClass}>
          <DeliveryJournalSearchField
            id="journal-archive-search"
            label="Szukaj paczki"
            hideLabel
            className="sm:max-w-sm"
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
          <Button
            variant="primary"
            size="md"
            className="min-h-11 w-full shrink-0 sm:min-h-9 sm:w-auto sm:self-start"
            disabled={pending}
            onClick={runSearch}
          >
            {pending ? "Szukam…" : "Szukaj"}
          </Button>
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 max-w-full">
              <SegmentedControl<DeliveryJournalDatePreset>
                ariaLabel="Zakres dat"
                value={preset}
                onChange={applyPreset}
                touchFriendly
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
                {carrierFilterOptions.map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
                    {entry.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {error ? (
          <Alert tone="error">{error}</Alert>
        ) : null}
      </div>

      {summary && searched ? (
        <div className="mt-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Podsumowanie · {dateRangeLabel}</h3>
            <p className="mt-0.5 text-sm tabular-nums text-slate-600">
              {summary.receiptCount} {polishPluralWord(summary.receiptCount, "dostawa", "dostawy", "dostaw")} ·{" "}
              {summary.packageCount} {polishPluralWord(summary.packageCount, "paczka", "paczki", "paczek")} ·{" "}
              {summary.palletCount} {polishPluralWord(summary.palletCount, "paleta", "palety", "palet")} ·{" "}
              {summary.supplierCount} {polishPluralWord(summary.supplierCount, "dostawca", "dostawcy", "dostawców")}
            </p>
          </div>
          {summary.byCarrier.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[0.8125rem] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Kurier</th>
                    <th className="px-3 py-2 font-medium">Dostawy</th>
                    <th className="px-3 py-2 font-medium">Paczki</th>
                    <th className="px-3 py-2 font-medium">Palety</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCarrier.map((row) => (
                    <tr key={row.carrier} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {warehouseCarrierLabel(row.carrier, carriers)}
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
            <h3 className="text-sm font-semibold text-slate-900">
              Wyniki
              {!pending ? (
                <span className="ml-1.5 font-normal text-slate-500">
                  · {receipts.length}{" "}
                  {polishPluralWord(receipts.length, "dostawa", "dostawy", "dostaw")}
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
            <ul className={cn("divide-y divide-slate-100", QUEUE_LIST_BODY_CLASS, pending && "opacity-60")}>
              {receipts.map((r) => (
                <DeliveryJournalReceiptCard
                  key={r.id}
                  receipt={r}
                  showDate
                  highlightQuery={query.trim() || undefined}
                  carrierCatalog={carriers}
                />
              ))}
            </ul>
          ) : !pending ? (
            <EmptyState
              title="Brak wyników"
              description={
                hasQuery
                  ? "Nie znaleziono dostawy z tą frazą. Spróbuj innego numeru listu, poszerz zakres (np. 90 dni) albo usuń filtr kuriera."
                  : "Brak wpisów w wybranym zakresie - zmień daty lub filtry."
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
