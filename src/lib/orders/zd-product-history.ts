/**
 * Karta produktu w Kreatorze ZD: kto kupuje i jak kupujemy my — dane, których nie ma w tabeli.
 * Czysta logika (bez I/O): sprzedaż dokument po dokumencie i linie naszych ZD.
 */

export type ZdProductSaleRow = {
  rola: "fs" | "pa" | "wzNiepowiazane" | "zw";
  dokNr: string;
  date: string;
  khId: number | null;
  khSymbol: string;
  khName: string;
  /** Sztuki (para: paczki już × przelicznik); ZW ujemne. */
  pieces: number;
};

export type ZdProductPurchaseRow = {
  twId?: number;
  dokNr: string | null;
  /** Data ZD (zamówienie) — rytm zakupów i kropki na wykresie sprzedaży. */
  date: string | null;
  /** Jednostki dokumentu ZD. */
  qty: number;
  priceNet: number | null;
  /** Pierwsza faktura FZ do tego ZD: data wpisu (przyjęcie, bez niej wystawienie) i numer; null = bez FZ. */
  fzDate?: string | null;
  fzNr?: string | null;
  /** Ile faktur do ZD (dostawy częściowe). */
  fzCount?: number;
  /** ZD zrealizowany bez powiązanej FZ (powiązanie przez dokument spoza kopii, np. PZ); null = nie wiadomo. */
  zdDone?: boolean | null;
};

export type ZdProductCustomer = {
  key: string;
  name: string;
  pieces: number;
  /** Udział w sprzedaży netto (0..1). */
  share: number;
  docs: number;
  lastDate: string;
};

export type ZdProductSalesSummary = {
  pieces: number;
  docs: number;
  /** Klienci z kartoteką (bez zbiorczego „PARAGON”). */
  customers: number;
  retailPieces: number;
  activeMonths: number;
  top: ZdProductCustomer[];
  largest: { pieces: number; share: number; name: string; date: string; dokNr: string } | null;
  /** Jedno zdanie do decyzji (na stan / na prośbę). */
  verdict: string;
};

const RETAIL_SYMBOL = "PARAGON";

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function fmt(n: number): string {
  return n.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
}

export function formatDatePlKey(key: string | null): string {
  if (!key || !/^\d{4}-\d{2}-\d{2}/.test(key)) return "-";
  return `${key.slice(8, 10)}.${key.slice(5, 7)}.${key.slice(0, 4)}`;
}

export function summarizeZdProductSales(rows: readonly ZdProductSaleRow[]): ZdProductSalesSummary {
  const byCustomer = new Map<string, ZdProductCustomer>();
  const months = new Set<string>();
  let pieces = 0;
  let retailPieces = 0;
  let docs = 0;
  // Sprzedaż (bez zwrotów) do „największej sprzedaży” — zwrot nie jest dokumentem sprzedaży.
  let largest: ZdProductSalesSummary["largest"] = null;
  for (const r of rows) {
    pieces += r.pieces;
    if (r.pieces <= 0) continue;
    docs += 1;
    if (r.date) months.add(r.date.slice(0, 7));
    const retail = r.khSymbol.toUpperCase() === RETAIL_SYMBOL;
    if (retail) retailPieces += r.pieces;
    const key = retail ? RETAIL_SYMBOL : String(r.khId ?? (r.khSymbol || r.khName));
    const name = retail ? "Paragony (detal)" : r.khName || r.khSymbol || "Bez kontrahenta";
    const c = byCustomer.get(key) ?? { key, name, pieces: 0, share: 0, docs: 0, lastDate: "" };
    c.pieces += r.pieces;
    c.docs += 1;
    if (r.date > c.lastDate) c.lastDate = r.date;
    byCustomer.set(key, c);
    if (!largest || r.pieces > largest.pieces) {
      largest = { pieces: r.pieces, share: 0, name, date: r.date, dokNr: r.dokNr };
    }
  }
  // Zwroty pomniejszają klienta, któremu sprzedano.
  for (const r of rows) {
    if (r.pieces >= 0) continue;
    const key = r.khSymbol.toUpperCase() === RETAIL_SYMBOL ? RETAIL_SYMBOL : String(r.khId ?? (r.khSymbol || r.khName));
    const c = byCustomer.get(key);
    if (c) c.pieces = Math.max(0, c.pieces + r.pieces);
  }
  const net = Math.max(0, pieces);
  const all = [...byCustomer.values()];
  for (const c of all) c.share = net > 0 ? c.pieces / net : 0;
  all.sort((a, b) => b.pieces - a.pieces || b.lastDate.localeCompare(a.lastDate));
  if (largest) largest.share = net > 0 ? largest.pieces / net : 0;
  const customers = all.filter((c) => c.key !== RETAIL_SYMBOL).length;

  const top = all[0];
  let verdict: string;
  if (docs === 0) verdict = "Brak sprzedaży w ostatnich 12 miesiącach.";
  else if (customers <= 2 && top && top.key !== RETAIL_SYMBOL && top.share >= 0.7)
    verdict = `Kupuje głównie ${top.name} (${pct(top.share)}) - kandydat na zamawianie na prośbę.`;
  else if (largest && largest.share >= 0.5)
    verdict = `Jedna sprzedaż to ${pct(largest.share)} roku (${fmt(largest.pieces)} szt, ${largest.name}, ${formatDatePlKey(largest.date)}).`;
  else
    verdict = `Sprzedaż rozproszona: ${customers} ${customers === 1 ? "klient" : "klientów"}${retailPieces > 0 ? " + paragony" : ""}, ${months.size} z 12 miesięcy.`;

  return {
    pieces: net,
    docs,
    customers,
    retailPieces,
    activeMonths: months.size,
    top: all.slice(0, 5),
    largest,
    verdict,
  };
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Rytm zakupów: ile ZD, typowa ilość (jednostki ZD) i typowy odstęp w dniach. */
/**
 * Rytm zakupów: jedno ZD = jeden zakup (para: paczki i sztuki z tego samego ZD sumują się),
 * ilość w jednostce z `qtyOf` (np. sztuki), odstęp między kolejnymi datami ZD.
 */
export function summarizeZdProductPurchases(
  rows: readonly ZdProductPurchaseRow[],
  qtyOf: (row: ZdProductPurchaseRow) => number = (r) => r.qty
): {
  count: number;
  typicalQty: number;
  typicalGapDays: number | null;
} {
  const byDoc = new Map<string, { date: string | null; qty: number }>();
  for (const r of rows) {
    const key = r.dokNr || `${r.date ?? ""}:${r.twId ?? ""}`;
    const cur = byDoc.get(key) ?? { date: r.date, qty: 0 };
    cur.qty += qtyOf(r);
    byDoc.set(key, cur);
  }
  const docs = [...byDoc.values()];
  const dated = [...new Set(docs.filter((d) => d.date).map((d) => Date.parse(`${d.date}T00:00:00Z`)))].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < dated.length; i += 1) gaps.push(Math.round((dated[i]! - dated[i - 1]!) / 86_400_000));
  return {
    count: docs.length,
    typicalQty: median(docs.map((d) => d.qty)),
    typicalGapDays: gaps.length ? Math.round(median(gaps)) : null,
  };
}
