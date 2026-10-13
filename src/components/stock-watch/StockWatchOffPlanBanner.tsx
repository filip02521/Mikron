"use client";

import Link from "next/link";
import { useState } from "react";
import { IconTruck } from "@/components/icons/StrokeIcons";
import { formatRunOutDate } from "@/components/stock-watch/stock-watch-format";
import { daysFromToday, formatDaysAhead } from "@/components/summary/SupplierStockSignal";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { warsawTodayDateKey } from "@/lib/warehouse/delivery-receipts-shared";
import { buildZdEstimateLaunchHref } from "@/lib/orders/zd-estimate-supplier-scope";
import type { StockWatchOffPlanSupplier } from "@/lib/stock-watch/data";

function planLabel(key: string | null, onDemand: boolean, todayKey: string): string {
  if (!key) return onDemand ? "na żądanie" : "brak terminu planu";
  const day = formatRunOutDate(key) ?? key;
  const diff = daysFromToday(key, todayKey);
  return diff != null ? `plan ${day} (${formatDaysAhead(diff)})` : `plan ${day}`;
}

/**
 * Panel dzienny: „Zamów dziś poza planem” — z nocnej analizy czasu dostaw.
 * Wiersz w grupie uwagi karty (jak pozostałe sygnały), bez własnej ramki.
 */
export function StockWatchOffPlanBanner({
  suppliers,
  canPrepareZd,
}: {
  suppliers: StockWatchOffPlanSupplier[];
  canPrepareZd: boolean;
}) {
  // Telefon: zwinięty do nagłówka (lista zajmowała pół ekranu nad kolejką dnia).
  const [mobileOpen, setMobileOpen] = useState(false);
  if (suppliers.length === 0) return null;
  const shown = suppliers.slice(0, 6);
  const todayKey = warsawTodayDateKey();
  const n = suppliers.length;
  return (
    <section aria-label="Zamów dziś poza planem" className="px-3 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100/90 text-amber-800"
            aria-hidden
          >
            <IconTruck size={17} strokeWidth={2.25} />
          </span>
          <p className="min-w-0 text-sm leading-snug text-slate-800">
            <span className="font-semibold text-amber-950">
              Zamów dziś poza planem: <span className="tabular-nums">{n}</span>{" "}
              {polishPluralWord(n, "dostawca", "dostawcy", "dostawców")}
            </span>
            <span className="text-slate-600 max-sm:hidden">
              {" "}
              - towar skończy się, zanim przyjedzie zamówienie złożone dziś, a planowe zamówienie jest później.
            </span>
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-amber-900/80 hover:text-amber-950 hover:underline sm:hidden"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? "Zwiń" : "Pokaż"}
        </button>
      </div>
      <ul className={cn("mt-2 flex flex-wrap gap-2 sm:pl-[2.625rem]", !mobileOpen && "max-sm:hidden")}>
        {shown.map((s) => (
          <li
            key={s.supplierId}
            className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-amber-200/80 bg-white/90 px-2.5 py-1 text-xs"
          >
            <span className="font-medium text-slate-900">{s.supplierName}</span>
            <span className="tabular-nums text-red-700">
              {s.count} {polishPluralWord(s.count, "towar", "towary", "towarów")}
            </span>
            <span className="text-slate-500">{planLabel(s.nextOrderDate, s.onDemand, todayKey)}</span>
            {canPrepareZd ? (
              <Link
                href={buildZdEstimateLaunchHref(s.supplierId, { leadTimeHorizon: true })}
                className="font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
                title="Kreator ZD z ilościami do kolejnej dostawy"
              >
                Przygotuj ZD
              </Link>
            ) : null}
          </li>
        ))}
        <li className="self-center">
          <Link
            href="/zakupy/braki"
            className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-amber-900/80 hover:text-amber-950 hover:underline"
          >
            {n > shown.length ? `Pokaż wszystkich (${n}) w Braki` : "Panel Braki"}
          </Link>
        </li>
      </ul>
    </section>
  );
}
