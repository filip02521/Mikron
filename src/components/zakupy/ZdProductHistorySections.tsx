"use client";

import { BrandLoader } from "@/components/ui/BrandLoader";
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
import { warsawDateKeyDaysAgo } from "@/lib/time/warsaw";

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

const SALES_LIST_MAX = 8;
const PURCHASES_LIST_MAX = 6;

const headingClass = "text-xs font-semibold uppercase tracking-wide text-slate-600";
const listClass = "mt-1.5 divide-y divide-slate-100 rounded-md border border-slate-200";
const rowClass = "flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm";

const ROLE_LABEL: Record<ZdProductSaleRow["rola"], string> = {
  fs: "FS",
  pa: "PA",
  wzNiepowiazane: "WZ",
  zw: "Zwrot",
};

function Muted({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "amber" }) {
  return (
    <p className={cn("mt-1.5 text-sm", tone === "amber" ? "text-amber-800" : "text-slate-600")}>{children}</p>
  );
}

function Loading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-center gap-2 text-sm text-slate-600" role="status">
      <BrandLoader size="sm" tile={false} />
      {children}
    </p>
  );
}

/** Kto kupuje + ostatnie sprzedaże — z dokumentów Subiekta (12 mies.). */
export function ZdProductSalesSections({ state, titleId }: { state: ZdProductHistoryState; titleId: string }) {
  const sales = state.status === "ok" ? state.sales : null;
  const summary = sales?.ok ? summarizeZdProductSales(sales.rows) : null;
  return (
    <>
      <section aria-labelledby={`${titleId}-who`}>
        <h3 id={`${titleId}-who`} className={headingClass}>
          Kto kupuje (12 mies.)
        </h3>
        {state.status === "loading" ? (
          <Loading>Wczytuję sprzedaż z Subiekta…</Loading>
        ) : state.status === "error" ? (
          <Muted tone="amber">Sprzedaż niedostępna: {state.message}</Muted>
        ) : !sales?.ok ? (
          <Muted tone="amber">Sprzedaż niedostępna: {sales?.message}</Muted>
        ) : summary ? (
          <>
            <p className="mt-1.5 text-sm font-medium text-slate-900">{summary.verdict}</p>
            {summary.docs > 0 ? (
              <p className="mt-0.5 text-xs tabular-nums text-slate-600">
                {formatQty(summary.pieces)} szt · {summary.docs} dok. · {summary.customers}{" "}
                {summary.customers === 1 ? "klient" : "klientów"}
                {summary.retailPieces > 0 ? ` + paragony ${formatQty(summary.retailPieces)} szt` : ""} ·{" "}
                {summary.activeMonths} z 12 mies.
                {sales.truncated ? " · pokazane pierwsze 1000 pozycji" : ""}
              </p>
            ) : null}
            {summary.top.length > 0 ? (
              <ul className={listClass}>
                {summary.top.map((c) => (
                  <li key={c.key} className={rowClass}>
                    <span className="min-w-0 truncate text-slate-800" title={c.name}>
                      {c.name}
                      <span className="ml-2 text-xs text-slate-500">
                        {c.docs} dok. · ost. {formatDatePlKey(c.lastDate)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium text-slate-900">{formatQty(c.pieces)} szt</span>
                      <span className="ml-1.5 inline-block w-9 text-right text-xs text-slate-500">
                        {Math.round(c.share * 100)}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </section>

      {sales?.ok && sales.rows.length > 0 ? (
        <section aria-labelledby={`${titleId}-sales-docs`}>
          <h3 id={`${titleId}-sales-docs`} className={headingClass}>
            Ostatnie sprzedaże
          </h3>
          <ul className={listClass}>
            {sales.rows.slice(0, SALES_LIST_MAX).map((r, i) => (
              <li key={`${r.dokNr}-${i}`} className={rowClass}>
                <span className="min-w-0 truncate text-slate-700" title={`${r.dokNr} · ${r.khName}`}>
                  <span className="tabular-nums">{formatDatePlKey(r.date)}</span>
                  <span className="ml-2 text-slate-800">{r.khSymbol === "PARAGON" ? "Paragon" : r.khName || r.khSymbol}</span>
                  <span className="ml-2 text-xs text-slate-500">{ROLE_LABEL[r.rola]}</span>
                </span>
                <span className={cn("shrink-0 tabular-nums font-medium", r.pieces < 0 ? "text-slate-500" : "text-slate-900")}>
                  {formatQty(r.pieces)} szt
                </span>
              </li>
            ))}
            {sales.rows.length > SALES_LIST_MAX ? (
              <li className="px-3 py-1.5 text-xs text-slate-500">
                i {sales.rows.length - SALES_LIST_MAX}{" "}
                {polishPluralWord(sales.rows.length - SALES_LIST_MAX, "wcześniejsza", "wcześniejsze", "wcześniejszych")} w ostatnich 12 mies.
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/**
 * Nasze zakupy: wszystkie ZD z tym towarem (także spoza Kreatora), z nocnego odczytu ZD. Data w wierszu to wpis
 * faktury FZ (kiedy towar przyszedł), ZD z datą zamówienia pod spodem; bez FZ — data ZD i „bez faktury”.
 */
export function ZdProductPurchasesSection({
  state,
  titleId,
  unitFor,
}: {
  state: ZdProductHistoryState;
  titleId: string;
  /** Jednostka i przeliczenie na sztuki dla linii ZD (towar / strona pary). */
  unitFor: (row: ZdProductPurchaseRow) => { label: string; piecesPerUnit: number | null };
}) {
  const purchases = state.status === "ok" ? state.purchases : null;
  // Jedna jednostka w całej historii → rytm w niej; para / mieszane jednostki → w sztukach.
  const units = purchases?.ok ? purchases.rows.map(unitFor) : [];
  const uniform = units.length > 0 && units.every((u) => u.label === units[0]!.label && u.piecesPerUnit === units[0]!.piecesPerUnit);
  const rhythm = purchases?.ok
    ? summarizeZdProductPurchases(purchases.rows, uniform ? undefined : (r) => r.qty * (unitFor(r).piecesPerUnit ?? 1))
    : null;
  const typicalUnit = uniform ? units[0]!.label : "szt";
  return (
    <section aria-labelledby={`${titleId}-buy`}>
      <h3 id={`${titleId}-buy`} className={headingClass}>
        Nasze zakupy (12 mies.)
      </h3>
      {state.status === "loading" ? (
        <Loading>Wczytuję zakupy…</Loading>
      ) : state.status === "error" ? (
        <Muted tone="amber">Historia zakupów niedostępna: {state.message}</Muted>
      ) : !purchases?.ok ? (
        <Muted tone="amber">{purchases?.message}</Muted>
      ) : purchases.rows.length === 0 ? (
        <Muted>Brak ZD z tym towarem w ostatnich 12 miesiącach (historia z nocnego odczytu ZD).</Muted>
      ) : (
        <>
          {rhythm && rhythm.count >= 2 ? (
            <p className="mt-1.5 text-sm text-slate-800">
              Zwykle {formatQty(rhythm.typicalQty)} {typicalUnit}
              {rhythm.typicalGapDays != null ? ` co ~${rhythm.typicalGapDays} ${polishPluralWord(rhythm.typicalGapDays, "dzień", "dni", "dni")}` : ""} ({rhythm.count} ZD).
            </p>
          ) : null}
          <ul className={listClass}>
            {purchases.rows.slice(0, PURCHASES_LIST_MAX).map((r) => {
              const u = unitFor(r);
              // Otwarty ZD bez faktury jest „w drodze” tylko przez jakiś czas — starszy to raczej porzucony.
              const inTransitSince = warsawDateKeyDaysAgo(ZD_IN_TRANSIT_MAX_DAYS);
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
                  <span className="shrink-0 tabular-nums">
                    <span className="font-medium text-slate-900">
                      {formatQty(r.qty)} {u.label}
                    </span>
                    {u.piecesPerUnit && u.piecesPerUnit > 1 ? (
                      <span className="ml-1.5 text-xs text-slate-500">= {formatQty(r.qty * u.piecesPerUnit)} szt</span>
                    ) : null}
                    {r.priceNet != null ? (
                      <span className="ml-1.5 text-xs text-slate-500">
                        po {r.priceNet.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
            {purchases.rows.length > PURCHASES_LIST_MAX ? (
              <li className="px-3 py-1.5 text-xs text-slate-500">i {purchases.rows.length - PURCHASES_LIST_MAX}{" "}
                {polishPluralWord(purchases.rows.length - PURCHASES_LIST_MAX, "starsza", "starsze", "starszych")}
              </li>
            ) : null}
          </ul>
        </>
      )}
    </section>
  );
}
