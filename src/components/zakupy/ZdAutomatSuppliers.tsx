"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ZdBacktestPanel, ZD_BACKTEST_VERDICT_BADGE, ZD_BACKTEST_VERDICT_LABEL } from "@/components/zakupy/ZdBacktestPanel";
import { ZdSupplierOrderPolicyDialog } from "@/components/zakupy/ZdSupplierOrderPolicyDialog";
import { cn } from "@/lib/cn";
import type { ZdAutomatSupplierRow } from "@/lib/data/zd-automat-suppliers";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { ZD_AUTOMAT_SUPPLIER_LOCATION } from "@/lib/orders/zd-automat-contract";
import { supplierCountryLabel, supplierCountryMismatchesLocation } from "@/lib/suppliers/subiekt-country";
import { formatWarsawDateTime } from "@/lib/time/warsaw";

// Układ wzorowany na 21st.dev „Users List Datatable” (shadcnstore/datatable-1): pasek narzędzi w nagłówku
// karty, wiersz z monogramem i podpisem, pigułki stanu, stopka z licznikiem — na komponentach OnTime.

type Filter = "pl" | "automat" | "all";

const LOCATION_LABEL: Record<string, string> = { POLSKA: "Polska", ZAGRANICA: "Zagranica", IMPORT: "Import" };

// Jedna siatka dla nagłówka i wierszy: od md cztery kolumny, niżej nazwa i akcje na całą szerokość.
const ROW_GRID =
  "grid grid-cols-2 items-start gap-x-4 gap-y-2.5 px-6 md:items-center sm:px-7 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_11.5rem]";

const inAutomat = (r: ZdAutomatSupplierRow) => r.policy.strategy !== "classic";
const backtestRunning = (r: ZdAutomatSupplierRow) => r.backtest?.status === "queued" || r.backtest?.status === "running";

function monogram(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/[\s-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toLocaleUpperCase("pl");
}

function AutomatCell({ row }: { row: ZdAutomatSupplierRow }) {
  const p = row.policy;
  const on = inAutomat(row);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-slate-500 md:hidden">Automat</span>
      <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", on ? "text-emerald-800" : "text-slate-500")}>
        <span className={cn("size-1.5 rounded-full", on ? "bg-emerald-600" : "bg-slate-300")} aria-hidden />
        {on ? `w automacie · stopień ${p.autoLevel}` : "poza automatem"}
      </span>
      {on ? (
        <span className="pl-3 text-xs text-slate-500 md:whitespace-nowrap">
          co {p.cycleDays ?? "?"} dni · cel {p.targetDays ?? "?"} dni
        </span>
      ) : null}
    </div>
  );
}

function BacktestCell({ row }: { row: ZdAutomatSupplierRow }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-[11px] font-medium text-slate-500 md:hidden">Ostatni backtest</span>
      <BacktestState row={row} />
    </div>
  );
}

function BacktestState({ row }: { row: ZdAutomatSupplierRow }) {
  const b = row.backtest;
  if (!b) return <span className="text-sm text-slate-400">nie liczony</span>;
  if (backtestRunning(row)) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-slate-600" role="status">
        <BrandLoader size="sm" tile={false} /> liczy się…
      </span>
    );
  }
  if (b.status === "error") return <Badge variant="danger">błąd przebiegu</Badge>;
  return (
    <div className="flex flex-col items-start gap-0.5" title={b.headline ?? undefined}>
      {b.verdict ? <Badge variant={ZD_BACKTEST_VERDICT_BADGE[b.verdict]}>{ZD_BACKTEST_VERDICT_LABEL[b.verdict]}</Badge> : null}
      <span className="text-xs text-slate-500 md:whitespace-nowrap">
        co {b.params.cycleDays} d, cel {b.params.targetDays} d · {formatWarsawDateTime(b.at)}
      </span>
    </div>
  );
}

export function ZdAutomatSuppliers({ rows, canManage }: { rows: ZdAutomatSupplierRow[]; canManage: boolean }) {
  const router = useRouter();
  const counts = useMemo(() => {
    const auto = rows.filter(inAutomat);
    return {
      pl: rows.filter((r) => r.location === ZD_AUTOMAT_SUPPLIER_LOCATION).length,
      automat: auto.length,
      all: rows.length,
      works: auto.filter((r) => r.backtest?.status === "done" && r.backtest.verdict === "works").length,
      // W automacie bez werdyktu „działa” (brak backtestu, kompromis, nie działa, błąd) — do sprawdzenia.
      toCheck: auto.filter((r) => !backtestRunning(r) && !(r.backtest?.status === "done" && r.backtest.verdict === "works")).length,
    };
  }, [rows]);
  const [filter, setFilter] = useState<Filter>(counts.automat ? "automat" : "pl");
  const [q, setQ] = useState("");
  const [backtestFor, setBacktestFor] = useState<ZdAutomatSupplierRow | null>(null);
  const [policyFor, setPolicyFor] = useState<ZdAutomatSupplierRow | null>(null);
  const refresh = useCallback(() => router.refresh(), [router]);

  const needle = q.trim().toLocaleLowerCase("pl");
  const inFilter = rows.filter((r) => filter === "all" || (filter === "pl" ? r.location === ZD_AUTOMAT_SUPPLIER_LOCATION : inAutomat(r)));
  const shown = needle ? inFilter.filter((r) => r.name.toLocaleLowerCase("pl").includes(needle)) : inFilter;

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        title="Dostawcy"
        description="Włącz automat dostawcy i sprawdź backtestem na roku jego sprzedaży, czy schemat działa — zanim propozycje zaczną powstawać."
      />
      <div className="grid grid-cols-1 gap-2 px-6 pb-5 sm:grid-cols-3 sm:px-7">
        <PanelSummaryMetric label="W automacie" value={counts.automat} hint={`z ${counts.pl} polskich dostawców`} />
        <PanelSummaryMetric label="Backtest: działa" value={counts.works} hint="w automacie, werdykt ostatniego backtestu" />
        <PanelSummaryMetric
          label="Do sprawdzenia"
          value={counts.toCheck}
          tone={counts.toCheck ? "warning" : "default"}
          hint="w automacie bez werdyktu „działa”"
        />
      </div>

      <div className="flex flex-col gap-3 border-y border-slate-200 bg-white px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="relative sm:w-72">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj dostawcy"
            aria-label="Szukaj dostawcy"
            className="pl-9"
          />
        </div>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          ariaLabel="Pokaż dostawców"
          density="compact"
          options={[
            { value: "automat", label: `W automacie (${counts.automat})` },
            { value: "pl", label: `Polscy (${counts.pl})` },
            { value: "all", label: `Wszyscy (${counts.all})` },
          ]}
        />
      </div>

      {shown.length ? (
        <div>
          <div className={cn(ROW_GRID, "hidden bg-slate-50 py-2.5 text-[0.8125rem] font-medium text-slate-500 md:grid")} aria-hidden>
            <span>Dostawca</span>
            <span>Automat</span>
            <span>Ostatni backtest</span>
            <span />
          </div>
          <ul aria-label="Dostawcy z zakresem w Kreatorze ZD">
            {shown.map((r) => {
              const mismatch = supplierCountryMismatchesLocation(r.subiektCountryId, r.location);
              return (
                <li key={r.id} className={cn(ROW_GRID, "border-t border-slate-100 py-3 transition-colors duration-150 hover:bg-slate-50/70")}>
                  <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-xs font-semibold text-indigo-700" aria-hidden>
                      {monogram(r.name)}
                    </span>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setBacktestFor(r)}
                        className="cursor-pointer text-left text-sm font-medium text-slate-900 underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                      >
                        {r.name}
                      </button>
                      <p className="text-xs text-slate-500">
                        {LOCATION_LABEL[r.location] ?? (r.location || "bez lokalizacji")}
                        {mismatch ? (
                          <span className="text-amber-800"> · w Subiekcie: {supplierCountryLabel(r.subiektCountryId, r.subiektCountryName)}</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <AutomatCell row={r} />
                  <BacktestCell row={r} />
                  <div className="col-span-2 flex gap-1.5 md:col-span-1 md:justify-end">
                    <Button variant="secondary" size="sm" onClick={() => setBacktestFor(r)}>
                      Backtest
                    </Button>
                    {canManage ? (
                      <Button variant="ghost" size="sm" onClick={() => setPolicyFor(r)}>
                        Ustawienia
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="px-6 py-8 text-center text-sm text-slate-600 sm:px-7">
          {needle
            ? `Brak dostawcy „${q.trim()}” w tym widoku.`
            : filter === "automat"
              ? "Nikt jeszcze nie jest w automacie. Przełącz na „Polscy” i uruchom backtest wybranego dostawcy."
              : "Brak dostawców z zakresem w Kreatorze ZD."}
        </p>
      )}

      <div className="flex flex-col gap-1 border-t border-slate-200 bg-slate-50/60 px-6 py-3 text-xs text-slate-500 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
        <span>
          Pokazuję {shown.length} z {inFilter.length} {polishPluralWord(inFilter.length, "dostawcy", "dostawców", "dostawców")} z zakresem w Kreatorze ZD
        </span>
        <span>„Polscy” = Lokalizacja w karcie dostawcy; rozjazd z Subiektem na bursztynowo.</span>
      </div>

      {backtestFor ? (
        <ZdBacktestPanel
          supplierId={backtestFor.id}
          supplierName={backtestFor.name}
          policy={backtestFor.policy}
          canManage={canManage}
          onClose={() => setBacktestFor(null)}
          onChanged={refresh}
        />
      ) : null}
      {policyFor ? (
        <ZdSupplierOrderPolicyDialog
          supplierId={policyFor.id}
          supplierName={policyFor.name}
          policy={policyFor.policy}
          onClose={() => setPolicyFor(null)}
          onSaved={() => {
            setPolicyFor(null);
            refresh();
          }}
        />
      ) : null}
    </Card>
  );
}
