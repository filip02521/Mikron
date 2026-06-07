"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
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
  warehouseShipmentFormLabel,
  type WarehouseCarrier,
} from "@/lib/warehouse/delivery-carriers";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";

type SupplierOption = { id: string; name: string; subiektKhId: number | null };

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

function InsightReceiptRow({ receipt }: { receipt: WarehouseDeliveryReceipt }) {
  return (
    <li className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-slate-500">
            {formatDateLabel(receipt.receivedDate)}
          </p>
          <p className="font-semibold text-slate-900">{receipt.supplierName}</p>
          <p className="mt-1 text-sm text-slate-600">
            {warehouseCarrierLabel(receipt.carrier)} ·{" "}
            {warehouseShipmentFormLabel(receipt.shipmentForm)}
            {receipt.packageCount > 0 ? ` · ${receipt.packageCount} pacz.` : ""}
            {receipt.palletCount > 0 ? ` · ${receipt.palletCount} pal.` : ""}
          </p>
          {receipt.note ? (
            <p className="mt-1 text-xs text-slate-500">{receipt.note}</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function DeliveryJournalInsightsPanel({
  suppliers,
  todayDateKey,
}: {
  suppliers: SupplierOption[];
  todayDateKey: string;
}) {
  const defaultRange = useMemo(() => journalInsightsDefaultRange(), []);
  const [pending, start] = useTransition();
  const [preset, setPreset] = useState<DeliveryJournalDatePreset>("week");
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [supplierId, setSupplierId] = useState("");
  const [carrier, setCarrier] = useState<"" | WarehouseCarrier>("");
  const [receipts, setReceipts] = useState<WarehouseDeliveryReceipt[]>([]);
  const [summary, setSummary] = useState<DeliveryJournalRangeSummary | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = useCallback((next: DeliveryJournalDatePreset) => {
    setPreset(next);
    const range = deliveryJournalPresetRange(next);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
  }, []);

  const runSearch = useCallback(() => {
    setError(null);
    const filters = {
      dateFrom,
      dateTo,
      supplierId: supplierId || null,
      carrier: carrier || null,
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
  }, [dateFrom, dateTo, supplierId, carrier]);

  return (
    <div className="px-4 py-5 sm:px-6">
      <p className="text-sm text-slate-600">
        Wyszukiwanie i podsumowania z archiwum. Edycja wpisów tylko w zakładce{" "}
        <strong className="font-medium text-slate-800">Wpisy</strong> (dziś).
      </p>

      <div className="mt-4 space-y-4 rounded-md border border-slate-200 bg-slate-50/80 p-4">
        <SegmentedControl<DeliveryJournalDatePreset>
          ariaLabel="Zakres dat"
          value={preset}
          onChange={(p) => {
            applyPreset(p);
          }}
          className="w-full sm:w-auto"
          options={(
            ["today", "week", "last7", "month"] as DeliveryJournalDatePreset[]
          ).map((p) => ({
            value: p,
            label: formatJournalPresetLabel(p),
          }))}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
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
            <Select
              value={supplierId}
              disabled={pending}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Wszyscy</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
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

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="md" disabled={pending} onClick={runSearch}>
            {pending ? "Szukam…" : "Pokaż wyniki"}
          </Button>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>

      {summary && searched ? (
        <div className="mt-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Podsumowanie ({formatDateLabel(dateFrom)}
            {dateFrom !== dateTo ? ` – ${formatDateLabel(dateTo)}` : ""})
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <SummaryStat label="Dostawy" value={summary.receiptCount} />
            <SummaryStat label="Paczki" value={summary.packageCount} />
            <SummaryStat label="Palety" value={summary.palletCount} />
            <SummaryStat label="Dostawcy" value={summary.supplierCount} />
          </div>
          {summary.byCarrier.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
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

      <ul className={cn("mt-4 space-y-2", pending && "opacity-60")}>
        {receipts.map((r) => (
          <InsightReceiptRow key={r.id} receipt={r} />
        ))}
      </ul>

      {searched && !receipts.length && !pending ? (
        <div className="mt-4">
          <EmptyState
            title="Brak wyników"
            description="Zmień zakres dat lub filtry i wyszukaj ponownie."
          />
        </div>
      ) : null}

      {!searched ? (
        <p className="mt-4 text-center text-xs text-slate-500">
          Wybierz zakres i kliknij „Pokaż wyniki”.
        </p>
      ) : null}
    </div>
  );
}
