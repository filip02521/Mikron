/**
 * Arkusze (Excel / CSV) dla odpraw: faktura lub packing list dostawcy oraz lista artykułów
 * z dokumentu (np. Annex A). Rozpoznanie kolumn po nagłówkach PL / EN / DE — bez AI.
 * Czysta logika na wierszach; odczyt pliku w {@link readSpreadsheetRows}.
 */

import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { normalizeArticleCode } from "./customs-clearance";
import { isInvoiceChargeName, parseLooseNumber, type CustomsInputLine } from "./customs-lines";

export type SheetCell = string | number | null;
export type SheetRows = SheetCell[][];

export const SPREADSHEET_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/plain",
]);

export function isSpreadsheetFile(name: string, mime: string): boolean {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ext === "xlsx" || ext === "xls" || ext === "csv" || (SPREADSHEET_MIME.has(mime) && ext !== "txt");
}

/** Stary Excel 97–2003 (BIFF) — packing listy z Chin często tak przychodzą. */
export function isLegacyXls(name: string, mime: string): boolean {
  return name.toLowerCase().endsWith(".xls") || mime === "application/vnd.ms-excel";
}

/** .xls przez SheetJS (exceljs czyta tylko .xlsx); komórki scalone mają wartość tylko w pierwszej. */
/** Mały plik może zadeklarować ogromny zakres arkusza — faktury i packing listy mieszczą się z zapasem. */
const MAX_XLS_ROWS = 20_000;
const MAX_XLS_COLS = 200;

function readLegacyXlsSheets(bytes: Buffer): SheetRows[] {
  const wb = XLSX.read(bytes, {
    type: "buffer",
    sheetRows: MAX_XLS_ROWS,
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
  });
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name]!;
    if (sheet["!ref"]) {
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      range.e.c = Math.min(range.e.c, range.s.c + MAX_XLS_COLS - 1);
      range.e.r = Math.min(range.e.r, range.s.r + MAX_XLS_ROWS - 1);
      sheet["!ref"] = XLSX.utils.encode_range(range);
    }
    return sheet;
  }).map((sheet) =>
    XLSX.utils
      .sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true })
      .map((row) => row.map((c): SheetCell => (typeof c === "number" ? c : c == null ? null : String(c))))
  )
    .filter((rows) => rows.length > 0)
    .sort((a, b) => b.length - a.length);
}

/** Tekst nagłówka bez ogonków, kropek i nadmiarowych spacji. */
function headerKey(cell: SheetCell): string {
  return String(cell ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, " ")
    .trim();
}

type Column = "code" | "name" | "qty" | "price";

/**
 * Wzorce nagłówków (po {@link headerKey}): `exact` — cały nagłówek, `contains` — fragment.
 * `exclude` — nagłówek nie może tego zawierać (np. „Total price” to nie cena jednostkowa).
 */
const HEADER_PATTERNS: Record<Column, { exact: RegExp; contains: RegExp; exclude?: RegExp }> = {
  code: {
    exact:
      /^(kod|code|symbol|sku|ref|ref no|reference|art|art ?nr|art ?no|artikel ?nr|artikelnummer|artikel|bestell ?nr|bestellnummer|item|item ?(no|nr|code|#|number)|part ?(no|nr|number)|p ?n|cat ?no|catalog(ue)? ?(no|number)|nr ?kat(alogowy)?|numer ?katalogowy|nr ?art|indeks|index|product ?(code|no|number)|article ?(no|number|code)|model|order ?(code|no))$/,
    contains:
      /\b(item|article|artikel|part|catalog(ue)?|katalog|product|order|bestell|ref)\b ?(no|nr|number|code|#|nummer)\b|\b(sku|indeks|kod towaru|nr katalogowy|artikelnummer|bestellnummer)\b/,
    exclude: /\b(hs|cn|taric|customs|celn|tariff|ean|barcode|lot|batch|serial|invoice|order date)\b/,
  },
  name: {
    exact:
      /^(nazwa|name|opis|description|desc|bezeichnung|beschreibung|artikelbezeichnung|product|produkt|towar|goods|commodity|designation|item description|nazwa towaru)$/,
    contains: /(description|nazwa|bezeichnung|designation|product name|item name|opis towaru|goods)/,
    exclude: /\b(code|no|nr|number)\b$/,
  },
  qty: {
    exact: /^(ilosc|qty|qnty|quantity|menge|pcs|pieces|szt|sztuk|stk|stuck|anzahl|units?|qnt|q ty|ilosc szt)$/,
    contains: /\b(quantity|ilosc|menge|qty|pieces|anzahl|stuck)\b/,
    exclude: /\b(price|cena|preis|value|wartosc|unit price|carton|box|ctn|kart)\b/,
  },
  price: {
    exact:
      /^(cena|price|unit ?price|price ?per ?unit|preis|einzelpreis|cena ?jedn(ostkowa)?|cena ?netto|net ?price|rate|unit ?cost|unit ?value|u ?price)$/,
    contains: /\b(price|cena|preis|rate|unit value|unit cost)\b/,
    exclude: /\b(total|amount|wartosc|gesamt|sum|suma|razem|line)\b/,
  },
};

function columnScore(key: string, col: Column): number {
  const p = HEADER_PATTERNS[col];
  if (!key || p.exclude?.test(key)) return 0;
  if (p.exact.test(key)) return 2;
  return p.contains.test(key) ? 1 : 0;
}

/** Kod artykułu: zawiera cyfrę, bez spacji w środku po normalizacji, max 40 znaków. */
function looksLikeArticleCode(value: SheetCell): boolean {
  const s = normalizeArticleCode(String(value ?? ""));
  return s.length >= 2 && s.length <= 40 && /\d/.test(s) && !/\s/.test(s);
}

export type InvoiceColumns = {
  header: number;
  code: number | null;
  name: number | null;
  qty: number;
  price: number | null;
};

function bestColumn(keys: string[], col: Column, taken: Set<number>): number {
  let best = -1;
  let bestScore = 0;
  keys.forEach((k, i) => {
    if (taken.has(i)) return;
    const score = columnScore(k, col);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/**
 * Szuka wiersza nagłówka w pierwszych 40 wierszach; nagłówek bywa w dwóch wierszach
 * (np. „Unit” / „Price”) — wtedy łączymy wiersz z następnym.
 */
export function detectInvoiceColumns(rows: SheetRows): InvoiceColumns | null {
  let found: (InvoiceColumns & { score: number }) | null = null;
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const variants: { keys: string[]; header: number }[] = [{ keys: rows[r]!.map(headerKey), header: r }];
    if (rows[r + 1]) {
      const width = Math.max(rows[r]!.length, rows[r + 1]!.length);
      variants.push({
        keys: Array.from({ length: width }, (_, i) => headerKey(`${rows[r]![i] ?? ""} ${rows[r + 1]![i] ?? ""}`)),
        header: r + 1,
      });
    }
    for (const v of variants) {
      const taken = new Set<number>();
      const qty = bestColumn(v.keys, "qty", taken);
      if (qty < 0) continue;
      taken.add(qty);
      const code = bestColumn(v.keys, "code", taken);
      if (code >= 0) taken.add(code);
      const name = bestColumn(v.keys, "name", taken);
      if (name >= 0) taken.add(name);
      if (code < 0 && name < 0) continue;
      const price = bestColumn(v.keys, "price", taken);
      const score =
        columnScore(v.keys[qty]!, "qty") +
        (code >= 0 ? columnScore(v.keys[code]!, "code") : 0) +
        (name >= 0 ? columnScore(v.keys[name]!, "name") : 0) +
        (price >= 0 ? 1 : 0);
      if (!found || score > found.score) {
        found = {
          header: v.header,
          code: code < 0 ? null : code,
          name: name < 0 ? null : name,
          qty,
          price: price < 0 ? null : price,
          score,
        };
      }
    }
    // Pierwszy pełny nagłówek (kod + nazwa + ilość) wystarcza — dalej to już dane.
    if (found && found.code != null && found.name != null && found.score >= 5) break;
  }
  if (!found) return null;
  const { score: _score, ...cols } = found;
  void _score;
  return cols;
}

const TOTAL_ROW = /^(razem|suma|total|subtotal|sub-total|gesamt|summe|sum|grand total|netto razem)\b/i;

/**
 * Ilość: „10 pcs”, „2,5”, separatory tysięcy „1.000” / „1,000” / „1 000”
 * (ilość z dokładnie 3 miejscami po przecinku jest nierealna — traktujemy jako tysiące).
 */
export function parseQuantity(raw: SheetCell): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw ?? "")
    .trim()
    .replace(/\s*[a-z]+\.?$/i, "");
  if (/^\d{1,3}([.,\s\u00a0]\d{3})+$/.test(s)) return Number(s.replace(/[.,\s\u00a0]/g, ""));
  return parseLooseNumber(s);
}

/** „DE-1196 Plaster knife” → kod + nazwa, gdy faktura nie ma osobnej kolumny kodu. */
export function splitCodeFromName(text: string): { code: string; name: string } {
  const m = text.trim().match(/^([A-Za-z]{0,6}[-./]?\d[\w./-]{1,30})\s*[-–:|]?\s+(.+)$/);
  if (m && looksLikeArticleCode(m[1]!)) return { code: normalizeArticleCode(m[1]!), name: m[2]!.trim() };
  return { code: "", name: text.trim() };
}

export type ParsedInvoiceSheet = {
  lines: CustomsInputLine[];
  skipped: number;
  columns: InvoiceColumns;
  /** Nagłówki rozpoznanych kolumn — do pokazania użytkownikowi. */
  headers: { code: string | null; name: string | null; qty: string; price: string | null };
};

/** Pozycje faktury z arkusza. `null` — nie rozpoznano kolumn. */
/** Kolumna nazwy wypełniona w mniej niż połowie wierszy z ilością, a kod w każdym — to scalona grupa. */
function isMergedGroupColumn(rows: SheetRows, cols: { header: number; code: number | null; name: number | null; qty: number }): boolean {
  if (cols.code == null || cols.name == null) return false;
  let withQty = 0;
  let withName = 0;
  let withCode = 0;
  for (const row of rows.slice(cols.header + 1)) {
    if (row.slice(0, 4).some((c) => TOTAL_ROW.test(String(c ?? "").trim()))) break;
    const q = parseQuantity(row[cols.qty] ?? null);
    if (q == null || q <= 0) continue;
    withQty++;
    if (String(row[cols.name] ?? "").trim()) withName++;
    if (String(row[cols.code] ?? "").trim()) withCode++;
  }
  // Kod prawie w każdym wierszu (sumy częściowe bywają bez kodu), nazwa w mniej niż połowie.
  return withQty >= 4 && withCode >= withQty * 0.9 && withName * 2 < withQty;
}

export function parseInvoiceSheet(rows: SheetRows): ParsedInvoiceSheet | null {
  const cols = detectInvoiceColumns(rows);
  if (!cols) return null;
  const headerText = (i: number | null) =>
    i == null ? null : String(rows[cols.header]![i] ?? "").trim() || `kolumna ${i + 1}`;
  const lines: CustomsInputLine[] = [];
  let skipped = 0;
  let emptyRun = 0;
  // Opis w scalonej komórce (Upcera: „Dental Zirconia Ceramic” tylko w pierwszym wierszu grupy, model w P/N)
  // — to grupa, nie nazwa: przenosimy ją w dół, a nazwą pozycji zostaje kod.
  const nameIsGroup = isMergedGroupColumn(rows, cols);
  let group = "";
  for (let r = cols.header + 1; r < rows.length; r++) {
    const row = rows[r]!;
    const text = (i: number | null) => (i == null ? "" : String(row[i] ?? "").trim());
    let code = text(cols.code);
    let name = text(cols.name);
    if (nameIsGroup) {
      if (name) group = name;
      name = "";
    }
    if (!row.some((c) => String(c ?? "").trim())) {
      // Kilka pustych wierszy z rzędu = koniec tabeli (dalej zwykle stopka).
      if (++emptyRun >= 3 && lines.length) break;
      continue;
    }
    emptyRun = 0;
    if (row.slice(0, 4).some((c) => TOTAL_ROW.test(String(c ?? "").trim()))) break;
    const quantity = parseQuantity(row[cols.qty] ?? null);
    if (quantity == null || quantity <= 0 || (!code && !name)) {
      skipped++;
      continue;
    }
    if (!code && cols.code == null) {
      const split = splitCodeFromName(name);
      code = split.code;
      name = split.name;
    }
    // „Shipping fee”, „Freight” — koszt, nie towar do odprawy.
    if (!code && isInvoiceChargeName(name)) {
      skipped++;
      continue;
    }
    lines.push({
      supplierArticleCode: normalizeArticleCode(code),
      supplierName: name || code,
      quantity,
      unitPrice: cols.price == null ? null : parseLooseNumber(String(row[cols.price] ?? "")),
      subiektTwId: null,
      ...(nameIsGroup && group ? { invoiceGroup: group.slice(0, 200) } : {}),
    });
  }
  return {
    lines,
    skipped,
    columns: cols,
    headers: {
      code: headerText(cols.code),
      name: headerText(cols.name),
      qty: headerText(cols.qty)!,
      price: headerText(cols.price),
    },
  };
}

/** Najlepszy arkusz skoroszytu: najwięcej rozpoznanych pozycji. */
export function parseInvoiceWorkbook(sheets: SheetRows[]): ParsedInvoiceSheet | null {
  let best: ParsedInvoiceSheet | null = null;
  for (const rows of sheets) {
    const parsed = parseInvoiceSheet(rows);
    if (parsed && (!best || parsed.lines.length > best.lines.length)) best = parsed;
  }
  return best;
}

/**
 * Lista kodów artykułów z arkusza dokumentu: kolumna z nagłówkiem „kod / art. no …”,
 * a gdy nagłówka brak — kolumna z największą liczbą wartości wyglądających jak kody.
 */
export function parseArticleCodesSheet(rows: SheetRows): { code: string; description: string }[] {
  let codeCol = -1;
  let nameCol = -1;
  let start = 0;
  for (let r = 0; r < Math.min(rows.length, 30) && codeCol < 0; r++) {
    const keys = rows[r]!.map(headerKey);
    codeCol = bestColumn(keys, "code", new Set());
    if (codeCol >= 0) {
      nameCol = bestColumn(keys, "name", new Set([codeCol]));
      start = r + 1;
    }
  }
  if (codeCol < 0) {
    const width = Math.max(0, ...rows.map((r) => r.length));
    let best = 0;
    for (let c = 0; c < width; c++) {
      const hits = rows.filter((r) => looksLikeArticleCode(r[c] ?? null)).length;
      if (hits > best) {
        best = hits;
        codeCol = c;
      }
    }
    if (codeCol < 0) return [];
  }
  const seen = new Set<string>();
  const out: { code: string; description: string }[] = [];
  for (const row of rows.slice(start)) {
    if (!looksLikeArticleCode(row[codeCol] ?? null)) continue;
    const code = normalizeArticleCode(String(row[codeCol]));
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ code, description: nameCol >= 0 ? String(row[nameCol] ?? "").trim().slice(0, 300) : "" });
  }
  return out;
}

/** CSV: separator wykrywany z pierwszych wierszy (; , tab), cudzysłowy obsłużone. */
export function parseCsv(text: string): SheetRows {
  const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
  const sep = ["\t", ";", ","].reduce((a, b) => (sample.split(b).length > sample.split(a).length ? b : a));
  const rows: SheetRows = [];
  let row: SheetCell[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function cellValue(v: ExcelJS.CellValue): SheetCell {
  if (v == null) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    if ("result" in v && v.result != null) return cellValue(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
  }
  return String(v);
}

/** Arkusze pliku: XLSX — wszystkie arkusze (największy pierwszy); CSV — jeden, tekst UTF-8. */
export async function readSpreadsheetSheets(bytes: Buffer, fileName: string): Promise<SheetRows[]> {
  if (fileName.toLowerCase().endsWith(".csv")) {
    return [parseCsv(decodeCsvBytes(bytes))];
  }
  if (isLegacyXls(fileName, "")) return readLegacyXlsSheets(bytes);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return [...wb.worksheets]
    .sort((a, b) => b.actualRowCount - a.actualRowCount)
    .map((sheet) => {
      const rows: SheetRows = [];
      sheet.eachRow({ includeEmpty: true }, (row) => {
        const values = row.values as ExcelJS.CellValue[];
        rows.push(values.slice(1).map(cellValue));
      });
      return rows;
    })
    .filter((rows) => rows.length > 0);
}

/** Pierwszy (największy) arkusz. */
export async function readSpreadsheetRows(bytes: Buffer, fileName: string): Promise<SheetRows> {
  return (await readSpreadsheetSheets(bytes, fileName))[0] ?? [];
}

/** CSV z Excela bywa w UTF-8 (z BOM) albo Windows-1250 — wybieramy czytelne. */
export function decodeCsvBytes(bytes: Buffer): string {
  const utf8 = bytes.toString("utf8").replace(/^\uFEFF/, "");
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("windows-1250").decode(bytes);
  } catch {
    return utf8;
  }
}

/** Arkusz jako CSV (dla AI, gdy kolumn nie rozpoznano), max ~400 wierszy. */
export function sheetRowsToCsv(rows: SheetRows, maxRows = 400): string {
  return rows
    .slice(0, maxRows)
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}
