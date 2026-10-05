/**
 * Cennik dostawcy vs ceny w Subiekcie — czysta logika (bez I/O).
 *
 * Mapowanie poziomów: kartotekowa (poziom 0) = cena zakupu z cennika (np. „Cena Dealer netto”),
 * detaliczna (poziom 4) = cena detaliczna z cennika — obie dokładnie z pliku, bez narzutów.
 */

import { headerKey, type SheetCell, type SheetRows } from "@/lib/customs/customs-spreadsheet";
import { parseLooseNumber } from "@/lib/customs/customs-lines";

export type PriceListColumn = "symbol" | "name" | "purchase" | "retail" | "discount" | "vat" | "validFrom";

export type PriceListColumns = { header: number } & Record<PriceListColumn, number | null>;

export const PRICE_LIST_COLUMN_LABEL: Record<PriceListColumn, string> = {
  symbol: "Numer katalogowy",
  name: "Nazwa",
  purchase: "Cena zakupu netto (kartotekowa)",
  retail: "Cena detaliczna netto",
  discount: "Upust % (nasza marża)",
  vat: "VAT",
  validFrom: "Ważny od",
};

/** Wzorce po {@link headerKey} (małe litery, bez ogonków). `exclude` wygrywa. */
const PATTERNS: Record<PriceListColumn, { match: RegExp; exclude?: RegExp }> = {
  symbol: {
    match:
      /^(numer katalogowy|nr katalogowy|nr kat|numer kat|indeks|index|symbol|kod|kod produktu|kod towaru|code|sku|ref|reference|art ?nr|art ?no|artikelnummer|article( no| number| code)?|item( no| number| code)?|catalog(ue)? (no|number)|cat no|material( no| number))$|katalog/,
    exclude: /taryf|celn|customs|ean|hierarch|barcode/,
  },
  name: {
    // „name” / „opis” tylko na początku nagłówka (np. „Name”, „Opis towaru”); nazwa / description / bezeichnung gdziekolwiek.
    match: /(?:^(?:name|opis)\b|nazwa|description|bezeichnung)/,
    exclude: /\b(kod|code|no|nr|number)$/,
  },
  purchase: {
    match: /\b(dealer|zakup\w*|purchase|hurt\w*|dystrybutor\w*|distributor|dealer price|net net)\b/,
    exclude: /brutto|gross|upust|rabat|discount|wartosc/,
  },
  retail: {
    match: /\b(detal\w*|retail|cennikow\w*|katalogow\w*|list price|uvp)\b/,
    exclude: /brutto|gross|upust|rabat|discount|wartosc/,
  },
  discount: { match: /^(upust|rabat|rabatt|discount|marza)\b/ },
  vat: { match: /^(vat|stawka vat|vat rate|mwst|tax)$/ },
  validFrom: { match: /^(wazny od|obowiazuje od|valid from|gultig ab|data od)$/ },
};

const COLUMNS = Object.keys(PATTERNS) as PriceListColumn[];

function matches(key: string, col: PriceListColumn): boolean {
  const p = PATTERNS[col];
  return Boolean(key) && p.match.test(key) && !p.exclude?.test(key);
}

/**
 * Nagłówek w pierwszych 30 wierszach: wymagany numer katalogowy i co najmniej jedna cena.
 * Każda kolumna bierze pierwszy pasujący nagłówek, który nie jest już zajęty.
 */
export function detectPriceListColumns(rows: SheetRows): PriceListColumns | null {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const keys = (rows[r] ?? []).map(headerKey);
    const taken = new Set<number>();
    const found = { header: r } as PriceListColumns;
    for (const col of COLUMNS) {
      const i = keys.findIndex((k, idx) => !taken.has(idx) && matches(k, col));
      found[col] = i < 0 ? null : i;
      if (i >= 0) taken.add(i);
    }
    if (found.symbol != null && (found.purchase != null || found.retail != null)) return found;
  }
  return null;
}

/** Nagłówki pierwszego niepustego wiersza — do komunikatu, gdy kolumn nie rozpoznano. */
export function firstHeaderRow(rows: SheetRows): string[] {
  const row = rows.find((r) => r.some((c) => c != null && String(c).trim() !== ""));
  return (row ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
}

export type PriceListRow = {
  /** Numer wiersza w arkuszu (1-based, jak w Excelu). */
  row: number;
  symbol: string;
  name: string;
  purchase: number | null;
  retail: number | null;
  /** Stawka w procentach (8, 23). */
  vat: number | null;
  /** Upust dostawcy w procentach (36) — to nasza marża: (detal − zakup) / detal. */
  discount: number | null;
};

export function normalizeSymbol(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function priceCell(c: SheetCell | undefined): number | null {
  if (c == null || c === "") return null;
  const n = typeof c === "number" ? c : parseLooseNumber(c);
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

/** 0.08 → 8, „23%” → 23, 8 → 8. */
export function vatPercent(c: SheetCell | undefined): number | null {
  if (c == null || c === "") return null;
  const n = typeof c === "number" ? c : parseLooseNumber(String(c));
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  return n < 1 ? Math.round(n * 10000) / 100 : n;
}

/** Excel serial (46296), ISO (2026-10-01) albo „01.10.2026” → `YYYY-MM-DD`. */
export function dateCell(c: SheetCell | undefined): string | null {
  if (c == null || c === "") return null;
  if (typeof c === "number") {
    if (c < 30000 || c > 80000) return null;
    return new Date(Date.UTC(1899, 11, 30) + c * 86_400_000).toISOString().slice(0, 10);
  }
  const s = String(c).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const pl = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  return pl ? `${pl[3]}-${pl[2]!.padStart(2, "0")}-${pl[1]!.padStart(2, "0")}` : null;
}

export function parsePriceListRows(
  rows: SheetRows,
  cols: PriceListColumns
): { rows: PriceListRow[]; validFrom: string | null } {
  const out: PriceListRow[] = [];
  let validFrom: string | null = null;
  for (let r = cols.header + 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    const symbol = normalizeSymbol(cells[cols.symbol!]);
    if (!symbol) continue;
    const purchase = cols.purchase == null ? null : priceCell(cells[cols.purchase]);
    const retail = cols.retail == null ? null : priceCell(cells[cols.retail]);
    if (purchase == null && retail == null) continue;
    if (!validFrom && cols.validFrom != null) validFrom = dateCell(cells[cols.validFrom]);
    out.push({
      row: r + 1,
      symbol,
      name: cols.name == null ? "" : String(cells[cols.name] ?? "").trim(),
      purchase,
      retail,
      vat: cols.vat == null ? null : vatPercent(cells[cols.vat]),
      discount: cols.discount == null ? null : vatPercent(cells[cols.discount]),
    });
  }
  return { rows: out, validFrom };
}

/** „20x500 g” → 20; „3x2.5g” → 3; brak wielopaku → null. */
function multipack(name: string): number | null {
  const m = name.toLowerCase().match(/(?:^|[^\d.,])(\d{1,3})\s*x\s*\d/);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 1 ? n : null;
}

/**
 * Cennik podaje karton (ProBase „20x500 g”), a towar w Subiekcie to sztuka („500g”):
 * cena z cennika dzielona przez 20. Różne wielopaki po obu stronach → niejasne, bez dzielenia.
 */
export function detectPackFactor(
  listName: string,
  subiektName: string
): { factor: number; unclear: boolean } {
  const list = multipack(listName);
  if (!list) return { factor: 1, unclear: false };
  const sub = multipack(subiektName);
  if (sub == null) return { factor: list, unclear: false };
  return { factor: 1, unclear: sub !== list };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type PriceFlag =
  | "pack"
  | "pack_unclear"
  | "rounded"
  | "suspicious"
  | "old_zero"
  | "vat"
  | "margin"
  | "retail_below_purchase"
  | "duplicate"
  | "unchanged";

export const PRICE_FLAG_LABEL: Record<PriceFlag, string> = {
  pack: "Opakowanie przeliczone",
  pack_unclear: "Opakowanie niejasne",
  rounded: "Zaokrąglono",
  suspicious: "Duża zmiana",
  old_zero: "Brak starej ceny",
  vat: "Inny VAT",
  margin: "Marża ≠ upust",
  retail_below_purchase: "Detal < zakup",
  duplicate: "Duplikat",
  unchanged: "Bez zmian",
};

/** Te flagi zostawiają pozycję odznaczoną — człowiek musi ją zobaczyć i zaznaczyć sam. */
const NEEDS_REVIEW: PriceFlag[] = [
  "pack",
  "pack_unclear",
  "suspicious",
  "old_zero",
  "vat",
  "margin",
  "retail_below_purchase",
  "duplicate",
];

/** Zmiana o tyle razy (w górę albo w dół) = prawie na pewno błąd w pliku, np. przesunięty przecinek. */
export const PRICE_HARD_FACTOR = 5;

/**
 * Twarda blokada zapisu do Subiekta — niezależnie od tego, co zaznaczy użytkownik
 * (serwer sprawdza przy zaznaczaniu i jeszcze raz przy zapisie). null = wolno.
 */
export function priceHardBlock(item: {
  oldPurchase: number | null;
  oldRetail: number | null;
  newPurchase: number | null;
  newRetail: number | null;
}): string | null {
  const levels: [string, number | null, number | null][] = [
    ["kartotekowa", item.oldPurchase, item.newPurchase],
    ["detaliczna", item.oldRetail, item.newRetail],
  ];
  for (const [label, oldV, newV] of levels) {
    if (newV == null) continue;
    if (!Number.isFinite(newV) || newV <= 0) return `Cena ${label} z cennika ≤ 0 — nie zapisano.`;
    if (oldV != null && oldV > 0) {
      const ratio = newV / oldV;
      if (ratio >= PRICE_HARD_FACTOR || ratio <= 1 / PRICE_HARD_FACTOR) {
        return `Cena ${label} zmienia się ${ratio >= 1 ? `${ratio.toFixed(1)}×` : `do ${(ratio * 100).toFixed(0)}%`} — sprawdź plik (przecinek, jednostka). Nie zapisano.`;
      }
    }
  }
  return null;
}

export function needsReview(flags: readonly string[]): boolean {
  return flags.some((f) => NEEDS_REVIEW.includes(f as PriceFlag));
}

export type PriceComparison = {
  packFactor: number;
  newPurchase: number | null;
  newRetail: number | null;
  flags: PriceFlag[];
  selected: boolean;
};

const SAME = 0.005;

export function pctChange(oldValue: number | null, newValue: number | null): number | null {
  if (oldValue == null || newValue == null || oldValue <= 0) return null;
  return ((newValue - oldValue) / oldValue) * 100;
}

/** Marża jak w Subiekcie: (detal − zakup) / detal. */
export function marginPct(purchase: number | null, retail: number | null): number | null {
  if (purchase == null || retail == null || retail <= 0) return null;
  return ((retail - purchase) / retail) * 100;
}

export function comparePrices(input: {
  list: Pick<PriceListRow, "name" | "purchase" | "retail" | "vat"> & { discount?: number | null };
  subiekt: { name: string; purchase: number | null; retail: number | null; vat: number | null };
  thresholdPct: number;
  duplicate?: boolean;
}): PriceComparison {
  const { list, subiekt, thresholdPct } = input;
  const flags: PriceFlag[] = [];
  const pack = detectPackFactor(list.name, subiekt.name);
  if (pack.factor > 1) flags.push("pack");
  if (pack.unclear) flags.push("pack_unclear");

  const scale = (v: number | null) => (v == null ? null : v / pack.factor);
  const rawPurchase = scale(list.purchase);
  const rawRetail = scale(list.retail);
  const newPurchase = rawPurchase == null ? null : round2(rawPurchase);
  const newRetail = rawRetail == null ? null : round2(rawRetail);
  if (
    (rawPurchase != null && Math.abs(rawPurchase - newPurchase!) > 1e-9) ||
    (rawRetail != null && Math.abs(rawRetail - newRetail!) > 1e-9)
  ) {
    flags.push("rounded");
  }

  const levels: [number | null, number | null][] = [
    [subiekt.purchase, newPurchase],
    [subiekt.retail, newRetail],
  ];
  const changing = levels.filter(([o, n]) => n != null && (o == null || Math.abs(n - o) >= SAME));
  if (changing.some(([o]) => o == null || o <= 0)) flags.push("old_zero");
  if (changing.some(([o, n]) => Math.abs(pctChange(o, n) ?? 0) > thresholdPct)) flags.push("suspicious");
  // Upust z cennika = nasza marża; po zaokrągleniu do groszy dopuszczamy 0,1 pp.
  const margin = marginPct(newPurchase, newRetail);
  if (list.discount != null && margin != null && Math.abs(margin - list.discount) > 0.1) flags.push("margin");
  if (list.vat != null && subiekt.vat != null && Math.abs(list.vat - subiekt.vat) >= 0.01) flags.push("vat");
  if (newPurchase != null && newRetail != null && newRetail < newPurchase) flags.push("retail_below_purchase");
  if (input.duplicate) flags.push("duplicate");
  if (changing.length === 0) flags.push("unchanged");

  return {
    packFactor: pack.factor,
    newPurchase,
    newRetail,
    flags,
    selected: changing.length > 0 && !needsReview(flags),
  };
}
