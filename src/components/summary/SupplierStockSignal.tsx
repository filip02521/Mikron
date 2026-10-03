"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { buildZdEstimateLaunchHref } from "@/lib/orders/zd-estimate-supplier-scope";
import type { StockWatchSupplierSignal } from "@/lib/stock-watch/data";

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

/** Ranking „czy jest co zamawiać”: braki krytyczne, potem pozycje Do ZD, potem bez analizy. */
export function supplierStockSignalRank(signal: StockWatchSupplierSignal | undefined): number {
  if (!signal) return 0;
  if (signal.criticalCount > 0) return 3;
  return signal.lineCount > 0 ? 2 : 1;
}

const plnFormatter = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });

function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return m && d ? `${d}.${m}` : key;
}

/**
 * „Do ZD: 14 poz. · ok. 3 200 zł · Przygotuj ZD” albo „Nic do zamówienia”.
 * Bez zakresu w Kreatorze (brak analizy) — nic nie pokazuje.
 */
export function SupplierStockSignal({
  supplierId,
  className,
}: {
  supplierId: string;
  className?: string;
}) {
  const { signals, canPrepareZd } = useContext(SupplierStockSignalsContext);
  const s = signals[supplierId];
  if (!s) return null;
  const asOf = s.dataDo ? `Nocna analiza Braki - sprzedaż do ${shortDate(s.dataDo)}.` : "Nocna analiza Braki.";

  if (s.lineCount === 0 && s.criticalCount === 0) {
    return (
      <p
        className={cn("text-[11px] text-slate-500", className)}
        title={`${asOf} Stan i towar w drodze pokrywają zapas - można przesunąć termin.`}
      >
        Nic do zamówienia - stan wystarcza
      </p>
    );
  }

  return (
    <p
      className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]", className)}
      title={`${asOf} Liczba pozycji i wartość jak w Kreatorze ZD (ostatnie ceny z ZD).`}
    >
      {s.criticalCount > 0 ? (
        <span className="rounded-md bg-red-50 px-1.5 font-semibold text-red-700 ring-1 ring-red-200">
          {s.criticalCount} {polishPluralWord(s.criticalCount, "brak", "braki", "braków")}
        </span>
      ) : null}
      <span className="font-medium tabular-nums text-slate-700">
        Do ZD: {s.lineCount} poz.
        {s.orderValue > 0 ? ` · ok. ${plnFormatter.format(Math.round(s.orderValue))} zł` : ""}
      </span>
      {canPrepareZd && s.lineCount > 0 ? (
        <Link
          href={buildZdEstimateLaunchHref(supplierId)}
          className="font-semibold text-indigo-700 hover:text-indigo-900"
        >
          Przygotuj ZD
        </Link>
      ) : null}
    </p>
  );
}
