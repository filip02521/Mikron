"use client";

import Link from "next/link";
import { useState } from "react";
import { IconTruck } from "@/components/icons/StrokeIcons";
import { formatRunOutDate } from "@/components/stock-watch/stock-watch-format";
import { daysFromToday, formatDaysAhead } from "@/components/summary/SupplierStockSignal";
import { PageAttentionStrip } from "@/components/ui/PageAttentionStrip";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { warsawTodayDateKey } from "@/lib/warehouse/delivery-receipts-shared";
import { buildZdEstimateLaunchHref } from "@/lib/orders/zd-estimate-supplier-scope";
import type { StockWatchOffPlanSupplier } from "@/lib/stock-watch/data";

const SHOWN_MAX = 6;

const quietLinkClass =
  "inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-amber-900/80 transition-colors hover:text-amber-950 hover:underline";

function planLabel(key: string | null, onDemand: boolean, todayKey: string): string {
  if (!key) return onDemand ? "na żądanie" : "brak terminu planu";
  const day = formatRunOutDate(key) ?? key;
  const diff = daysFromToday(key, todayKey);
  return diff != null ? `plan ${day} · ${formatDaysAhead(diff)}` : `plan ${day}`;
}

/**
 * Panel dzienny: „poza planem” — z nocnej analizy czasu dostaw.
 * Wiersz w grupie uwagi karty: nagłówek jak sąsiednie sygnały, pod nim wyrównana lista dostawców.
 */
export function StockWatchOffPlanBanner({
  suppliers,
  canPrepareZd,
}: {
  suppliers: StockWatchOffPlanSupplier[];
  canPrepareZd: boolean;
}) {
  // Telefon: zwinięte do nagłówka (lista zajmowała pół ekranu nad kolejką dnia).
  const [mobileOpen, setMobileOpen] = useState(false);
  if (suppliers.length === 0) return null;
  const shown = suppliers.slice(0, SHOWN_MAX);
  const hidden = suppliers.length - shown.length;
  const todayKey = warsawTodayDateKey();
  const n = suppliers.length;

  return (
    <section aria-label="Zamówienia poza planem">
      <PageAttentionStrip
        tone="amber"
        edge="row"
        icon={<IconTruck size={17} strokeWidth={2.25} />}
        title={
          <>
            Zamów dziś poza planem u <span className="tabular-nums">{n}</span>{" "}
            {polishPluralWord(n, "dostawcy", "dostawców", "dostawców")}
          </>
        }
        hint="zapas nie wystarczy do planowego zamówienia."
        hintClassName="max-sm:hidden"
        actions={
          <>
            <button
              type="button"
              className={cn(quietLinkClass, "h-9 sm:hidden")}
              aria-expanded={mobileOpen}
              aria-controls="off-plan-suppliers"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? "Zwiń" : "Pokaż"}
            </button>
          </>
        }
      />
      <ul
        id="off-plan-suppliers"
        className={cn(
          "mx-3 mb-3 divide-y divide-amber-100 rounded-md border border-amber-200/70 bg-card sm:mr-4 sm:ml-[3.625rem]",
          !mobileOpen && "max-sm:hidden"
        )}
      >
        {shown.map((s) => (
          <li
            key={s.supplierId}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-1 text-sm sm:grid-cols-[minmax(0,1fr)_5.5rem_9.5rem_auto]"
          >
            <span className="col-start-1 row-start-1 min-w-0 break-words font-medium text-slate-900">
              {s.supplierName}
            </span>
            <span className="col-start-1 row-start-2 flex flex-wrap gap-x-2 text-xs sm:contents sm:text-sm">
              <span className="tabular-nums font-semibold text-amber-900 sm:col-start-2 sm:row-start-1">
                {s.count} {polishPluralWord(s.count, "towar", "towary", "towarów")}
              </span>
              <span className="tabular-nums text-slate-500 sm:col-start-3 sm:row-start-1">
                {planLabel(s.nextOrderDate, s.onDemand, todayKey)}
              </span>
            </span>
            {canPrepareZd ? (
              <Link
                href={buildZdEstimateLaunchHref(s.supplierId, { leadTimeHorizon: true })}
                className="col-start-2 row-span-2 row-start-1 inline-flex min-h-9 items-center gap-0.5 justify-self-end rounded-md px-1.5 text-xs font-medium text-indigo-700 transition-colors hover:text-indigo-900 hover:underline sm:col-start-4 sm:row-span-1 sm:min-h-7"
                title="Kreator ZD z ilościami do kolejnej dostawy"
                aria-label={`Przygotuj ZD: ${s.supplierName}`}
              >
                Przygotuj ZD
                <LinkChevron size={13} />
              </Link>
            ) : null}
          </li>
        ))}
        <li className="flex justify-end px-1.5 py-0.5">
          <Link href="/zakupy/braki" className={cn(quietLinkClass, "h-7 text-indigo-700 hover:text-indigo-900")}>
            {hidden > 0 ? `+${hidden} w panelu Braki` : "Wszystkie braki"}
            <LinkChevron size={13} />
          </Link>
        </li>
      </ul>
    </section>
  );
}
