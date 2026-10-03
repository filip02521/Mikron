/**
 * Formularze zamówień dostawców — szablon na dostawcę:
 *  - "pdf"  — PDF z polami (np. Wiedent), towar → pole przez mapę symboli,
 *  - "xlsx" — arkusz z katalogiem (np. Dentsply Sirona), towar → wiersz po kodzie,
 *  - "xlsx-list" — własny arkusz z pozycjami ZD (np. Renfert), bez szablonu dostawcy.
 * Kolejny dostawca = kolejny wpis w SUPPLIER_FORM_TEMPLATES.
 */

export type SupplierFormDate = { day: number; month: number; year: number };

/** Nazwa pliku jak przy ręcznym wysyłaniu (bez rozszerzenia), np. „Renfert 29.09”. */
type FileNameFn = (ctx: { dokNr: string; date: Date; supplierName: string }) => string;

function dayMonth(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export type SupplierPdfFormTemplate = {
  kind: "pdf";
  id: string;
  fileName?: FileNameFn;
  /** Nazwa w UI i w nazwie pliku. */
  label: string;
  /** Dostawca w aplikacji (nazwa). */
  supplierName: RegExp;
  /** Pusty formularz w `data/supplier-forms/`. */
  file: string;
  /** Pola stałe — zawsze tak samo (dane zamawiającego). */
  fixed: Record<string, string>;
  /** Data zamówienia w polach formularza. */
  dateFields: (date: SupplierFormDate) => Record<string, string>;
  /** Pozycje bez miejsca w formularzu trafiają tu (z ostrzeżeniem w UI). */
  notesField: string;
  /** Symbol towaru z Subiekta (normalizowany) → pole formularza. */
  productFields: Record<string, string>;
};

/** Symbol z Subiekta bez różnic w spacjach / wielkości liter („ESTETIC  ORT 2KG”). */
export function normalizeFormSymbol(symbol: string | null | undefined): string {
  return String(symbol ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Wiedent — „Wyroby pomocnicze” (D0725-1). Wypełniane jak zawsze przyjmują:
 * firma / adres / NIP, miejscowość w polu „podpis” (drukuje się przed „dnia”
 * i przy podpisie), data dzień / miesiąc / ostatnia cyfra roku.
 * Uwaga na Estetic Ort: „EO m” = proszek, „EO p” = płyn (sprawdzone na wydruku pól).
 */
const WIEDENT_WYROBY_POMOCNICZE: SupplierPdfFormTemplate = {
  kind: "pdf",
  id: "wiedent-wyroby-pomocnicze",
  label: "Wiedent — wyroby pomocnicze",
  supplierName: /^wiedent\b/i,
  file: "wiedent-wyroby-pomocnicze.pdf",
  fileName: ({ date }) => `Wiedent ${dayMonth(date)}`,
  fixed: {
    "firma lub imię i nazwisko": "Mikran sp. z o.o.",
    adres: "Wojskowa 3/L4 60-072",
    Telefon: "7831008373",
    podpis: "Poznań",
  },
  dateFields: ({ day, month, year }) => ({
    dn: String(day),
    "m-c": String(month),
    // Formularz ma nadrukowane „202…” — wpisujemy ostatnią cyfrę roku.
    rok: String(year % 10),
  }),
  notesField: "uwagi zamwiającgo",
  productFields: {
    // ESTETIC (na gorąco): zestaw 2000/1000, zestaw 500/250, proszek 2000, proszek 500
    "ESTETIC 2/1 10V": "E 10V",
    "ESTETIC 500/250 10V": "E 10V5",
    "ESTETIC 2 10V": "E 10VP",
    "ESTETIC 500 10V": "E 10VP5",
    "ESTETIC 2/1 8V": "E 8V",
    "ESTETIC 500/250 8V": "E 8V5",
    "ESTETIC 2 8V": "E 8VP",
    "ESTETIC 500 8V": "E 8VP5",
    "ESTETIC 2/1 10": "E 10",
    "ESTETIC 500/250 10": "E 105",
    "ESTETIC 2 10": "E 10P",
    "ESTETIC 500 10": "E 10P5",
    "ESTETIC 2/1 8": "E 8",
    "ESTETIC 500/250 8": "E 85",
    "ESTETIC 2 8": "E 8P",
    "ESTETIC 500 8": "E 8P5",
    "ESTETIC 2/1 0": "E 0",
    "ESTETIC 500/250 0": "E 05",
    "ESTETIC 2 0": "E 0P",
    "ESTETIC 500 0": "E 0P5",
    "ESTETIC MONOMER 1L": "E m",
    // Woski, kęski, wały, wzorce
    "WOSK WIEDENT TWARDY": "wmt",
    "WOSK WIEDENT MIĘKKI": "wmm",
    "160": "wkz",
    "WAŁY WIEDENT": "wwz",
    "KOLORNIK WIEDENT": "w",
    "KOLORNIK WIEDENT V": "w V",
    SZAFKA: "szafka",
    // ESTETIC S (100 g / 50 ml)
    "ESTETIC S 100/50 10V": "ES 10V",
    "ESTETIC S 100/50 8V": "ES 8V",
    "ESTETIC S 100/50 10": "ES 10",
    "ESTETIC S 100/50 8": "ES 8",
    "ESTETIC S 100/50 0": "ES 0",
    "ESTETIC S 50ML PŁYN": "ES m",
    // Szczotki tekstylne (wkład metalowy)
    "11": "sz m11",
    "8": "sz m8",
    "6": "sz m6",
    // ESTETIC ORT
    "ESTETIC ORT 2KG/1L Z": "EO",
    "ESTETIC ORT": "EO 5",
    "ESTETIC ORT 2KG": "EO m",
    "ESTETIC ORT 500": "EO m5",
    "ESTETIC ORT 250 ML": "EO p5",
    "ESTETIC ORT KONC.": "EOK",
    // ESTETIC SPECIAL (100 g / 50 ml)
    "ESTETIC SPECIAL G1": "EG1",
    "ESTETIC SPECIAL G2": "EG2",
    "ESTETIC SPECIAL A2": "EA2",
    "ESTETIC SPECIAL N3": "EN3",
    "ESTETIC SPECIAL B3": "EB3",
    "ESTETIC SPECIAL R1": "ER1",
    "ESTETIC SPECIAL R5": "ER5",
    "ESTETIC SPECIAL A1V": "EA1V",
    "ESTETIC SPECIAL A2V": "EA2V",
    "ESTETIC SPECIAL A3V": "EA3V",
    "ESTETIC SPECIAL A4V": "EA4V",
    "ESTETIC SPECIAL B2V": "EB2V",
    "ESTETIC SPECIAL C2V": "EC2V",
    "ESTETIC SPECIAL D3V": "ED3V",
    "ESTETIC SPECIAL MON.": "ESP m",
  },
};

export type SupplierXlsxFormTemplate = {
  kind: "xlsx";
  id: string;
  fileName?: FileNameFn;
  label: string;
  supplierName: RegExp;
  /** Arkusz dostawcy z wyczyszczonymi ilościami w `data/supplier-forms/`. */
  file: string;
  /** Komórki nagłówka (pierwszy arkusz). */
  header: (ctx: { dokNr: string; date: Date }) => Record<string, string | Date>;
  /** Tabela produktów: kod w `codeColumn`, ilość wpisujemy w `qtyColumn`. */
  items: { firstRow: number; lastRow: number; codeColumn: string; qtyColumn: string };
};

export type SupplierXlsxListTemplate = {
  kind: "xlsx-list";
  id: string;
  label: string;
  supplierName: RegExp;
  fileName?: FileNameFn;
  sheetName: string;
  /** Kolumny Lp / Symbol / Nazwa / Ilość — szerokości jak w ręcznie tworzonym pliku. */
  columns: { lp: number; symbol: number; name: number; qty?: number };
};

export type SupplierFormTemplate =
  | SupplierPdfFormTemplate
  | SupplierXlsxFormTemplate
  | SupplierXlsxListTemplate;

/**
 * Renfert — własny arkusz (tak przyjmują zamówienia): Lp | Symbol | Nazwa | Ilość,
 * wszystkie pozycje ZD, kolejność jak „Sortuj A→Z” w Excelu po nazwie.
 * Sprawdzone na ZD 260/M/09/2026 (118 pozycji) z plikiem „Renfert 29.09”.
 */
const RENFERT_LIST: SupplierXlsxListTemplate = {
  kind: "xlsx-list",
  id: "renfert-lista",
  label: "Renfert — lista pozycji (Excel)",
  supplierName: /^renfert\b/i,
  fileName: ({ date }) => `Renfert ${dayMonth(date)}`,
  sheetName: "Arkusz1",
  columns: { lp: 9.140625, symbol: 15.5703125, name: 51.5703125 },
};

/**
 * Sortowanie jak „Sortuj A→Z” w Excelu: bez wielkości liter, myślniki i apostrofy
 * pomijane („O-ring” za „Opal”), spacje liczą się („farb Stain” przed „farbek”).
 */
const excelCollator = new Intl.Collator("pl", { sensitivity: "base" });
export function compareExcelText(a: string, b: string): number {
  const strip = (s: string) => s.trim().replace(/[-'’]/g, "");
  return excelCollator.compare(strip(a), strip(b));
}

/** Symbol z samych cyfr (bez zera na początku) → liczba, jak wpisany w Excelu. */
export function excelSymbolValue(symbol: string | null | undefined): string | number {
  const s = String(symbol ?? "").trim();
  return /^[1-9]\d{0,14}$/.test(s) ? Number(s) : s;
}

/**
 * Dentsply Sirona — „Sales Order Form” (arkusz klienta 200151062, ceny z cennika).
 * PO = numer ZD (walidacja: do 20 znaków), data zamówienia = data ZD; ilości w E,
 * ceny i sumy liczą formuły arkusza (przeliczenie przy otwarciu).
 * Symbol w Subiekcie = kod Dentsply (czasem z dopiskiem: „C202085 48SZT”).
 */
const DENTSPLY_SIRONA_ORDER_FORM: SupplierXlsxFormTemplate = {
  kind: "xlsx",
  id: "dentsply-sirona-order-form",
  label: "Dentsply Sirona — Sales Order Form",
  supplierName: /dentsply\s+sirona/i,
  file: "dentsply-sirona-order-form.xlsx",
  fileName: ({ date }) => `Mikran Sp.Z O.O ${dayMonth(date)} Sirona`,
  header: ({ dokNr, date }) => ({ B8: dokNr, B10: date }),
  items: { firstRow: 13, lastRow: 196, codeColumn: "B", qtyColumn: "E" },
};

export const SUPPLIER_FORM_TEMPLATES: readonly SupplierFormTemplate[] = [
  WIEDENT_WYROBY_POMOCNICZE,
  DENTSPLY_SIRONA_ORDER_FORM,
  RENFERT_LIST,
];

export function findSupplierFormTemplate(supplierName: string | null | undefined): SupplierFormTemplate | null {
  const name = String(supplierName ?? "").trim();
  if (!name) return null;
  return SUPPLIER_FORM_TEMPLATES.find((t) => t.supplierName.test(name)) ?? null;
}

export function getSupplierFormTemplate(id: string): SupplierFormTemplate | null {
  return SUPPLIER_FORM_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Kod produktu z symbolu Subiekta: pierwsze słowo („C202085 48SZT” → „C202085”). */
export function productCodeFromSymbol(symbol: string | null | undefined): string {
  return normalizeFormSymbol(symbol).split(" ")[0] ?? "";
}

/**
 * Pozycje ZD → wiersze arkusza po kodzie. Ten sam kod kilka razy w ZD = suma.
 * `codeRows`: kod (normalizowany) → numer wiersza w arkuszu.
 */
export function matchLinesToCodeRows(
  codeRows: ReadonlyMap<string, number>,
  lines: readonly SupplierFormLine[]
): { qtyByRow: Map<number, number>; mapped: Array<SupplierFormLine & { field: string }>; unmapped: SupplierFormLine[] } {
  const qtyByRow = new Map<number, number>();
  const mapped: Array<SupplierFormLine & { field: string }> = [];
  const unmapped: SupplierFormLine[] = [];
  for (const line of lines) {
    if (!(line.qty > 0)) continue;
    const code = productCodeFromSymbol(line.symbol);
    const row = code ? codeRows.get(code) : undefined;
    if (row == null) {
      unmapped.push(line);
      continue;
    }
    qtyByRow.set(row, (qtyByRow.get(row) ?? 0) + line.qty);
    mapped.push({ ...line, field: code });
  }
  return { qtyByRow, mapped, unmapped };
}

export type SupplierFormLine = { symbol: string | null; name: string; qty: number };

export type SupplierFormFill = {
  values: Record<string, string>;
  mapped: Array<SupplierFormLine & { field: string }>;
  /** Pozycje bez pola w formularzu — w uwagach, do sprawdzenia przed wysłaniem. */
  unmapped: SupplierFormLine[];
};

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pl-PL", { maximumFractionDigits: 3 });
}

/** Pozycje ZD → wartości pól. Ten sam towar kilka razy w ZD = suma. */
export function buildSupplierFormFill(
  template: SupplierPdfFormTemplate,
  lines: readonly SupplierFormLine[],
  date: SupplierFormDate
): SupplierFormFill {
  const byField = new Map<string, number>();
  const mapped: SupplierFormFill["mapped"] = [];
  const unmapped: SupplierFormLine[] = [];
  for (const line of lines) {
    if (!(line.qty > 0)) continue;
    const field = template.productFields[normalizeFormSymbol(line.symbol)];
    if (!field) {
      unmapped.push(line);
      continue;
    }
    byField.set(field, (byField.get(field) ?? 0) + line.qty);
    mapped.push({ ...line, field });
  }
  const values: Record<string, string> = {
    ...template.fixed,
    ...template.dateFields(date),
  };
  for (const [field, qty] of byField) values[field] = formatQty(qty);
  if (unmapped.length > 0) {
    values[template.notesField] = unmapped
      .map((l) => `${l.name}${l.symbol ? ` (${l.symbol})` : ""} — ${formatQty(l.qty)}`)
      .join("; ");
  }
  return { values, mapped, unmapped };
}
