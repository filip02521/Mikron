"use client";

import { useMemo, useState } from "react";
import { IconClipboardList, IconLogOut, IconPackageCheck, IconX } from "@/components/icons/StrokeIcons";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Input, Select } from "@/components/ui/Field";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import {
  formatDatePlKey,
  summarizeZdProductPurchases,
  summarizeZdProductSales,
  type ZdProductPurchaseRow,
  type ZdProductSaleRow,
} from "@/lib/orders/zd-product-history";
import { cn } from "@/lib/cn";
import { onRequestCustomerKey, onRequestDeliveryDate } from "@/lib/orders/zd-on-request-detect";
import {
  buildZdProductMovement,
  formatZdProductMovementSummary,
  zdMovementWindowLabel,
  type ZdMovementDelivery,
  type ZdMovementEvent,
  type ZdMovementSale,
} from "@/lib/orders/zd-product-movement";
import {
  bucketZdFlow,
  formatZdHistoryRange,
  formatZdMonthHeading,
  isInZdHistoryRange,
  setZdCustomRangeBound,
  zdFlowBucketStart,
  zdRangeExceedsSalesHistory,
  type ZdFlowBucket,
  type ZdHistoryPreset,
  type ZdHistoryRange,
  type ZdHistoryRangeState,
} from "@/lib/orders/zd-product-range";
import { panelChoiceChipClass, panelChoiceChipIdleClass, panelChoiceChipSelectedClass } from "@/lib/ui/ontime-theme";
import { warsawDateKeyDaysAgo } from "@/lib/time/warsaw";

/** „Starsze zakupy” — cała historia ZD z kopii, dociągana na żądanie (karta produktu). */
export type ZdProductOlderPurchases =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; since: string | null; truncated: boolean }
  | { status: "error"; message: string };

/** Ile dni otwarty ZD bez faktury pokazujemy jako „w drodze”. */
const ZD_IN_TRANSIT_MAX_DAYS = 60;

export type ZdProductHistoryState =
  | { status: "loading" }
  | {
      status: "ok";
      sales: { ok: true; rows: ZdProductSaleRow[]; truncated: boolean } | { ok: false; message: string };
      purchases: { ok: true; rows: ZdProductPurchaseRow[] } | { ok: false; message: string };
    }
  | { status: "error"; message: string };

type UnitFor = (row: ZdProductPurchaseRow) => { label: string; piecesPerUnit: number | null };

const headingClass = "text-xs font-semibold text-slate-600";
const listClass = "mt-1.5 divide-y divide-slate-100 rounded-md border border-slate-200";
const rowClass = "flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm";
const moreButtonClass =
  "rounded-sm font-medium text-indigo-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
const chipClass = cn(panelChoiceChipClass, "inline-flex min-h-8 items-center gap-1.5 px-2.5 py-1 max-sm:min-h-10");

const ROLE_LABEL: Record<ZdProductSaleRow["rola"], string> = {
  fs: "FS",
  pa: "PA",
  wzNiepowiazane: "WZ",
  zw: "Zwrot",
};

/** „FS 2066/M/10/2026” już niesie rodzaj; „Zwrot” albo numer bez symbolu dostaje etykietę rodzaju przed numerem. */
function saleDocLabel(rola: ZdProductSaleRow["rola"], dokNr: string): string {
  const role = ROLE_LABEL[rola];
  return dokNr && dokNr.toUpperCase().startsWith(`${role.toUpperCase()} `) ? dokNr : [role, dokNr].filter(Boolean).join(" ");
}

function Muted({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "amber" }) {
  return <p className={cn("mt-1.5 text-sm", tone === "amber" ? "text-amber-800" : "text-slate-600")}>{children}</p>;
}

function Loading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-center gap-2 text-sm text-slate-600" role="status">
      <BrandLoader size="sm" tile={false} />
      {children}
    </p>
  );
}

/** Rząd liczb nad listą: etykieta Meta, wartość pod nią. Jedna linia faktów, bez kafli. */
function StatStrip({ items }: { items: Array<{ label: string; value: React.ReactNode; hint?: React.ReactNode }> }) {
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-slate-500">{i.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{i.value}</dd>
          {i.hint ? <dd className="text-xs tabular-nums text-slate-500">{i.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

function ShowMore({ shown, total, expanded, onToggle, noun }: { shown: number; total: number; expanded: boolean; onToggle: () => void; noun: [string, string, string] }) {
  if (total <= shown && !expanded) return null;
  const rest = total - shown;
  return (
    <li className="px-3 py-2 text-xs text-slate-600">
      <button type="button" className={moreButtonClass} onClick={onToggle}>
        {expanded ? "Pokaż mniej" : `Pokaż wszystkie (jeszcze ${rest} ${polishPluralWord(rest, ...noun)})`}
      </button>
    </li>
  );
}

const PRESET_LABEL: Record<Exclude<ZdHistoryPreset, "window">, string> = {
  "1m": "1 mies.",
  "3m": "3 mies.",
  "6m": "6 mies.",
  "12m": "12 mies.",
  all: "cała historia",
  custom: "własny",
};

/**
 * Zakres dat całej historii towaru: gotowe okresy i własny przedział od–do. Zmienia tylko widok
 * (zakupy, sprzedaż, ruch towaru) — nic nie zapisuje.
 */
export function ZdHistoryRangeBar({
  value,
  onChange,
  range,
  salesWindow,
  className,
}: {
  value: ZdHistoryRangeState;
  onChange: (next: ZdHistoryRangeState) => void;
  range: ZdHistoryRange;
  salesWindow?: { dataOd: string; dataDo: string } | null;
  className?: string;
}) {
  const today = warsawDateKeyDaysAgo(0);
  const options: SegmentOption<ZdHistoryPreset>[] = [
    ...(salesWindow
      ? [{ value: "window" as const, label: zdMovementWindowLabel(salesWindow), title: "Okno sprzedaży, z którego Kreator liczy zapas" }]
      : []),
    ...(Object.keys(PRESET_LABEL) as Array<keyof typeof PRESET_LABEL>).map((k) => ({ value: k, label: PRESET_LABEL[k] })),
  ];
  return (
    <div className={cn("space-y-2", className)}>
      <SegmentedControl
        density="compact"
        ariaLabel="Zakres historii towaru"
        value={value.preset}
        options={options}
        onChange={(preset) =>
          onChange(
            preset === "custom"
              ? { preset, customFrom: value.customFrom ?? range.from ?? undefined, customTo: value.customTo ?? range.to }
              : { ...value, preset }
          )
        }
      />
      {value.preset === "custom" ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs font-semibold text-slate-600">
            Od
            <Input
              type="date"
              value={range.from ?? ""}
              max={today}
              onChange={(e) => onChange(setZdCustomRangeBound(range, "from", e.target.value))}
              className="mt-1 w-40"
            />
          </label>
          <label className="flex flex-col text-xs font-semibold text-slate-600">
            Do
            <Input
              type="date"
              value={range.to}
              max={today}
              onChange={(e) => onChange(setZdCustomRangeBound(range, "to", e.target.value))}
              className="mt-1 w-40"
            />
          </label>
        </div>
      ) : null}
      <p className="text-xs tabular-nums text-slate-500">
        {formatZdHistoryRange(range)}
        {zdRangeExceedsSalesHistory(range, today) ? " · sprzedaż z Subiekta sięga 12 miesięcy wstecz" : ""}
      </p>
    </div>
  );
}

type FlowSeries = { in: boolean; out: boolean; zd: boolean };

/**
 * Oś przyjęć i rozchodu: przyjęcia (FZ) słupkiem w górę w Petrolu, sprzedaż w dół w szarości, zamówienie ZD
 * kropką u góry. Kliknięcie kolumny zawęża listę pod wykresem do tego tygodnia / miesiąca.
 * HTML zamiast SVG, jak `ZdSalesSparkline`: podpisy mają stały rozmiar przy każdej szerokości.
 */
function ZdFlowChart({
  buckets,
  unit,
  series,
  selected,
  onSelect,
  single = false,
}: {
  buckets: ZdFlowBucket[];
  unit: "week" | "month";
  series: FlowSeries;
  selected: string | null;
  onSelect: (start: string | null) => void;
  /** Tylko sprzedaż: słupki w górę na całą wysokość. */
  single?: boolean;
}) {
  const max = Math.max(1, ...buckets.map((b) => Math.max(series.in ? b.inPieces : 0, series.out ? b.outPieces : 0)));
  const every = Math.max(1, Math.ceil(buckets.length / 8));
  const period = unit === "week" ? "tydzień od" : "miesiąc";
  const pct = (v: number) => `${v > 0 ? Math.max(3, (v / max) * 100) : 0}%`;
  return (
    <div className="mt-2">
      <div className={cn("flex items-stretch gap-px rounded-md border border-slate-200 bg-card p-1", single ? "h-24" : "h-36")}>
        {buckets.map((b) => {
          const isSel = selected === b.start;
          const parts = [
            series.in && b.inPieces > 0 ? `przyjęto ${formatQty(b.inPieces)} szt` : null,
            series.out && b.outPieces > 0 ? `sprzedano ${formatQty(b.outPieces)} szt` : null,
            series.zd && b.zdPieces > 0 ? `zamówiono ${formatQty(b.zdPieces)} szt` : null,
          ].filter(Boolean);
          const label = `${period} ${unit === "week" ? b.label : formatZdMonthHeading(b.start)}: ${parts.length ? parts.join(", ") : "bez ruchu"}`;
          return (
            <button
              key={b.start}
              type="button"
              title={`${label}. Kliknij, żeby pokazać tylko ten ${unit === "week" ? "tydzień" : "miesiąc"}.`}
              aria-label={label}
              aria-pressed={isSel}
              onClick={() => onSelect(isSel ? null : b.start)}
              className={cn(
                "relative flex min-w-0 flex-1 cursor-pointer flex-col rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                isSel ? "bg-indigo-50" : "hover:bg-slate-50"
              )}
            >
              {series.zd && b.zdPieces > 0 ? (
                <span className="absolute left-1/2 top-0.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full border border-indigo-700 bg-card" aria-hidden />
              ) : null}
              {single ? (
                <span className="flex flex-1 flex-col justify-end px-[15%] pt-2">
                  <span className="block rounded-t-sm bg-slate-500" style={{ height: pct(b.outPieces) }} />
                </span>
              ) : (
                <>
                  <span className="flex flex-1 flex-col justify-end px-[15%] pt-2.5">
                    {series.in ? <span className="block rounded-t-sm bg-indigo-600" style={{ height: pct(b.inPieces) }} /> : null}
                  </span>
                  <span className="h-px shrink-0 bg-slate-300" aria-hidden />
                  <span className="flex flex-1 flex-col justify-start px-[15%]">
                    {series.out ? <span className="block rounded-b-sm bg-slate-500" style={{ height: pct(b.outPieces) }} /> : null}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-px px-1" aria-hidden>
        {buckets.map((b, i) => (
          <span key={b.start} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[0.6875rem] tabular-nums text-slate-500">
            {i % every === 0 ? b.label : ""}
          </span>
        ))}
      </div>
      {!single ? (
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          {series.in ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" aria-hidden /> przyjęcia (faktury)
            </span>
          ) : null}
          {series.out ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-500" aria-hidden /> sprzedaż
            </span>
          ) : null}
          {series.zd ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-indigo-700" aria-hidden /> zamówienie ZD
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function SelectedPeriodChip({ start, unit, onClear }: { start: string; unit: "week" | "month"; onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} className={cn(chipClass, panelChoiceChipSelectedClass)} aria-label="Pokaż cały zakres">
      {unit === "week" ? `Tydzień od ${formatDatePlKey(start)}` : formatZdMonthHeading(start)}
      <IconX size={13} aria-hidden />
    </button>
  );
}

/** Ile miesięcy obejmuje zakres sprzedaży (do zdania oceny), najwyżej 12 — tyle sięga Subiekt. */
function salesPeriodMonths(range: ZdHistoryRange): number {
  if (range.from == null) return 12;
  const days = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000 + 1;
  return Math.min(12, Math.max(1, Math.round(days / 30.4)));
}

/** Kto kupuje, wykres sprzedaży i dokumenty — z dokumentów Subiekta (12 mies.), w wybranym zakresie. */
export function ZdProductSalesSections({
  state,
  titleId,
  range,
  expanded = false,
}: {
  state: ZdProductHistoryState;
  titleId: string;
  range: ZdHistoryRange;
  /** Pełny widok: dłuższe listy od razu. */
  expanded?: boolean;
}) {
  const [allCustomers, setAllCustomers] = useState(false);
  const [allDocs, setAllDocs] = useState(false);
  const [customer, setCustomer] = useState<string | null>(null);
  const [role, setRole] = useState<ZdProductSaleRow["rola"] | null>(null);
  const [period, setPeriod] = useState<string | null>(null);
  const sales = state.status === "ok" ? state.sales : null;
  const rows = useMemo(() => (sales?.ok ? sales.rows.filter((r) => isInZdHistoryRange(r.date, range)) : []), [sales, range]);
  const summary = sales?.ok ? summarizeZdProductSales(rows, salesPeriodMonths(range)) : null;
  const flow = useMemo(
    () => bucketZdFlow(rows.map((r) => ({ date: r.date, kind: "out" as const, pieces: r.pieces })), range),
    [rows, range]
  );
  const keyOf = (r: ZdProductSaleRow) => (r.khSymbol.toUpperCase() === "PARAGON" ? "PARAGON" : String(r.khId ?? (r.khSymbol || r.khName)));
  const roleCounts = rows.reduce<Partial<Record<ZdProductSaleRow["rola"], number>>>((m, r) => ((m[r.rola] = (m[r.rola] ?? 0) + 1), m), {});
  // Filtr spoza bieżących danych (inny zakres, inny towar, tydzień → miesiąc) nie działa — inaczej pusta lista bez chipa do zdjęcia.
  const activeCustomer = customer && summary?.allCustomers.some((c) => c.key === customer) ? customer : null;
  const activeRole = role && roleCounts[role] ? role : null;
  const activePeriod = period && flow.buckets.some((b) => b.start === period) ? period : null;
  const docs = rows.filter(
    (r) =>
      (!activeCustomer || keyOf(r) === activeCustomer) &&
      (!activeRole || r.rola === activeRole) &&
      (!activePeriod || zdFlowBucketStart(r.date, flow.unit) === activePeriod)
  );
  const customerLimit = expanded ? 12 : 5;
  const docLimit = expanded ? 40 : 8;
  const customers = summary ? (allCustomers ? summary.allCustomers : summary.allCustomers.slice(0, customerLimit)) : [];
  const customerName = activeCustomer && summary ? summary.allCustomers.find((c) => c.key === activeCustomer)?.name : null;

  if (state.status === "loading") return <Loading>Wczytuję sprzedaż z Subiekta…</Loading>;
  if (state.status === "error") return <Muted tone="amber">Sprzedaż niedostępna: {state.message}</Muted>;
  if (!sales?.ok) return <Muted tone="amber">Sprzedaż niedostępna: {sales?.message}</Muted>;
  if (!summary) return null;

  return (
    <div className="space-y-5">
      <section aria-labelledby={`${titleId}-who`}>
        <p className="text-sm font-medium text-slate-900">{summary.verdict}</p>
        {summary.docs > 0 ? (
          <StatStrip
            items={[
              { label: "Sprzedano", value: `${formatQty(summary.pieces)} szt`, hint: summary.retailPieces > 0 ? `w tym paragony ${formatQty(summary.retailPieces)} szt` : null },
              { label: "Dokumenty", value: summary.docs },
              { label: "Klienci", value: summary.customers },
              { label: "Miesiące ze sprzedażą", value: `${summary.activeMonths} z ${salesPeriodMonths(range)}` },
            ]}
          />
        ) : null}
        {summary.docs > 0 ? (
          <ZdFlowChart buckets={flow.buckets} unit={flow.unit} series={{ in: false, out: true, zd: false }} selected={activePeriod} onSelect={setPeriod} single />
        ) : null}

        {summary.allCustomers.length > 0 ? (
          <>
            <h3 id={`${titleId}-who`} className={cn(headingClass, "mt-4")}>
              Kto kupuje
            </h3>
            <ul className={listClass}>
              {customers.map((c) => {
                const isSel = activeCustomer === c.key;
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      aria-pressed={isSel}
                      title={isSel ? "Pokaż dokumenty wszystkich klientów" : `Pokaż tylko dokumenty: ${c.name}`}
                      onClick={() => setCustomer(isSel ? null : c.key)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
                        isSel ? "bg-indigo-50" : "hover:bg-slate-50"
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-slate-800">{c.name}</span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                            <span className="block h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(2, c.share * 100)}%` }} />
                          </span>
                          <span className="text-xs text-slate-500">
                            {c.docs} dok. · ost. {formatDatePlKey(c.lastDate)}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        <span className="block font-medium text-slate-900">{formatQty(c.pieces)} szt</span>
                        <span className="block text-xs text-slate-500">{Math.round(c.share * 100)}%</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              <ShowMore
                shown={customerLimit}
                total={summary.allCustomers.length}
                expanded={allCustomers}
                onToggle={() => setAllCustomers((v) => !v)}
                noun={["klient", "klientów", "klientów"]}
              />
            </ul>
          </>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <section aria-labelledby={`${titleId}-sales-docs`}>
          <h3 id={`${titleId}-sales-docs`} className={headingClass}>
            Dokumenty sprzedaży
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Rodzaj dokumentu">
            <button type="button" aria-pressed={activeRole == null} onClick={() => setRole(null)} className={cn(chipClass, activeRole == null ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass)}>
              Wszystkie <span className="tabular-nums text-slate-500">{rows.length}</span>
            </button>
            {(Object.keys(ROLE_LABEL) as Array<ZdProductSaleRow["rola"]>)
              .filter((k) => roleCounts[k])
              .map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={activeRole === k}
                  onClick={() => setRole(activeRole === k ? null : k)}
                  className={cn(chipClass, activeRole === k ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass)}
                >
                  {k === "zw" ? "Zwroty" : ROLE_LABEL[k]} <span className="tabular-nums text-slate-500">{roleCounts[k]}</span>
                </button>
              ))}
            {customerName ? (
              <button type="button" onClick={() => setCustomer(null)} className={cn(chipClass, panelChoiceChipSelectedClass)} aria-label={`Usuń filtr klienta ${customerName}`}>
                <span className="max-w-[14rem] truncate">{customerName}</span>
                <IconX size={13} aria-hidden />
              </button>
            ) : null}
            {activePeriod ? <SelectedPeriodChip start={activePeriod} unit={flow.unit} onClear={() => setPeriod(null)} /> : null}
          </div>
          {docs.length === 0 ? (
            <Muted>Brak dokumentów dla wybranych filtrów.</Muted>
          ) : (
            <ul className={listClass}>
              {(allDocs ? docs : docs.slice(0, docLimit)).map((r, i) => (
                <li key={`${r.dokNr}-${i}`} className={rowClass}>
                  <span className="min-w-0 text-slate-700" title={`${r.dokNr} · ${r.khName}`}>
                    <span className="tabular-nums">{formatDatePlKey(r.date)}</span>
                    <span className="ml-2 text-slate-800">{r.khSymbol === "PARAGON" ? "Paragon" : r.khName || r.khSymbol}</span>
                    <span className="ml-2 font-mono text-xs text-slate-500">{saleDocLabel(r.rola, r.dokNr)}</span>
                  </span>
                  <span className={cn("shrink-0 tabular-nums font-medium", r.pieces < 0 ? "text-slate-500" : "text-slate-900")}>
                    {formatQty(r.pieces)} szt
                  </span>
                </li>
              ))}
              <ShowMore shown={docLimit} total={docs.length} expanded={allDocs} onToggle={() => setAllDocs((v) => !v)} noun={["dokument", "dokumenty", "dokumentów"]} />
            </ul>
          )}
          {sales.truncated ? <p className="mt-1.5 text-xs text-slate-500">Subiekt zwrócił pierwsze 1000 pozycji - starsze pominięte.</p> : null}
        </section>
      ) : null}
    </div>
  );
}

const fmtPrice = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Nasze zakupy: wszystkie ZD z tym towarem (także spoza Kreatora), z nocnego odczytu ZD. Data w wierszu to wpis
 * faktury FZ (kiedy towar przyszedł), ZD z datą zamówienia pod spodem; bez FZ — data ZD i „bez faktury”.
 */
export function ZdProductPurchasesSection({
  state,
  titleId,
  unitFor,
  range,
  older,
  onLoadOlder,
  expanded = false,
}: {
  state: ZdProductHistoryState;
  titleId: string;
  /** Jednostka i przeliczenie na sztuki dla linii ZD (towar / strona pary). */
  unitFor: UnitFor;
  range: ZdHistoryRange;
  /** Starsza historia (cała kopia ZD) — gdy wczytana, `state.purchases.rows` już ją zawiera. */
  older?: ZdProductOlderPurchases;
  onLoadOlder?: () => void;
  expanded?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const purchases = state.status === "ok" ? state.purchases : null;
  const olderLoaded = older?.status === "ok";
  const rows = purchases?.ok ? purchases.rows.filter((r) => isInZdHistoryRange(r.date ?? r.fzDate, range)) : [];
  // Jedna jednostka w całej historii → rytm w niej; para / mieszane jednostki → w sztukach.
  const units = rows.map(unitFor);
  const uniform = units.length > 0 && units.every((u) => u.label === units[0]!.label && u.piecesPerUnit === units[0]!.piecesPerUnit);
  const rhythm = rows.length ? summarizeZdProductPurchases(rows, uniform ? undefined : (r) => r.qty * (unitFor(r).piecesPerUnit ?? 1)) : null;
  const typicalUnit = uniform ? units[0]!.label : "szt";
  const total = rows.reduce((s, r) => s + (uniform ? r.qty : r.qty * (unitFor(r).piecesPerUnit ?? 1)), 0);
  const priced = rows.filter((r) => r.priceNet != null).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const firstPrice = priced[0]?.priceNet ?? null;
  const lastPrice = priced[priced.length - 1]?.priceNet ?? null;
  const priceChange = firstPrice && lastPrice && priced.length >= 2 ? (lastPrice - firstPrice) / firstPrice : null;
  const inTransitSince = warsawDateKeyDaysAgo(ZD_IN_TRANSIT_MAX_DAYS);
  const inTransit = rows.filter((r) => !r.fzDate && r.zdDone === false && r.date != null && r.date >= inTransitSince);
  const limit = expanded ? 30 : 6;
  // Zakres starszy niż 12 miesięcy nocnego odczytu: zakupy sprzed niego są w kopii ZD, dociągane na żądanie.
  const needsOlder = !olderLoaded && (range.from == null || range.from < warsawDateKeyDaysAgo(365));

  return (
    <section aria-labelledby={`${titleId}-buy`}>
      <h3 id={`${titleId}-buy`} className="sr-only">
        Nasze zakupy
      </h3>
      {state.status === "loading" ? (
        <Loading>Wczytuję zakupy…</Loading>
      ) : state.status === "error" ? (
        <Muted tone="amber">Historia zakupów niedostępna: {state.message}</Muted>
      ) : !purchases?.ok ? (
        <Muted tone="amber">{purchases?.message}</Muted>
      ) : rows.length === 0 ? (
        <Muted>Brak ZD z tym towarem w wybranym okresie (historia z nocnego odczytu ZD).</Muted>
      ) : (
        <>
          {rhythm && rhythm.count >= 2 ? (
            <p className="text-sm text-slate-800">
              Zwykle {formatQty(rhythm.typicalQty)} {typicalUnit}
              {rhythm.typicalGapDays != null ? ` co ~${rhythm.typicalGapDays} ${polishPluralWord(rhythm.typicalGapDays, "dzień", "dni", "dni")}` : ""} ({rhythm.count} ZD).
            </p>
          ) : null}
          <StatStrip
            items={[
              { label: "Zamówienia ZD", value: rhythm?.count ?? rows.length },
              { label: "Zamówiono", value: `${formatQty(total)} ${typicalUnit}` },
              {
                label: "W drodze",
                value: inTransit.length ? `${inTransit.length} ZD` : "brak",
                hint: inTransit.length ? `${formatQty(inTransit.reduce((s, r) => s + r.qty, 0))} ${typicalUnit}` : null,
              },
              {
                label: "Cena netto",
                value: lastPrice != null ? `${fmtPrice(lastPrice)} zł` : "-",
                hint:
                  priceChange != null && Math.abs(priceChange) >= 0.005 ? (
                    <span className={cn(Math.abs(priceChange) > 0.05 && "font-semibold text-amber-700")}>
                      {priceChange > 0 ? "+" : "−"}
                      {Math.abs(priceChange * 100).toLocaleString("pl-PL", { maximumFractionDigits: 1 })}% od {fmtPrice(firstPrice!)} zł
                    </span>
                  ) : null,
              },
            ]}
          />
          <ul className={cn(listClass, "mt-3")}>
            {(showAll ? rows : rows.slice(0, limit)).map((r) => {
              const u = unitFor(r);
              return (
                <li key={`${r.dokNr}-${r.twId ?? ""}`} className={rowClass}>
                  <span className="min-w-0 text-slate-700">
                    {r.fzDate ? (
                      <span className="block truncate" title="Data wpisu faktury (przyjęcie towaru)">
                        <span className="tabular-nums">{formatDatePlKey(r.fzDate)}</span>
                        {r.fzNr ? <span className="ml-2 font-mono text-xs text-slate-500">{r.fzNr}</span> : null}
                        {(r.fzCount ?? 0) > 1 ? (
                          <span className="ml-1.5 text-xs text-slate-500">
                            +{(r.fzCount ?? 0) - 1} {polishPluralWord((r.fzCount ?? 0) - 1, "kolejna", "kolejne", "kolejnych")}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="block truncate">
                        <span className="tabular-nums">{formatDatePlKey(r.date)}</span>
                        {r.zdDone ? (
                          <span
                            className="ml-1.5 text-xs text-slate-500"
                            title="ZD zrealizowane w Subiekcie, ale faktura nie jest z nim powiązana w kopii dokumentów (np. przez PZ) - daty wpisu nie znamy."
                          >
                            zrealizowane, FZ niepowiązana
                          </span>
                        ) : r.zdDone === false && r.date != null && r.date >= inTransitSince ? (
                          <span className="ml-1.5 text-xs font-medium text-amber-800">w drodze</span>
                        ) : (
                          <span className="ml-1.5 text-xs text-slate-500">bez faktury</span>
                        )}
                      </span>
                    )}
                    {r.dokNr ? (
                      <span className="block truncate text-xs text-slate-500">
                        <span className="font-mono">{r.dokNr}</span>
                        {r.fzDate && r.date ? <span className="tabular-nums"> z {formatDatePlKey(r.date)}</span> : null}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="font-medium text-slate-900">
                      {formatQty(r.qty)} {u.label}
                    </span>
                    {u.piecesPerUnit && u.piecesPerUnit > 1 ? (
                      <span className="ml-1.5 text-xs text-slate-500">= {formatQty(r.qty * u.piecesPerUnit)} szt</span>
                    ) : null}
                    {r.priceNet != null ? <span className="block text-xs text-slate-500">po {fmtPrice(r.priceNet)} zł</span> : null}
                  </span>
                </li>
              );
            })}
            <ShowMore shown={limit} total={rows.length} expanded={showAll} onToggle={() => setShowAll((v) => !v)} noun={["zamówienie", "zamówienia", "zamówień"]} />
          </ul>
        </>
      )}
      {purchases?.ok && onLoadOlder && needsOlder ? (
        <div className="mt-2 text-xs text-slate-600">
          {older?.status === "loading" ? (
            <Loading>Wczytuję starsze zakupy z kopii ZD…</Loading>
          ) : older?.status === "error" ? (
            <span className="text-amber-800">{older.message}</span>
          ) : (
            <button type="button" className={moreButtonClass} onClick={onLoadOlder}>
              Wczytaj starsze zakupy (cała historia ZD z kopii)
            </button>
          )}
        </div>
      ) : olderLoaded && older.truncated ? (
        <p className="mt-1.5 text-xs text-slate-500">Pokazane 500 najnowszych linii ZD - starsze pominięte.</p>
      ) : olderLoaded && older.since ? (
        <p className="mt-1.5 text-xs text-slate-500">Zakupy z kopii ZD od {formatDatePlKey(older.since)}.</p>
      ) : null}
    </section>
  );
}

type MovementKind = ZdMovementEvent["kind"];
const KIND_META: Record<MovementKind, { label: string; chip: string }> = {
  in: { label: "Dostawa", chip: "Dostawy" },
  out: { label: "Sprzedaż", chip: "Sprzedaż" },
  zd: { label: "Zamówienie ZD", chip: "Zamówienia ZD" },
};

function MovementIcon({ kind }: { kind: MovementKind }) {
  const Icon = kind === "in" ? IconPackageCheck : kind === "out" ? IconLogOut : IconClipboardList;
  return (
    <span
      className={cn(
        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
        kind === "in" ? "bg-indigo-50 text-indigo-700" : kind === "out" ? "bg-slate-100 text-slate-700" : "border border-dashed border-slate-300 text-slate-500"
      )}
      aria-hidden
    >
      <Icon size={15} />
    </span>
  );
}

/**
 * Ruch towaru: dostawy (FZ), rozchód (sprzedaż) i zamówienia ZD na jednej osi i w dzienniku po miesiącach.
 * Dostawę wziętą w całości przez jednego klienta i jej sprzedaże widać od razu (zakup pod prośbę).
 * Filtry (rodzaj, klient, kliknięty tydzień / miesiąc) zmieniają tylko widok.
 */
export function ZdProductMovementSection({
  state,
  titleId,
  unitFor,
  range,
  expanded = false,
}: {
  state: ZdProductHistoryState;
  titleId: string;
  unitFor: UnitFor;
  range: ZdHistoryRange;
  expanded?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [kinds, setKinds] = useState<Record<MovementKind, boolean>>({ in: true, out: true, zd: true });
  const [customer, setCustomer] = useState("");
  const [period, setPeriod] = useState<string | null>(null);
  const movement = useMemo(() => {
    if (state.status !== "ok" || !state.purchases.ok || !state.sales.ok) return null;
    const inTransitSince = warsawDateKeyDaysAgo(ZD_IN_TRANSIT_MAX_DAYS);
    const deliveries: ZdMovementDelivery[] = state.purchases.rows.flatMap((r) => {
      const date = onRequestDeliveryDate({ fzDate: r.fzDate, zdDate: r.date });
      if (!date) return [];
      const inTransit = !r.fzDate && r.zdDone === false && (r.date ?? "") >= inTransitSince;
      return [{ date, pieces: r.qty * (unitFor(r).piecesPerUnit ?? 1), dokNr: r.dokNr, fzNr: r.fzNr ?? null, zdDate: r.date, inTransit }];
    });
    const sales: ZdMovementSale[] = state.sales.rows.map((s, i) => ({
      date: s.date,
      dokNr: s.dokNr,
      khKey: onRequestCustomerKey(s, s.dokNr || i),
      khName: s.khSymbol === "PARAGON" ? "Paragon" : s.khName || s.khSymbol || null,
      pieces: s.pieces,
      rola: s.rola,
    }));
    // Zakres w środku: sprzedaż sprzed zakresu nadal dopasowuje dostawę z jego początku (okno −7 dni).
    const m = buildZdProductMovement(deliveries, sales, range.from);
    return { ...m, events: m.events.filter((e) => e.date <= range.to) };
  }, [state, unitFor, range]);

  if (state.status === "loading") return <Loading>Wczytuję ruch towaru…</Loading>;
  if (!movement) return <Muted tone="amber">Ruch towaru niedostępny - brak historii zakupów albo sprzedaży.</Muted>;
  if (movement.events.length === 0) return <Muted>Brak ZD, przyjęć i sprzedaży tego towaru w wybranym okresie.</Muted>;

  const flow = bucketZdFlow(
    movement.events.map((e) => ({ date: e.date, kind: e.kind, pieces: e.pieces })),
    range
  );
  const totals = movement.events.reduce(
    (t, e) => {
      if (e.kind === "in") {
        t.in += e.pieces;
        t.inCount += 1;
      } else if (e.kind === "out") {
        t.out += e.pieces;
        t.outCount += 1;
      } else if (e.inTransit) t.transit += e.pieces;
      else t.zdCount += 1;
      return t;
    },
    { in: 0, inCount: 0, out: 0, outCount: 0, transit: 0, zdCount: 0 }
  );
  const kindCounts = movement.events.reduce<Record<MovementKind, number>>((m, e) => ((m[e.kind] += 1), m), { in: 0, out: 0, zd: 0 });
  const customerOptions = [
    ...movement.events
      .filter((e): e is Extract<ZdMovementEvent, { kind: "out" }> => e.kind === "out" && !!e.khName)
      .reduce((m, e) => m.set(e.khName!, (m.get(e.khName!) ?? 0) + e.pieces), new Map<string, number>()),
  ].sort((a, b) => b[1] - a[1]);
  const activeCustomer = customerOptions.some(([name]) => name === customer) ? customer : "";
  const activePeriod = period && flow.buckets.some((b) => b.start === period) ? period : null;
  const filtered = movement.events.filter(
    (e) =>
      kinds[e.kind] &&
      (!activeCustomer || (e.kind === "out" && e.khName === activeCustomer)) &&
      (!activePeriod || zdFlowBucketStart(e.date, flow.unit) === activePeriod)
  );
  const limit = expanded ? 120 : 24;
  const visible = showAll ? filtered : filtered.slice(0, limit);
  const months: Array<{ key: string; events: ZdMovementEvent[]; in: number; out: number }> = [];
  for (const e of visible) {
    const key = e.date.slice(0, 7);
    let g = months[months.length - 1];
    if (!g || g.key !== key) months.push((g = { key, events: [], in: 0, out: 0 }));
    g.events.push(e);
    if (e.kind === "in") g.in += e.pieces;
    if (e.kind === "out") g.out += e.pieces;
  }
  const summary = formatZdProductMovementSummary(movement);

  return (
    <section aria-labelledby={`${titleId}-movement`}>
      <h3 id={`${titleId}-movement`} className="sr-only">
        Ruch towaru
      </h3>
      <StatStrip
        items={[
          { label: "Przyjęto", value: <span className="text-indigo-700">+{formatQty(totals.in)} szt</span>, hint: `${totals.inCount} ${polishPluralWord(totals.inCount, "dostawa", "dostawy", "dostaw")}` },
          { label: "Sprzedano", value: `−${formatQty(Math.max(0, totals.out))} szt`, hint: `${totals.outCount} ${polishPluralWord(totals.outCount, "dokument", "dokumenty", "dokumentów")}` },
          {
            label: "Różnica",
            value: `${totals.in - totals.out >= 0 ? "+" : "−"}${formatQty(Math.abs(totals.in - totals.out))} szt`,
            hint: "przyjęto minus sprzedano",
          },
          { label: "W drodze", value: totals.transit > 0 ? `${formatQty(totals.transit)} szt` : "brak", hint: totals.transit > 0 ? "ZD bez faktury" : null },
        ]}
      />
      {summary ? <p className="mt-2 text-sm text-slate-800">{summary}</p> : null}
      <ZdFlowChart buckets={flow.buckets} unit={flow.unit} series={kinds} selected={activePeriod} onSelect={setPeriod} />

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Co pokazać">
        {(["in", "out", "zd"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kinds[k]}
            onClick={() => setKinds((cur) => ({ ...cur, [k]: !cur[k] }))}
            className={cn(chipClass, kinds[k] ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass)}
          >
            {KIND_META[k].chip} <span className="tabular-nums text-slate-500">{kindCounts[k]}</span>
          </button>
        ))}
        {activePeriod ? <SelectedPeriodChip start={activePeriod} unit={flow.unit} onClear={() => setPeriod(null)} /> : null}
        {/* Wybrany klient trzyma listę tylko przy jego sprzedaży — wybór musi zostać widoczny, nawet gdy to jedyny klient. */}
        {customerOptions.length > 1 || activeCustomer ? (
          <Select
            aria-label="Klient"
            value={activeCustomer}
            onChange={(e) => setCustomer(e.target.value)}
            className="h-8 w-auto max-w-[16rem] py-0 text-xs max-sm:h-10"
          >
            <option value="">Wszyscy klienci</option>
            {customerOptions.map(([name, pieces]) => (
              <option key={name} value={name}>
                {name} ({formatQty(pieces)} szt)
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <Muted>Brak zdarzeń dla wybranych filtrów.</Muted>
      ) : (
        <div className="mt-2 space-y-3">
          {months.map((m) => (
            <div key={m.key}>
              <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-1">
                <p className="text-xs font-semibold text-slate-700">{formatZdMonthHeading(`${m.key}-01`)}</p>
                <p className="text-xs tabular-nums text-slate-500">
                  {m.in > 0 ? <span className="text-indigo-700">+{formatQty(m.in)}</span> : null}
                  {m.in > 0 && m.out !== 0 ? " · " : null}
                  {m.out !== 0 ? `${m.out > 0 ? "−" : "+"}${formatQty(Math.abs(m.out))}` : null}
                  {m.in > 0 || m.out !== 0 ? " szt" : ""}
                </p>
              </div>
              <ul className="divide-y divide-slate-100">
                {m.events.map((e, i) => {
                  const matched = e.kind === "in" ? e.takenBy != null : e.kind === "out" ? e.fromDelivery != null : false;
                  return (
                    <li key={`${e.kind}-${e.date}-${i}`} className={cn("flex items-start gap-2.5 py-2 text-sm", matched && "-mx-1 rounded-md bg-slate-50 px-1")}>
                      <MovementIcon kind={e.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium text-slate-900">
                            {e.kind === "out" ? (e.khName ?? e.dokNr) : KIND_META[e.kind].label}
                          </span>
                          {e.kind === "zd" && e.inTransit ? <span className="text-xs font-medium text-amber-800">w drodze</span> : null}
                        </span>
                        <span className="block text-xs text-slate-500">
                          <span className="tabular-nums">{formatDatePlKey(e.date)}</span>
                          {e.kind === "zd" && e.dokNr ? <span className="font-mono"> · {e.dokNr}</span> : null}
                          {e.kind === "in" && (e.fzNr || e.dokNr) ? <span className="font-mono"> · {e.fzNr ?? e.dokNr}</span> : null}
                          {e.kind === "out" ? (
                            <>
                              {" · "}
                              <span className="font-mono">{saleDocLabel(e.rola, e.dokNr)}</span>
                            </>
                          ) : null}
                          {e.kind === "zd" && e.gapDays != null ? ` · ${e.gapDays} ${polishPluralWord(e.gapDays, "dzień", "dni", "dni")} po poprzednim ZD` : null}
                        </span>
                        {e.kind === "in" && e.takenBy ? (
                          <span className="block text-xs font-medium text-slate-800">
                            → w {e.takenBy.days} {polishPluralWord(e.takenBy.days, "dzień", "dni", "dni")} wziął {e.takenBy.name} ({formatQty(e.takenBy.pieces)} szt)
                          </span>
                        ) : e.kind === "out" && e.fromDelivery ? (
                          <span className="block text-xs text-slate-500">
                            z dostawy {e.fromDelivery.fzNr ?? e.fromDelivery.dokNr ?? ""}, {e.fromDelivery.days}{" "}
                            {polishPluralWord(e.fromDelivery.days, "dzień", "dni", "dni")} po przyjęciu
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 pt-0.5 text-right tabular-nums",
                          e.kind === "in" ? "font-semibold text-indigo-700" : e.kind === "out" ? (e.pieces < 0 ? "text-slate-500" : "font-semibold text-slate-900") : "text-slate-500"
                        )}
                      >
                        {e.kind === "in" ? "+" : e.kind === "out" ? (e.pieces < 0 ? "+" : "−") : ""}
                        {formatQty(Math.abs(e.pieces))} szt
                        {e.kind === "out" && e.pieces < 0 ? <span className="block text-xs">zwrot</span> : null}
                        {e.kind === "zd" ? <span className="block text-xs">zamówiono</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {filtered.length > limit ? (
            <p className="text-xs text-slate-600">
              <button type="button" className={moreButtonClass} onClick={() => setShowAll((v) => !v)}>
                {showAll
                  ? "Pokaż mniej"
                  : `Pokaż wszystkie (jeszcze ${filtered.length - limit} ${polishPluralWord(filtered.length - limit, "zdarzenie", "zdarzenia", "zdarzeń")})`}
              </button>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
