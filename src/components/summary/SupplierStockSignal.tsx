"use client";

import Link from "next/link";
import { Fragment } from "react";
import { buttonClass } from "@/components/ui/Button";
import { warsawTodayDateKey } from "@/lib/warehouse/delivery-receipts-shared";
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { buildZdEstimateLaunchHref } from "@/lib/orders/zd-estimate-supplier-scope";
import {
  stockWatchHorizonDays,
  stockWatchHorizonExtends,
  stockWatchPrepareZdUsesHorizon,
  stockWatchSignalStale,
  type StockWatchSupplierSignal,
} from "@/lib/stock-watch/signal";
import {
  formatCover,
  formatPln,
  formatRunOutDate,
} from "@/components/stock-watch/stock-watch-format";

type SupplierStockSignals = {
  signals: Record<string, StockWatchSupplierSignal>;
  canPrepareZd: boolean;
};

const SupplierStockSignalsContext = createContext<SupplierStockSignals>({
  signals: {},
  canPrepareZd: false,
});

/** Nocna analiza Braki per dostawca — karty panelu dziennego bez przeciągania propsów. */
export function SupplierStockSignalsProvider({
  signals,
  canPrepareZd,
  children,
}: SupplierStockSignals & { children: ReactNode }) {
  return (
    <SupplierStockSignalsContext.Provider value={{ signals, canPrepareZd }}>
      {children}
    </SupplierStockSignalsContext.Provider>
  );
}

/** Sygnały Braki z kontekstu panelu (np. ostrzeżenie przed masowym „Zamówione”). */
export function useSupplierStockSignals(): SupplierStockSignals {
  return useContext(SupplierStockSignalsContext);
}

/**
 * Ranking „czy jest co zamawiać”: pilne, potem coś skończy się przed dostawą,
 * potem pozycje Do ZD, potem przeanalizowani bez zamówienia, na końcu bez analizy.
 */
export function supplierStockSignalRank(signal: StockWatchSupplierSignal | undefined): number {
  if (!signal) return 0;
  if (signal.criticalCount > 0) return 4;
  if (signal.beforeDeliveryCount > 0) return 3;
  return signal.lineCount > 0 ? 2 : 1;
}

/** Czy jest co zamawiać wg analizy (pokazujemy wtedy „Przygotuj ZD”). */
export function stockSignalHasWork(s: StockWatchSupplierSignal): boolean {
  return s.lineCount > 0 || s.criticalCount > 0 || s.beforeDeliveryCount > 0;
}

/** Filtr panelu Braki na jednego dostawcę. */
export function brakiSupplierHref(supplierId: string): string {
  return `/zakupy/braki?dostawca=${encodeURIComponent(supplierId)}`;
}

/** „2 pilne” (pozycje: pilna / pilne / pilnych). */
export function stockSignalUrgentLabel(count: number): string {
  return `${count} ${polishPluralWord(count, "pilna", "pilne", "pilnych")}`;
}

/** „Do ZD: 14 poz. · ok. 3 200 zł (+2 bez ceny)”. */
export function stockSignalOrderSummary(s: StockWatchSupplierSignal): string {
  let out = `Do ZD: ${s.lineCount} poz.`;
  if (s.orderValue > 0) out += ` · ok. ${formatPln(s.orderValue)}`;
  if (s.unpricedCount > 0) {
    out += s.orderValue > 0 ? ` (+${s.unpricedCount} bez ceny)` : ` · ${s.unpricedCount} bez ceny`;
  }
  return out;
}

/** „3 towary skończą się przed dostawą”. */
export function stockSignalBeforeDeliveryLabel(count: number): string {
  return `${count} ${polishPluralWord(count, "towar", "towary", "towarów")} ${polishPluralWord(
    count,
    "skończy",
    "skończą",
    "skończy"
  )} się przed dostawą`;
}

/**
 * Ryzyko przed dostawą bez liczenia pilnych drugi raz: licznik „przed dostawą” jest szeroki (obejmuje brak
 * i ≤ 48 h), więc przy pilnych pokazujemy tylko kolejne — „2 pilne · 1 kolejny skończy się przed dostawą”.
 */
export function stockSignalBeforeDeliveryRest(s: Pick<StockWatchSupplierSignal, "criticalCount" | "beforeDeliveryCount">): string | null {
  if (s.beforeDeliveryCount <= 0) return null;
  if (s.criticalCount <= 0) return stockSignalBeforeDeliveryLabel(s.beforeDeliveryCount);
  const rest = s.beforeDeliveryCount - s.criticalCount;
  if (rest <= 0) return null;
  return `${rest} ${polishPluralWord(rest, "kolejny", "kolejne", "kolejnych")} ${polishPluralWord(
    rest,
    "skończy",
    "skończą",
    "skończy"
  )} się przed dostawą`;
}

/** Najkrótszy zapas: symbol (albo nazwa) i „< 1 dzień” / „4 dni” / „brak towaru”. */
export function stockSignalMostUrgent(
  s: StockWatchSupplierSignal
): { label: string; cover: string; full: string } | null {
  const u = s.mostUrgent;
  if (!u) return null;
  const cover = formatCover(
    u.daysOfCover,
    u.daysOfCover != null && u.daysOfCover <= 0 ? "out_of_stock" : "ok"
  );
  const label = u.twSymbol?.trim() || u.twNazwa;
  return { label, cover, full: u.twSymbol ? `${u.twSymbol} - ${u.twNazwa}` : u.twNazwa };
}

/** Dni od dziś (Warszawa) do daty YYYY-MM-DD — liczone na żywo, nie z dnia analizy. */
export function daysFromToday(key: string, todayKey = warsawTodayDateKey()): number | null {
  const diff = Math.round((Date.parse(key) - Date.parse(todayKey)) / 86_400_000);
  return Number.isFinite(diff) ? diff : null;
}

/** „dziś” / „jutro” / „za 9 dni” / „9 dni temu”. */
export function formatDaysAhead(days: number): string {
  if (days === 0) return "dziś";
  if (days === 1) return "jutro";
  if (days === -1) return "wczoraj";
  return days > 0 ? `za ${days} dni` : `${-days} dni temu`;
}

/** Dzień przebiegu analizy (dd.mm, czas warszawski) — do noty o nieaktualności. */
export function stockSignalComputedDay(s: StockWatchSupplierSignal): string | null {
  const t = Date.parse(s.computedAt);
  if (!Number.isFinite(t)) return formatRunOutDate(s.dataDo || null);
  return new Date(t).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Warsaw",
  });
}

export function stockSignalStaleNote(s: StockWatchSupplierSignal): string {
  const day = stockSignalComputedDay(s);
  return day ? `analiza z ${day} - może być nieaktualna` : "analiza może być nieaktualna";
}

/** Tytuł linku „do kolejnej dostawy”. */
export function stockSignalHorizonTitle(s: StockWatchSupplierSignal): string {
  return `Zapas ${s.dniZapasu} d nie wystarczy do kolejnej dostawy (${stockWatchHorizonDays(s) ?? 0} d) - Kreator policzy ilości do kolejnej dostawy.`;
}

const linkClass = "font-semibold text-indigo-700 underline-offset-2 hover:text-indigo-900 hover:underline";

/** „Dostawa ok. 9 dni · kolejne zamówienie 21.10 (za 9 dni)” / „… · zamówienie na żądanie”. */
export function stockSignalScheduleLine(s: StockWatchSupplierSignal, onDemand: boolean): string | null {
  const parts: string[] = [];
  if (s.leadDays != null) {
    parts.push(`Dostawa ok. ${s.leadDays} ${polishPluralWord(s.leadDays, "dzień", "dni", "dni")}`);
  }
  if (onDemand) parts.push("zamówienie na żądanie");
  else if (s.nextOrderDate) {
    const days = daysFromToday(s.nextOrderDate);
    const when = days != null ? ` (${formatDaysAhead(days)})` : "";
    parts.push(`kolejne zamówienie ${formatRunOutDate(s.nextOrderDate)}${when}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Szuflada dostawcy: pełny skrót analizy Braki przy decyzji o zamówieniu.
 * Bez analizy (dostawca bez zakresu) — nic.
 */
export function SupplierStockSummary({
  supplierId,
  onDemand,
  className,
}: {
  supplierId: string;
  onDemand: boolean;
  className?: string;
}) {
  const { signals } = useContext(SupplierStockSignalsContext);
  const s = signals[supplierId];
  if (!s) return null;
  const stale = stockWatchSignalStale(s.computedAt);
  const urgent = stockSignalMostUrgent(s);
  const schedule = stockSignalScheduleLine(s, onDemand);

  return (
    <section
      aria-label="Stan magazynu (analiza Braki)"
      className={cn("rounded-lg border border-slate-200/70 bg-white px-3 py-2.5 text-xs", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-slate-500">Stan magazynu (analiza Braki)</h3>
        <Link href={brakiSupplierHref(supplierId)} className={cn(linkClass, "inline-flex min-h-6 items-center")}>
          Pokaż w Braki
        </Link>
      </div>
      {stockSignalHasWork(s) ? (
        <>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
            {s.criticalCount > 0 ? (
              <span className="rounded-md bg-red-50 px-1.5 text-xs font-medium text-red-800">
                {stockSignalUrgentLabel(s.criticalCount)}
              </span>
            ) : null}
            <span className="font-medium tabular-nums text-slate-800">{stockSignalOrderSummary(s)}</span>
          </p>
          {stockSignalBeforeDeliveryRest(s) ? (
            <p className="mt-0.5 text-red-700">{stockSignalBeforeDeliveryRest(s)}</p>
          ) : null}
          {urgent ? (
            <p className="mt-0.5 truncate text-slate-600" title={urgent.full}>
              Najpilniej {urgent.label} ({urgent.cover})
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-700">
          {stale ? "Brak pozycji Do ZD" : "Stan wystarcza - nic do zamówienia"}
        </p>
      )}
      {schedule ? <p className="mt-0.5 tabular-nums text-slate-500">{schedule}</p> : null}
      {stale ? <p className="mt-0.5 text-amber-800">{stockSignalStaleNote(s)}</p> : null}
    </section>
  );
}


/**
 * Podpowiedź z nocnej analizy Braki w wierszu dostawcy: pilne, Do ZD z wartością,
 * co skończy się przed dostawą, najpilniejszy towar i „Przygotuj ZD”.
 * Bez zakresu w Kreatorze (brak analizy) — nic nie pokazuje.
 */
export function SupplierStockSignal({
  supplierId,
  className,
  hidePrepare = false,
}: {
  supplierId: string;
  className?: string;
  /** Wiersz ma gotowe zamówienie automatu — bez drugiej drogi „Przygotuj ZD” i bez powtórki liczb Do ZD. */
  hidePrepare?: boolean;
}) {
  const { signals, canPrepareZd } = useContext(SupplierStockSignalsContext);
  const s = signals[supplierId];
  if (!s) return null;
  const stale = stockWatchSignalStale(s.computedAt);
  const asOf = s.dataDo
    ? `Nocna analiza Braki - sprzedaż do ${formatRunOutDate(s.dataDo)}.`
    : "Nocna analiza Braki.";

  if (!stockSignalHasWork(s)) {
    return (
      <p
        className={cn("text-xs text-slate-500", className)}
        title={
          stale
            ? `${asOf} ${stockSignalStaleNote(s)}.`
            : `${asOf} Stan i towar w drodze pokrywają zapas - można przesunąć termin.`
        }
      >
        {stale
          ? `Brak pozycji Do ZD · analiza z ${stockSignalComputedDay(s) ?? "-"}`
          : "Stan wystarcza - nic do zamówienia"}
      </p>
    );
  }

  const urgent = stockSignalMostUrgent(s);
  const risk = stockSignalBeforeDeliveryRest(s);
  // Tylko pozycje zagrożone przed dostawą — „Przygotuj ZD” od razu z horyzontem dostawy.
  const prepareWithHorizon = stockWatchPrepareZdUsesHorizon(s);
  const horizon = stockWatchHorizonExtends(s) && s.beforeDeliveryCount > 0 && !prepareWithHorizon;

  // Linia 1 — stan: pilne (link do Braki), kolejne zagrożone przed dostawą, najpilniejszy towar, wiek analizy.
  const status = [
    s.criticalCount > 0 ? (
      <Link
        key="urgent"
        href={brakiSupplierHref(supplierId)}
        className="rounded-md bg-red-50 px-1.5 font-medium text-red-800 transition-colors duration-150 hover:bg-red-100"
        title="Pokaż pilne pozycje w panelu Braki"
      >
        {stockSignalUrgentLabel(s.criticalCount)}
      </Link>
    ) : null,
    risk ? (
      <span key="risk" className="font-medium text-red-700">
        {risk}
      </span>
    ) : null,
    urgent ? (
      <span key="most" className="min-w-0 max-w-full truncate" title={urgent.full}>
        najpilniej {urgent.label} ({urgent.cover})
      </span>
    ) : null,
    // W wierszu tylko data — pełne ostrzeżenie w dymku; przy nieudanej nocy powtarzało się w każdym wierszu.
    stale ? (
      <span key="stale" title={stockSignalStaleNote(s)}>
        analiza z {stockSignalComputedDay(s) ?? "-"}
      </span>
    ) : null,
  ].filter(Boolean);

  return (
    <div className={cn("min-w-0 space-y-1 text-xs", className)}>
      {status.length ? (
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-slate-500" title={asOf}>
          {/* Kropka trzyma się poprzedniego elementu — przy zawinięciu linia nie zaczyna się od „·”. */}
          {status.map((node, i) =>
            i < status.length - 1 ? (
              <span key={i} className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                {node}
                <span aria-hidden className="text-slate-300">
                  ·
                </span>
              </span>
            ) : (
              <Fragment key={i}>{node}</Fragment>
            )
          )}
        </p>
      ) : null}
      {/* Linia 2 — zamówienie: co i za ile, i jedna droga do ZD. Gotowe zamówienie automatu ją zastępuje. */}
      {hidePrepare ? null : (
        <p
          className="flex flex-wrap items-center gap-x-2 gap-y-1"
          title={`${asOf} Liczba pozycji i wartość jak w Kreatorze ZD (ostatnie ceny z ZD).`}
        >
          <Link
            href={brakiSupplierHref(supplierId)}
            className="font-medium tabular-nums text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline"
            title="Pokaż pozycje w panelu Braki"
          >
            {stockSignalOrderSummary(s)}
          </Link>
          {canPrepareZd ? (
            <Link
              href={buildZdEstimateLaunchHref(supplierId, prepareWithHorizon ? { leadTimeHorizon: true } : undefined)}
              className={buttonClass("outline", "sm", "font-semibold max-sm:min-h-10")}
            >
              Przygotuj ZD
            </Link>
          ) : null}
          {canPrepareZd && horizon ? (
            <Link
              href={buildZdEstimateLaunchHref(supplierId, { leadTimeHorizon: true })}
              className={linkClass}
              title={stockSignalHorizonTitle(s)}
              aria-label="Przygotuj ZD do kolejnej dostawy"
            >
              do kolejnej dostawy
            </Link>
          ) : null}
        </p>
      )}
    </div>
  );
}
