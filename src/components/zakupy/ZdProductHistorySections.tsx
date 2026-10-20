"use client";

import { formatQty } from "@/lib/orders/zd-estimate-manual";
import {
  formatDatePlKey,
  summarizeZdProductPurchases,
  summarizeZdProductSales,
  type ZdProductPurchaseRow,
  type ZdProductSaleRow,
} from "@/lib/orders/zd-product-history";
import { cn } from "@/lib/cn";

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
          <Muted>Wczytuję sprzedaż z Subiekta…</Muted>
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
                <span className={cn("shrink-0 tabular-nums font-medium", r.pieces < 0 ? "text-red-700" : "text-slate-900")}>
                  {formatQty(r.pieces)} szt
                </span>
              </li>
            ))}
            {sales.rows.length > SALES_LIST_MAX ? (
              <li className="px-3 py-1.5 text-xs text-slate-500">
                i {sales.rows.length - SALES_LIST_MAX} wcześniejszych w ostatnich 12 mies.
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/** Nasze zakupy: wszystkie ZD z tym towarem (także spoza Kreatora), z nocnego odczytu ZD. */
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
  const rhythm = purchases?.ok ? summarizeZdProductPurchases(purchases.rows) : null;
  const typicalUnit = purchases?.ok && purchases.rows[0] ? unitFor(purchases.rows[0]).label : "";
  return (
    <section aria-labelledby={`${titleId}-buy`}>
      <h3 id={`${titleId}-buy`} className={headingClass}>
        Nasze zakupy (ZD, 12 mies.)
      </h3>
      {state.status === "loading" ? (
        <Muted>Wczytuję…</Muted>
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
              {rhythm.typicalGapDays != null ? ` co ~${rhythm.typicalGapDays} dni` : ""} ({rhythm.count} ZD).
            </p>
          ) : null}
          <ul className={listClass}>
            {purchases.rows.slice(0, PURCHASES_LIST_MAX).map((r) => {
              const u = unitFor(r);
              return (
                <li key={`${r.dokNr}-${r.twId ?? ""}`} className={rowClass}>
                  <span className="min-w-0 truncate text-slate-700">
                    <span className="tabular-nums">{formatDatePlKey(r.date)}</span>
                    {r.dokNr ? <span className="ml-2 font-mono text-xs text-slate-500">{r.dokNr}</span> : null}
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
              <li className="px-3 py-1.5 text-xs text-slate-500">i {purchases.rows.length - PURCHASES_LIST_MAX} starszych</li>
            ) : null}
          </ul>
        </>
      )}
    </section>
  );
}
