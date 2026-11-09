"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { IconAlertCircle, IconPencil } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { OrderInterval } from "@/lib/orders/dates";
import {
  zdCoverageNeed,
  zdIntervalLabel,
  zdNextOrderDistance,
  zdNextOrderFact,
  zdStockDayPresets,
} from "@/lib/orders/zd-estimate-key-facts";
import { zdEstimateScopeKindLabel } from "@/lib/orders/zd-estimate-ui-copy";
import { panelChoiceChipClass, panelChoiceChipIdleClass, panelChoiceChipSelectedClass } from "@/lib/ui/ontime-theme";

const plShort = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}`;
const dayWord = (n: number) => (n === 1 ? "dzień" : "dni");

function Fact({
  label,
  children,
  sub,
  className,
  cellRef,
}: {
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  className?: string;
  cellRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={cellRef} className={cn("min-w-[9rem] flex-1 px-3 py-1.5 xl:border-l xl:border-slate-200 xl:first:border-l-0", className)}>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5 flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.9375rem] font-semibold leading-snug tabular-nums text-slate-900">
        {children}
      </div>
      {sub ? <p className="mt-0.5 text-xs leading-snug text-slate-500">{sub}</p> : null}
    </div>
  );
}

/** Szybka zmiana zapasu: gotowe wartości albo własna liczba dni. Skutek mówi przed zapisem. */
function StockDaysEditor({
  value,
  minDays,
  listComputed,
  alignRight,
  onApply,
  onClose,
}: {
  value: number;
  /** Strategia automatu: mniej dni niż jej cel niczego nie zmienia. */
  minDays: number | null;
  /** Komórka blisko prawej krawędzi ekranu: edytor rozwija się w lewo. */
  alignRight: boolean;
  listComputed: boolean;
  onApply: (days: number) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputId = useId();
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);
  const apply = (raw: string) => {
    const n = Math.round(Number(raw));
    if (!raw.trim() || !Number.isFinite(n) || n < 1 || n > 365) return setError("Podaj od 1 do 365 dni.");
    if (minDays != null && n < minDays) return setError(`Strategia automatu liczy co najmniej ${minDays} dni - mniej nic nie zmieni.`);
    onApply(n);
  };
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Zmień zapas"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          // Esc zamyka tylko ten edytor, nie okna i panele pod nim.
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      className={cn(
        "absolute top-full z-30",
        alignRight ? "right-0" : "left-0",
        " mt-1.5 w-[min(calc(100vw-2rem),20rem)] rounded-lg border border-slate-200 bg-raised p-3 font-normal shadow-[var(--shadow-elevated)]"
      )}
    >
      <p className="text-xs font-semibold text-slate-600">Zapas na ile dni</p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Gotowe wartości">
        {zdStockDayPresets(value)
          .filter((d) => minDays == null || d >= minDays)
          .map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === value}
            onClick={() => apply(String(d))}
            className={cn(panelChoiceChipClass, "min-h-8 px-2.5 py-1 tabular-nums max-sm:min-h-10", d === value ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass)}
          >
            {d} d
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <label htmlFor={inputId} className="flex flex-col text-xs font-semibold text-slate-600">
          Własna liczba dni
          <Input
            id={inputId}
            type="number"
            min={1}
            max={365}
            inputMode="numeric"
            value={draft}
            onChange={(e) => (setDraft(e.target.value), setError(null))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply(draft);
              }
            }}
            className="mt-1 w-24"
            autoFocus
          />
        </label>
        <Button type="button" size="sm" variant="secondary" className="max-sm:min-h-10" onClick={() => apply(draft)}>
          Ustaw
        </Button>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        {listComputed
          ? "Zmiana czyści policzoną listę - potem kliknij „Policz listę” jeszcze raz. Karta dostawcy zostaje bez zmian."
          : "Dotyczy tego liczenia. Karta dostawcy zostaje bez zmian."}
      </p>
    </div>
  );
}

/**
 * Najważniejsze fakty zakresu Kreatora ZD w jednym pasie: zakres, kolejne zamówienie z planu, interwał,
 * zapas (zmiana w miejscu), czas dostawy i okno sprzedaży. Ostrzeżenie pod spodem, gdy zapas nie starczy
 * do przyjazdu kolejnej dostawy.
 */
export function ZdEstimateKeyFactsPanel({
  todayKey,
  scopeMode,
  scopeName,
  supplierId,
  supplierLabel,
  policyChip,
  computedNextDate,
  orderOnDemand,
  interval,
  stockDays,
  stockSub,
  stockDaysMin = null,
  onStockDaysChange,
  canEditStock,
  listComputed,
  leadDays,
  dataOd,
  dataDo,
}: {
  todayKey: string;
  scopeMode: "grupa" | "cecha";
  scopeName: string;
  supplierId: string | null;
  supplierLabel: string | null;
  policyChip?: ReactNode;
  computedNextDate: string | null;
  orderOnDemand: boolean;
  interval: OrderInterval | null;
  stockDays: number;
  /** Skąd zapas (karta, strategia, podniesiony ręcznie). */
  stockSub?: string | null;
  /** Cel strategii automatu: zapas poniżej niego nie zmienia liczenia. */
  stockDaysMin?: number | null;
  onStockDaysChange: (raw: string) => void;
  canEditStock: boolean;
  listComputed: boolean;
  leadDays: number | null;
  dataOd: string;
  dataDo: string;
}) {
  const [editing, setEditing] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const stockCellRef = useRef<HTMLDivElement>(null);
  const hasSupplier = Boolean(supplierId);
  const next = hasSupplier ? zdNextOrderFact({ todayKey, computedNextDate, onDemand: orderOnDemand }) : null;
  const intervalText = zdIntervalLabel(interval);
  const coverage = next ? zdCoverageNeed({ next, interval, leadDays, stockDays }) : null;
  const windowDays = Math.round((Date.parse(dataDo) - Date.parse(dataOd)) / 86_400_000) + 1;
  const setDays = (n: number) => {
    setEditing(false);
    if (n !== stockDays) onStockDaysChange(String(n));
  };

  return (
    <section aria-label="Najważniejsze parametry zamówienia" className="mt-1.5">
      <div className="flex flex-wrap gap-y-1 rounded-lg bg-slate-50 px-1 py-1">
        <Fact
          label={zdEstimateScopeKindLabel(scopeMode)}
          sub={
            <span className="inline-flex flex-wrap items-center gap-x-1">
              {supplierLabel && supplierLabel !== scopeName ? <span>{supplierLabel}</span> : null}
              {hasSupplier ? (
                <Link
                  href={`/zakupy/dostawcy?karta=${supplierId}`}
                  className="font-medium text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:decoration-indigo-700"
                >
                  karta dostawcy
                </Link>
              ) : (
                <span>bez dopasowanego dostawcy</span>
              )}
            </span>
          }
        >
          <span className="min-w-0">{scopeName}</span>
          {policyChip}
        </Fact>

        <Fact
          label="Kolejne zamówienie"
          sub={
            next?.kind === "planned"
              ? zdNextOrderDistance(next.days)
              : next?.kind === "on_demand"
                ? "dostawca na żądanie"
                : next
                  ? "brak daty w harmonogramie"
                  : "wybierz dostawcę"
          }
        >
          {next?.kind === "planned" ? (
            <>
              <span>{next.label}</span>
              {next.days < 0 ? <Badge variant="warning">zaległe</Badge> : next.days === 0 ? <Badge variant="info">dziś</Badge> : null}
            </>
          ) : next?.kind === "on_demand" ? (
            <span>gdy trzeba</span>
          ) : (
            <span className="font-normal text-slate-500">-</span>
          )}
        </Fact>

        <Fact label="Interwał" sub={orderOnDemand ? "bez stałego rytmu" : intervalText ? "z karty dostawcy" : hasSupplier ? "nie ustawiony w karcie" : null}>
          {orderOnDemand ? <span>na żądanie</span> : intervalText ? <span>{intervalText}</span> : <span className="font-normal text-slate-500">-</span>}
        </Fact>

        <Fact label="Zapas" sub={stockSub} className="relative" cellRef={stockCellRef}>
          <span>
            {stockDays} {dayWord(stockDays)}
          </span>
          {canEditStock ? (
            <button
              type="button"
              aria-expanded={editing}
              aria-haspopup="dialog"
              onClick={() => {
                const r = stockCellRef.current?.getBoundingClientRect();
                // 20rem edytora od lewej krawędzi komórki nie może wyjść poza ekran (telefon: komórka w prawej kolumnie).
                setAlignRight(r != null && r.left + 336 > window.innerWidth);
                setEditing((v) => !v);
              }}
              className="inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-indigo-700 transition-colors duration-150 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus max-sm:min-h-10"
            >
              <IconPencil size={13} aria-hidden /> Zmień
            </button>
          ) : null}
          {editing ? (
            <StockDaysEditor value={stockDays} minDays={stockDaysMin} listComputed={listComputed} alignRight={alignRight} onApply={setDays} onClose={() => setEditing(false)} />
          ) : null}
        </Fact>

        <Fact label="Dostawa trwa" sub={leadDays != null ? "zwykle, z historii dostaw" : "brak historii dostaw"}>
          {leadDays != null ? (
            <span>
              ~{leadDays} {dayWord(leadDays)}
            </span>
          ) : (
            <span className="font-normal text-slate-500">-</span>
          )}
        </Fact>

        <Fact label="Okno sprzedaży" sub={Number.isFinite(windowDays) ? `${windowDays} ${dayWord(windowDays)} sprzedaży` : null}>
          <span>
            {plShort(dataOd)}–{plShort(dataDo)}
          </span>
        </Fact>
      </div>

      {coverage?.short ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          <IconAlertCircle size={16} className="shrink-0 text-amber-500" aria-hidden />
          <p className="min-w-0 flex-1">
            <span className="font-medium">Zapas {stockDays} {dayWord(stockDays)} nie starczy do kolejnej dostawy.</span>{" "}
            <span className="text-amber-800">
              Kolejne zamówienie za {coverage.untilNextDays} {dayWord(coverage.untilNextDays)}
              {leadDays != null ? ` + dostawa ~${leadDays} ${dayWord(leadDays)}` : ""} = {coverage.needDays} {dayWord(coverage.needDays)}.
            </span>
          </p>
          {canEditStock ? (
            <Button type="button" size="sm" variant="secondary" className="max-sm:min-h-10" onClick={() => setDays(coverage.needDays)}>
              Ustaw zapas {coverage.needDays} dni
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
