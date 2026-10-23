/**
 * Klasy ABC (zysk 12 mies.) × XYZ (zmienność sprzedaży tygodniowej) — spec
 * `docs/integrations/strategia-zakupowa-pl-automatyzacja.md` §3.2. Czyste funkcje, bez I/O.
 * Klasy NIE sterują ilościami (backtest §8.2) — służą KPI, flagom i kolejności przeglądu.
 * Wzorzec: `scripts/backtest-zd-pl/sim.mjs` (`demandStats`, `abcByMargin`).
 */
import type { ZdAbc, ZdXyz } from "@/lib/orders/zd-automat-contract";

export const ZD_XYZ_WEEKS = 52;
/** Sprzedaż w mniej tygodniach = Z; pierwsza sprzedaż bliżej niż tyle tygodni = N (nowość). */
export const ZD_XYZ_MIN_ACTIVE_WEEKS = 13;
const NEW_ITEM_DAYS = ZD_XYZ_MIN_ACTIVE_WEEKS * 7;
const ABC_A_SHARE = 0.8;
const ABC_B_SHARE = 0.95;

export type ZdSaleLine = { date: string; qty: number };

const DAY_MS = 86_400_000;
/** Dni od `from` do `to` (klucze yyyy-mm-dd, bez stref). */
export function zdDayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
}

/** Linie sprzedaży z `GET /orders/zd/estimate/{towarId}` (tylko składnik `sprzedazOkres`). */
export function zdSaleLinesFromEstimateDocs(docs: ReadonlyArray<Record<string, unknown>>): ZdSaleLine[] {
  const out: ZdSaleLine[] = [];
  for (const d of docs) {
    if (d.wSkladnik !== "sprzedazOkres") continue;
    const date = String(d.dok_DataWyst ?? "").slice(0, 10);
    const qty = Number(d.ob_Ilosc);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(qty)) out.push({ date, qty });
  }
  return out;
}

/**
 * 52 tygodnie z zerami przed dniem `asOf` (tydzień 0 = 7 dni kończących się dzień przed `asOf`)
 * i data pierwszej sprzedaży w całym oknie linii (także starszej niż 52 tygodnie).
 * Zwroty (ilość ≤ 0) pomijamy jak w backteście.
 */
export function zdWeeklySales(lines: readonly ZdSaleLine[], asOf: string): { weeks: number[]; firstSale: string | null } {
  const weeks = new Array<number>(ZD_XYZ_WEEKS).fill(0);
  let firstSale: string | null = null;
  for (const l of lines) {
    if (!(l.qty > 0)) continue;
    const back = zdDayDiff(l.date, asOf);
    if (back < 1) continue;
    if (firstSale == null || l.date < firstSale) firstSale = l.date;
    const w = Math.floor((back - 1) / 7);
    if (w < ZD_XYZ_WEEKS) weeks[w] += l.qty;
  }
  return { weeks, firstSale };
}

export type ZdXyzResult = { xyz: ZdXyz; cv: number | null; activeWeeks: number };

/** CV = σ (próbkowe) / średnia z 52 tygodni. X < 0,5; Y 0,5–1,0; Z > 1,0 lub < 13 tygodni ze sprzedażą; N = nowość. */
export function zdClassifyXyz(input: { weeks: readonly number[]; firstSale: string | null; asOf: string }): ZdXyzResult {
  const { weeks } = input;
  const activeWeeks = weeks.filter((q) => q > 0).length;
  const mean = weeks.reduce((a, b) => a + b, 0) / (weeks.length || 1);
  const sd =
    weeks.length > 1 ? Math.sqrt(weeks.reduce((a, q) => a + (q - mean) ** 2, 0) / (weeks.length - 1)) : 0;
  const cv = mean > 0 ? sd / mean : null;
  if (input.firstSale && zdDayDiff(input.firstSale, input.asOf) < NEW_ITEM_DAYS) return { xyz: "N", cv, activeWeeks };
  if (cv == null || activeWeeks < ZD_XYZ_MIN_ACTIVE_WEEKS || cv > 1) return { xyz: "Z", cv, activeWeeks };
  return { xyz: cv < 0.5 ? "X" : "Y", cv, activeWeeks };
}

/**
 * ABC wg zysku w jednej grupie (dostawca): towar, przed którym skumulowany zysk < 80%, to A;
 * < 95% — B; reszta i zysk ≤ 0 — C. Brak w mapie = C.
 */
export function zdClassifyAbcByProfit(rows: ReadonlyArray<{ twId: number; profit: number }>): Map<number, ZdAbc> {
  const out = new Map<number, ZdAbc>();
  const positive = rows.filter((r) => r.profit > 0).sort((a, b) => b.profit - a.profit || a.twId - b.twId);
  const total = positive.reduce((a, r) => a + r.profit, 0);
  let before = 0;
  for (const r of positive) {
    const share = before / total;
    out.set(r.twId, share < ABC_A_SHARE ? "A" : share < ABC_B_SHARE ? "B" : "C");
    before += r.profit;
  }
  for (const r of rows) if (!out.has(r.twId)) out.set(r.twId, "C");
  return out;
}

/** Klasa w użyciu: ręczne nadpisanie wygrywa z policzoną. */
export function zdEffectiveClass(row: {
  abc: ZdAbc;
  xyz: ZdXyz;
  overrideAbc: ZdAbc | null;
  overrideXyz: ZdXyz | null;
}): { abc: ZdAbc; xyz: ZdXyz } {
  return { abc: row.overrideAbc ?? row.abc, xyz: row.overrideXyz ?? row.xyz };
}
