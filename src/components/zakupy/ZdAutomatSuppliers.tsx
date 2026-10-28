"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconChevronDown, IconSearch } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ZdBacktestState, formatRollbackDay, zdInAutomat } from "@/components/zakupy/ZdAutomatCardSection";
import { ZdBacktestPanel } from "@/components/zakupy/ZdBacktestPanel";
import { ZdSupplierOrderPolicyDialog, zdAutoLevelLabel } from "@/components/zakupy/ZdSupplierOrderPolicyDialog";
import { cn } from "@/lib/cn";
import type { ZdAutomatSupplierRow } from "@/lib/data/zd-automat-suppliers";
import type { ZdKpiWeeklyMetrics } from "@/lib/data/zd-kpi-weekly";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { ZD_AUTOMAT_SUPPLIER_LOCATION } from "@/lib/orders/zd-automat-contract";
import {
  ZD_AUTOMAT_OOS_A_ALERT_PCT,
  ZD_AUTOMAT_READY_WEEKS,
  ZD_BACKTEST_SEARCH_VERSION,
  zdAutomatOosAlert,
  zdAutomatReadiness,
  type ZdAutomatRow,
} from "@/lib/orders/zd-automat-status";
import { supplierCountryLabel, supplierCountryMismatchesLocation } from "@/lib/suppliers/subiekt-country";
import { matchesSearchWords } from "@/lib/search/keywords";

// Pulpit Automatu ZD: jeden wiersz na dostawcę — rytm automatu, ostatni backtest i KPI tygodnia; szczegóły
// (wszystkie KPI z trendem, akcje, przejście do karty) rozwijają się pod wierszem.

export type ZdAutomatSupplierView = ZdAutomatSupplierRow & {
  /** KPI tygodniowe, najnowszy pierwszy (najwyżej 4). */
  weeks: ZdKpiWeeklyMetrics[];
  /** Powody „do sprawdzenia” (pusta lista = w porządku albo poza automatem). */
  checkReasons: string[];
};

export type ZdAutomatSupplierFilter = "check" | "automat" | "pl" | "all";

const LOCATION_LABEL: Record<string, string> = { POLSKA: "Polska", ZAGRANICA: "Zagranica", IMPORT: "Import" };

const nf0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });
const zl = (v: number) => `${nf0.format(v)} zł`;
/** Dopiski: od 100 tys. zł w milionach („2,08 mln zł”). */
const zlShort = (v: number) => (Math.abs(v) >= 100_000 ? `${nf2.format(v / 1_000_000)} mln zł` : zl(v));
const pct = (v: number | null) => (v == null ? null : `${nf1.format(v)}%`);
const towary = (n: number) => `${nf0.format(n)} ${polishPluralWord(n, "towar", "towary", "towarów")}`;

type Kpi = {
  key: string;
  label: string;
  /** Definicja w dymku przy nagłówku. */
  help: string;
  value: (m: ZdKpiWeeklyMetrics) => string | null;
  note?: (m: ZdKpiWeeklyMetrics) => string | null;
  /** Powód kreski. */
  empty: string;
};

const KPIS: Record<"oos" | "rotation" | "dead" | "correction" | "deferred" | "minimum", Kpi> = {
  oos: {
    key: "oos",
    label: "Braki A",
    help: `% dni-towarów klasy A z dostępnym stanem ≤ 0 (historia stanów z nocnego przebiegu „Braki i zamówienia”). Alarm od ${ZD_AUTOMAT_OOS_A_ALERT_PCT}%.`,
    value: (m) => pct(m.oosA.pct),
    note: (m) => (m.oosA.skuDays ? `${m.oosA.zeroDays} z ${m.oosA.skuDays} dni-towarów` : null),
    empty: "brak historii stanów",
  },
  rotation: {
    key: "rotation",
    label: "Rotacja",
    help: "Wartość zapasu (stan × cena kartotekowa, bez niej cena z ostatniego ZD) / dzienny koszt sprzedaży z 90 dni. Zdjęcie z dnia przeliczenia.",
    value: (m) => (m.rotation.days == null ? null : `${nf0.format(m.rotation.days)} dni`),
    note: (m) => `zapas ${zlShort(m.rotation.stockValue)}`,
    empty: "bez sprzedaży",
  },
  dead: {
    key: "dead",
    label: "Martwy zapas",
    help: "Wartość towarów na stanie bez sprzedaży od 180 dni. Zdjęcie z dnia przeliczenia.",
    value: (m) => zl(m.deadStock.value),
    note: (m) => (m.deadStock.skus ? towary(m.deadStock.skus) : null),
    empty: "—",
  },
  correction: {
    key: "correction",
    label: "Korekta",
    help: `Korekta człowieka: % wartości propozycji zmienionej przy tworzeniu ZD. Poniżej 10% przez ${ZD_AUTOMAT_READY_WEEKS} tygodnie = gotowość do auto-zatwierdzania.`,
    value: (m) => pct(m.humanCorrection.pct),
    note: (m) =>
      [
        m.humanCorrection.proposals ? `${nf0.format(m.humanCorrection.proposals)} ZD z propozycji` : null,
        m.lineCorrection?.pct != null
          ? `Kreator: ${pct(m.lineCorrection.pct)} na ${nf0.format(m.lineCorrection.zdCount)} ZD, ${nf0.format(m.lineCorrection.dropped)} zdjętych`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    empty: "brak ZD z propozycji",
  },
  deferred: {
    key: "deferred",
    label: "Odłożone",
    help: "% propozycji tygodnia odłożonych na kolejny cykl (poniżej minimum albo progu darmowej dostawy, bez pozycji pilnych).",
    value: (m) => pct(m.minima.deferredPct),
    note: (m) => (m.minima.proposals ? `${m.minima.deferred} z ${m.minima.proposals} propozycji` : null),
    empty: "brak propozycji",
  },
  minimum: {
    key: "minimum",
    label: "Minimum",
    help: "ZD ≥ minimum: % ZD z propozycji w tym tygodniu z wartością co najmniej minimum zamówienia dostawcy.",
    value: (m) => pct(m.minima.aboveMinPct),
    note: (m) => (m.minima.accepted ? `${m.minima.acceptedAboveMin} z ${m.minima.accepted} ZD` : null),
    empty: "brak minimum lub ZD",
  },
};

const DETAIL_KPIS = [KPIS.oos, KPIS.correction, KPIS.deferred, KPIS.minimum, KPIS.rotation, KPIS.dead];

export function zdAutomatRowOf(r: Pick<ZdAutomatSupplierView, "name" | "policy" | "weeks">): ZdAutomatRow {
  return {
    name: r.name,
    automat: zdInAutomat(r) ? { autoLevel: r.policy.autoLevel, cycleDays: r.policy.cycleDays } : null,
    weeks: r.weeks,
  };
}

function KpiValue({ kpi, weeks, alert = false, trend = false }: { kpi: Kpi; weeks: ZdKpiWeeklyMetrics[]; alert?: boolean; trend?: boolean }) {
  const [now, ...prev] = weeks;
  const value = now ? kpi.value(now) : null;
  const note = now ? kpi.note?.(now) : null;
  const earlier = trend ? prev.map((m) => kpi.value(m)).reverse() : [];
  return (
    <>
      {value == null ? (
        <span className="text-slate-500" title={now ? kpi.empty : "KPI jeszcze nie policzone"}>
          —<span className="sr-only"> {now ? kpi.empty : "KPI jeszcze nie policzone"}</span>
        </span>
      ) : (
        <span className={cn("whitespace-nowrap font-semibold", alert ? "text-amber-800" : "text-slate-900")}>{value}</span>
      )}
      {note ? <span className="block text-xs text-slate-500">{note}</span> : null}
      {earlier.some((v) => v != null) ? (
        <span className="block text-xs text-slate-500" title="Poprzednie tygodnie, od najstarszego">
          wcześniej: {earlier.map((v) => v ?? "—").join(" · ")}
        </span>
      ) : null}
    </>
  );
}

function KpiHead({ kpi }: { kpi: Pick<Kpi, "label" | "help"> }) {
  return (
    <th>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {kpi.label}
        <HelpHintBubble message={kpi.help} ariaLabel={`Co znaczy: ${kpi.label}`} />
      </span>
    </th>
  );
}

function Readiness({ row }: { row: ZdAutomatRow }) {
  const r = zdAutomatReadiness(row);
  if (!r) return <span className="text-slate-500">—</span>;
  if (r.kind === "ready") return <Badge variant="success">gotowy do stopnia 3</Badge>;
  if (r.kind === "auto") return <Badge variant="info">auto-zatwierdzanie</Badge>;
  if (r.kind === "progress") return <Badge>{r.weeksOk} z {ZD_AUTOMAT_READY_WEEKS} tyg.</Badge>;
  return <span className="text-sm text-slate-600">{r.reason}</span>;
}

function AutomatRhythm({ row }: { row: ZdAutomatSupplierRow }) {
  const p = row.policy;
  if (!zdInAutomat(row)) return <span className="text-sm text-slate-500">poza automatem</span>;
  return (
    <>
      <span className="whitespace-nowrap font-medium text-slate-900">
        {p.cycleDays ? (p.cycleDays === 1 ? "codziennie" : `co ${p.cycleDays} dni`) : "rytm ?"} · cel {p.targetDays ?? "?"}
      </span>
      <span className="block text-xs text-slate-500">{zdAutoLevelLabel(p.autoLevel)}</span>
      {row.levelRollback ? (
        <span className="block text-xs text-amber-800" title={row.levelRollback.reason}>
          obniżony {formatRollbackDay(row.levelRollback.at)} (braki A)
        </span>
      ) : null}
    </>
  );
}

const COLS = 7;

export function ZdAutomatSuppliers({
  rows,
  canManage,
  cardsHref,
  kpiWeekLabel,
  filter,
  onFilterChange,
  q,
  onQChange,
  nowMs,
}: {
  rows: ZdAutomatSupplierView[];
  canManage: boolean;
  /** Ścieżka kart dostawców tej roli (`/zakupy/dostawcy` albo `/admin/dostawcy`); `?karta=<id>` otwiera kartę. */
  cardsHref: string;
  /** „tydzień 13.10–19.10 · policzone …” albo powód braku KPI. */
  kpiWeekLabel: string;
  filter: ZdAutomatSupplierFilter;
  onFilterChange: (f: ZdAutomatSupplierFilter) => void;
  /** Szukana nazwa — w rodzicu, żeby akcja zdania stanu („Pokaż N do sprawdzenia”) mogła ją wyczyścić. */
  q: string;
  onQChange: (q: string) => void;
  /** Chwila otwarcia strony — wiek backtestów liczony tak samo w wierszach i w zdaniu stanu. */
  nowMs: number;
}) {
  const router = useRouter();
  const counts = useMemo(
    () => ({
      check: rows.filter((r) => r.checkReasons.length).length,
      automat: rows.filter(zdInAutomat).length,
      pl: rows.filter((r) => r.location === ZD_AUTOMAT_SUPPLIER_LOCATION).length,
      all: rows.length,
    }),
    [rows]
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: "policy" | "backtest"; row: ZdAutomatSupplierRow } | null>(null);
  const refresh = useCallback(() => router.refresh(), [router]);

  const needle = q.trim().toLocaleLowerCase("pl");
  const inFilter = rows.filter((r) =>
    filter === "check"
      ? r.checkReasons.length > 0
      : filter === "automat"
        ? zdInAutomat(r)
        : filter === "pl"
          ? r.location === ZD_AUTOMAT_SUPPLIER_LOCATION
          : true
  );
  const shown = needle ? inFilter.filter((r) => matchesSearchWords(r.name, needle)) : inFilter;

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader inset title="Dostawcy" description={kpiWeekLabel} />

      <div className="flex flex-wrap items-center gap-2 border-y border-slate-200 bg-white px-6 py-3 sm:px-7">
        <SegmentedControl
          value={filter}
          onChange={(f) => {
            onFilterChange(f);
            setExpanded(null);
          }}
          ariaLabel="Pokaż dostawców"
          density="compact"
          options={[
            { value: "check", label: `Do sprawdzenia ${counts.check}` },
            { value: "automat", label: `W automacie ${counts.automat}` },
            { value: "pl", label: `Polscy ${counts.pl}` },
            { value: "all", label: `Wszyscy ${counts.all}` },
          ]}
        />
        <div className="relative order-first w-full sm:order-none sm:w-64">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="Szukaj dostawcy"
            aria-label="Szukaj dostawcy"
            className="pl-9"
          />
        </div>
      </div>

      {shown.length ? (
        <TableScroll className="relative">
          <DataTable className="kpi-table min-w-[760px]">
            <thead>
              <tr>
                <th>Dostawca</th>
                <th>Automat</th>
                <th>Ostatni backtest</th>
                <KpiHead kpi={KPIS.oos} />
                <KpiHead kpi={KPIS.correction} />
                <KpiHead
                  kpi={{
                    label: "Gotowość",
                    help: `Auto-zatwierdzanie (stopień 3) po ${ZD_AUTOMAT_READY_WEEKS} kolejnych tygodniach z korektą człowieka poniżej 10%. Stopień zmieniasz w ustawieniach automatu dostawcy.`,
                  }}
                />
                <th>
                  <span className="sr-only">Szczegóły</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const open = expanded === r.id;
                const auto = zdAutomatRowOf(r);
                const on = zdInAutomat(r);
                const mismatch = supplierCountryMismatchesLocation(r.subiektCountryId, r.location);
                const detailId = `zd-automat-detail-${r.id}`;
                return (
                  <Fragment key={r.id}>
                    <tr className={cn(open && "bg-slate-50")}>
                      <td className="min-w-[11rem]">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={detailId}
                          onClick={() => setExpanded(open ? null : r.id)}
                          className="cursor-pointer text-left font-medium text-slate-900 underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                        >
                          {r.name}
                        </button>
                        <span className="block text-xs text-slate-500">
                          {LOCATION_LABEL[r.location] ?? (r.location || "bez lokalizacji")}
                          {r.isActive ? null : " · nieaktywny"}
                          {mismatch ? (
                            <span className="text-amber-800"> · w Subiekcie: {supplierCountryLabel(r.subiektCountryId, r.subiektCountryName)}</span>
                          ) : null}
                        </span>
                        {r.checkReasons.length ? (
                          <span className="mt-1 block text-xs font-medium text-amber-800">{r.checkReasons.join(" · ")}</span>
                        ) : null}
                      </td>
                      <td>
                        <AutomatRhythm row={r} />
                      </td>
                      <td>
                        <ZdBacktestState row={r} nowMs={nowMs} />
                      </td>
                      <td>
                        <KpiValue kpi={KPIS.oos} weeks={r.weeks} alert={zdAutomatOosAlert(auto)} />
                      </td>
                      <td>{on ? <KpiValue kpi={KPIS.correction} weeks={r.weeks} /> : <span className="text-slate-500">—</span>}</td>
                      <td>
                        <Readiness row={auto} />
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          aria-label={open ? `Zwiń: ${r.name}` : `Szczegóły: ${r.name}`}
                          aria-expanded={open}
                          aria-controls={detailId}
                          onClick={() => setExpanded(open ? null : r.id)}
                          className="inline-flex size-11 cursor-pointer items-center sm:size-8 justify-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                        >
                          <IconChevronDown open={open} size={16} className="duration-200 motion-reduce:transition-none" />
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr id={detailId} className="bg-slate-50 hover:bg-slate-50">
                        <td colSpan={COLS} className="!pt-0">
                          {/* Na telefonie tabela przewija się w bok — szczegóły trzymają się widocznej szerokości. */}
                          <div className="zd-automat-detail-enter space-y-4 border-t border-slate-200 pt-4 max-sm:sticky max-sm:left-6 max-sm:w-[calc(100vw-4.5rem)]">
                            {!r.weeks.length ? (
                              <p className="text-sm text-slate-600">
                                KPI tego dostawcy jeszcze nie policzone - pierwsze w poniedziałek o 7:00 za miniony tydzień.
                              </p>
                            ) : (
                              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                                {DETAIL_KPIS.map((k) => (
                                  <div key={k.key}>
                                    <dt className="flex items-center gap-1 text-xs font-medium text-slate-500">
                                      {k.label}
                                      <HelpHintBubble message={k.help} ariaLabel={`Co znaczy: ${k.label}`} />
                                    </dt>
                                    <dd className="mt-0.5 text-sm">
                                      {k.key === "oos" || k.key === "rotation" || k.key === "dead" || on ? (
                                        <KpiValue kpi={k} weeks={r.weeks} alert={k.key === "oos" && zdAutomatOosAlert(auto)} trend />
                                      ) : (
                                        <span className="text-slate-500">tylko w automacie</span>
                                      )}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                            {/* Nagłówki starszych wyników („Schemat działa…”) opisywały ręcznie wybrane ustawienia — nie pokazujemy. */}
                            {r.backtest?.headline && (r.backtest.version ?? 0) >= ZD_BACKTEST_SEARCH_VERSION ? (
                              <p className="max-w-3xl text-sm leading-relaxed text-slate-700">
                                <span className="font-medium text-slate-900">Backtest: </span>
                                {r.backtest.headline}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-2">
                              {canManage ? (
                                <>
                                  {/* Automat włącza się z backtestu — on dobiera cykl i cel. */}
                                  {on ? (
                                    <Button variant="secondary" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setDialog({ kind: "policy", row: r })}>
                                      Zmień ustawienia
                                    </Button>
                                  ) : null}
                                  {r.hasScope ? (
                                    <Button
                                      variant={on ? "ghost" : "secondary"}
                                      size="sm"
                                      className="min-h-11 sm:min-h-0"
                                      onClick={() => setDialog({ kind: "backtest", row: r })}
                                    >
                                      {on ? "Backtest" : "Włącz automat"}
                                    </Button>
                                  ) : (
                                    <span className="text-sm text-slate-600">Automat i backtest po ustawieniu zakresu w Kreatorze ZD</span>
                                  )}
                                </>
                              ) : null}
                              <Link
                                href={`${cardsHref}?karta=${r.id}`}
                                className="text-sm font-medium text-indigo-700 underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                              >
                                Karta dostawcy
                              </Link>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </DataTable>
        </TableScroll>
      ) : (
        <p className="px-6 py-8 text-center text-sm text-slate-600 sm:px-7">
          {needle
            ? `Brak dostawcy „${q.trim()}” w tym widoku.`
            : filter === "check"
              ? "Wszyscy w automacie mają świeży backtest „działa” i braki A poniżej alarmu."
              : filter === "automat"
                ? "Nikt jeszcze nie jest w automacie. Przełącz na „Polscy”, rozwiń dostawcę i wybierz Włącz automat - backtest dobierze ustawienia."
                : "Brak dostawców z zakresem w Kreatorze ZD."}
        </p>
      )}

      <div className="flex flex-col gap-1 border-t border-slate-200 bg-slate-50/60 px-6 py-3 text-xs text-slate-500 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
        <span>
          Pokazuję {shown.length} z {inFilter.length} {polishPluralWord(inFilter.length, "dostawcy", "dostawców", "dostawców")} z zakresem w Kreatorze ZD
        </span>
        <span>„—” = brak danych w tym tygodniu; najedź, żeby zobaczyć powód. „Polscy” = Lokalizacja w karcie dostawcy.</span>
      </div>

      {dialog?.kind === "backtest" ? (
        <ZdBacktestPanel
          supplierId={dialog.row.id}
          supplierName={dialog.row.name}
          policy={dialog.row.policy}
          canManage={canManage}
          onClose={() => setDialog(null)}
          onChanged={refresh}
        />
      ) : null}
      {dialog?.kind === "policy" ? (
        <ZdSupplierOrderPolicyDialog
          supplierId={dialog.row.id}
          supplierName={dialog.row.name}
          policy={dialog.row.policy}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refresh();
          }}
        />
      ) : null}
    </Card>
  );
}
