/**
 * Raporty tygodniowe Ivoclar (Sellout + Inventory) — podgląd z Subiekta.
 *
 * Sellout: wyłącznie faktury FS (nie PA, nie WZ).
 * Inventory: towary z cechą Ivoclar, stan bieżący (nie na koniec okresu).
 *
 * API nie zwraca `pa_KodPanstwaISO`. Kraj bierzemy z lokalizacji
 * adresu (format kodu, miasto, VAT, telefon) — patrz `ivoclar-country.ts`.
 * End User specification: zawsze `yes` (sprzedaż do klienta końcowego).
 */

import { addDays, differenceInCalendarDays, endOfMonth, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import {
  classifyPostalShape,
  inferIvoclarCountry,
  type IvoclarCountryConfidence,
  type IvoclarCountryInference,
  type IvoclarCountrySource,
  type IvoclarPostalShape,
} from "@/lib/orders/ivoclar-country";

export {
  IVOCLAR_COUNTRY_SOURCE_LABELS,
  inferIvoclarCountry,
} from "@/lib/orders/ivoclar-country";
export type {
  IvoclarCountryConfidence,
  IvoclarCountrySource,
  IvoclarPostalShape,
} from "@/lib/orders/ivoclar-country";

/** `sl_CechaTw.ctw_Id` dla cechy „Ivoclar” (baza MIKRAN). */
export const IVOCLAR_CECHA_ID = 2738;

export const IVOCLAR_CECHA_NAME = "Ivoclar";

/** Numer klienta Ivoclar w nazwie pliku (procedura). */
export const IVOCLAR_DEALER_NUMBER = "7036494";

/** Inclusive max span for a single sellout pull. */
export const IVOCLAR_MAX_RANGE_DAYS = 31;

/** FS headers beyond this need a narrower date window (detail GET per document). */
export const IVOCLAR_MAX_FS_HEADERS = 1200;

export const IVOCLAR_LIST_PAGE_SIZE = 200;

export const IVOCLAR_FS_DETAIL_CONCURRENCY = 10;

export type IvoclarApiGapCode = "country_iso";

export type IvoclarDataGapCode =
  | "missing_postal"
  | "postal_format"
  | "unknown_country"
  | "country_conflict"
  | "article_suffix"
  | "empty_article";

export type IvoclarInventoryNoteCode = "article_suffix" | "empty_article" | "blocked" | "zero_stock";

export const IVOCLAR_DATA_GAP_LABELS: Record<IvoclarDataGapCode, string> = {
  missing_postal: "Brak kodu pocztowego",
  postal_format: "Nierozpoznany format kodu pocztowego",
  unknown_country: "Nie da się jednoznacznie ustalić kraju",
  country_conflict: "Sprzeczne sygnały kraju (kod vs miasto)",
  article_suffix: "Symbol z dopiskiem — Article z pierwszej liczby",
  empty_article: "Brak numeru artykułu Ivoclar w symbolu",
};

export const IVOCLAR_API_GAP_LABELS: Record<IvoclarApiGapCode, string> = {
  country_iso: "Brak ISO w API Subiekta — kraj nieustalony z adresu",
};

export const IVOCLAR_INVENTORY_NOTE_LABELS: Record<IvoclarInventoryNoteCode, string> = {
  article_suffix: "Symbol z dopiskiem — Article z pierwszej liczby",
  empty_article: "Brak numeru artykułu Ivoclar w symbolu",
  blocked: "Towar zablokowany",
  zero_stock: "Stan 0",
};

export const IVOCLAR_REPORT_COPY = {
  pageTitle: "Raporty Ivoclar",
  pageDescription:
    "Podgląd i eksport xlsx Sellout + Inventory wg procedury Ivoclar. Maila nie wysyłamy z OnTime.",
  sourceNote: "Sprzedaż wyłącznie z faktur FS (bez PA i WZ).",
  inventoryNote: "Stany są bieżące z Subiekta, nie na koniec wybranego okresu. Do pliku Inventory tylko SKU ze stanem > 0.",
  apiGapsTitle: "Kraj z adresu, nie z kartoteki Subiekta",
  apiGapsBody:
    "API nie ma pola ISO kraju. Country bierzemy z lokalizacji na FS: unikalny format kodu (PL: XX-XXX, NL, LT, IE…) i miasto wygrywają z NIP-em i telefonem. Pięć cyfr bez myślnika to nie Polska (CZ/SK/DE). End User specification: zawsze yes.",
  selloutColumnsNote:
    "Kolejność jak w xlsx: Country, Article, Quantity, PostalCode, End User specification, Sub-Dealer name.",
  inventoryColumnsNote: "Kolejność jak w xlsx: Article, Balance.",
  sendScheduleNote:
    "Procedura: każdy poniedziałek do 10:00, poprzedni tydzień, dwa pliki xlsx (bez dodatkowych kolumn).",
  sendToNote:
    "Wyślij na salesdata@ivoclar.com oraz natalia.marcinkowska@ivoclar.com.",
} as const;

export const IVOCLAR_REPORT_EMAILS = [
  "salesdata@ivoclar.com",
  "natalia.marcinkowska@ivoclar.com",
] as const;

/** Nagłówki Sellout — kolejność obowiązkowa z procedury Ivoclar (kolumny A–F). */
export const IVOCLAR_SELLOUT_FILE_COLUMNS = [
  "Country",
  "Article",
  "Quantity",
  "PostalCode",
  "End User specification",
  "Sub-Dealer name",
] as const;

/** Nagłówki Inventory — kolejność obowiązkowa z procedury Ivoclar (kolumny A–B). */
export const IVOCLAR_INVENTORY_FILE_COLUMNS = ["Article", "Balance"] as const;

export type IvoclarEndUserSpec = "yes" | "no";

/** Wartość End User specification we wszystkich wierszach Sellout. */
export const IVOCLAR_END_USER_SPEC: IvoclarEndUserSpec = "yes";

export type IvoclarDateRange = {
  dataOd: string;
  dataDo: string;
};

export type IvoclarArticleParse = {
  raw: string;
  article: string;
  hasSuffix: boolean;
};

export type IvoclarPostalKind = IvoclarPostalShape;

export type IvoclarPostalParse = {
  raw: string;
  kind: IvoclarPostalKind;
  normalized: string | null;
};

export type IvoclarSelloutRow = {
  dokId: number;
  dokNr: string;
  dokDataWyst: string | null;
  khId: number | null;
  khName: string;
  twId: number | null;
  twSymbol: string;
  twNazwa: string;
  article: string;
  quantity: number;
  postalCode: string;
  postalNormalized: string | null;
  suggestedCountry: string | null;
  countrySource: IvoclarCountrySource | null;
  countryConfidence: IvoclarCountryConfidence | null;
  countryConflict: string[];
  dataGaps: IvoclarDataGapCode[];
  apiGaps: IvoclarApiGapCode[];
  /** Plik: zawsze `yes`. Sub-Dealer name zostaje puste. */
  endUser: IvoclarEndUserSpec;
  /** Plik: tylko gdy End User = no — przy stałym yes puste. */
  subDealerName: string;
};

export type IvoclarInventoryRow = {
  twId: number;
  twSymbol: string;
  twNazwa: string;
  groupName: string;
  article: string;
  balance: number;
  reserved: number;
  blocked: boolean;
  notes: IvoclarInventoryNoteCode[];
};

export type IvoclarSelloutSummary = {
  fsHeaderCount: number;
  fsFetchedOk: number;
  fsCancelledSkipped: number;
  fsFetchErrors: number;
  ivoclarLineCount: number;
  skippedNonIvoclarLines: number;
  skippedZeroQtyLines: number;
  skippedExcludedLines: number;
  emptyDetailCount: number;
  rowsWithDataGaps: number;
  rowsWithBlockingDataGaps: number;
  countryResolvedCount: number;
  countryUnknownCount: number;
  countryMissingAddressCount: number;
  countryConflictCount: number;
};

export type IvoclarInventorySummary = {
  skuCount: number;
  zeroStockCount: number;
  blockedCount: number;
  suffixCount: number;
  emptyArticleCount: number;
};

const ARTICLE_TOKEN = /(\d{4,})/g;
const ARTICLE_YEAR = /^(?:19|20)\d{2}$/;

export function parseIvoclarArticle(symbol: string | null | undefined): IvoclarArticleParse {
  const raw = String(symbol ?? "").trim();
  if (!raw) {
    return { raw: "", article: "", hasSuffix: false };
  }
  for (const match of raw.matchAll(ARTICLE_TOKEN)) {
    const article = match[1] ?? "";
    if (article.length === 4 && ARTICLE_YEAR.test(article)) continue;
    return { raw, article, hasSuffix: raw !== article };
  }
  return { raw, article: "", hasSuffix: false };
}

export function normalizeIvoclarTwSymbol(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

const IVOCLAR_EXCLUDED_SYMBOLS = new Set(["TRIPLEX ZESTAW", "PROBASE ZESTAW"]);

export function isIvoclarReportExcludedSymbol(symbol: string | null | undefined): boolean {
  const key = normalizeIvoclarTwSymbol(symbol);
  return IVOCLAR_EXCLUDED_SYMBOLS.has(key);
}

export function isSubiektProductBlocked(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "1" || s === "true" || s === "tak";
  }
  return false;
}

export function isInventoryReviewNote(code: IvoclarInventoryNoteCode): boolean {
  return code === "empty_article" || code === "article_suffix" || code === "blocked";
}

export function selloutRowHasReviewGap(row: IvoclarSelloutRow): boolean {
  return row.dataGaps.length > 0 || row.apiGaps.includes("country_iso");
}

export function classifyIvoclarPostal(rawValue: string | null | undefined): IvoclarPostalParse {
  const parsed = classifyPostalShape(rawValue);
  if (parsed.shape === "pl_hyphen") {
    return { raw: parsed.raw, kind: "pl_hyphen", normalized: parsed.raw };
  }
  if (parsed.shape === "empty") {
    return { raw: "", kind: "empty", normalized: null };
  }
  return { raw: parsed.raw, kind: parsed.shape, normalized: null };
}

export function isCancelledSubiektStatus(statusName: string | null | undefined): boolean {
  return /anulow/i.test(String(statusName ?? ""));
}

export function previousCompleteIsoWeekRange(todayDateKey: string): IvoclarDateRange {
  const today = parseDateOnly(todayDateKey);
  if (!today) {
    throw new Error("Nieprawidłowa data (Warszawa).");
  }
  const thisMonday = startOfWeek(today, { weekStartsOn: 1 });
  const prevMonday = subWeeks(thisMonday, 1);
  return {
    dataOd: formatDateString(prevMonday),
    dataDo: formatDateString(addDays(prevMonday, 6)),
  };
}

export function previousCalendarMonthRange(todayDateKey: string): IvoclarDateRange {
  const today = parseDateOnly(todayDateKey);
  if (!today) {
    throw new Error("Nieprawidłowa data (Warszawa).");
  }
  const prev = subMonths(today, 1);
  return {
    dataOd: formatDateString(startOfMonth(prev)),
    dataDo: formatDateString(endOfMonth(prev)),
  };
}

export type IvoclarParsedRange =
  | { ok: true; dataOd: string; dataDo: string; dayCount: number }
  | { ok: false; error: string };

export function parseIvoclarDateRange(
  dataOdRaw: string,
  dataDoRaw: string
): IvoclarParsedRange {
  const dataOd = parseDateOnly(String(dataOdRaw ?? "").trim());
  const dataDo = parseDateOnly(String(dataDoRaw ?? "").trim());
  if (!dataOd || !dataDo) {
    return { ok: false, error: "Podaj zakres dat w formacie RRRR-MM-DD." };
  }
  if (dataOd.getTime() > dataDo.getTime()) {
    return { ok: false, error: "Data od nie może być późniejsza niż data do." };
  }
  const dayCount = differenceInCalendarDays(dataDo, dataOd) + 1;
  if (dayCount > IVOCLAR_MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: `Zakres maksymalnie ${IVOCLAR_MAX_RANGE_DAYS} dni (procedura: tydzień pn–nd).`,
    };
  }
  return {
    ok: true,
    dataOd: formatDateString(dataOd),
    dataDo: formatDateString(dataDo),
    dayCount,
  };
}

export function ivoclarReportFilename(
  kind: "Sellout" | "Inventory",
  dataDo: string
): string {
  const ym = String(dataDo).replace(/-/g, "").slice(0, 6);
  return `${kind}_${ym}_ ${IVOCLAR_DEALER_NUMBER}`;
}

export function ivoclarReportXlsxFilename(
  kind: "Sellout" | "Inventory",
  dataDo: string
): string {
  return `${ivoclarReportFilename(kind, dataDo)}.xlsx`;
}

export type IvoclarSelloutFileRow = {
  Country: string;
  Article: string;
  Quantity: number;
  PostalCode: string;
  "End User specification": IvoclarEndUserSpec;
  "Sub-Dealer name": string;
};

export type IvoclarInventoryFileRow = {
  Article: string;
  Balance: number;
};

const ISO_COUNTRY = /^[A-Z]{2}$/;

export function isIvoclarSelloutFileRowReady(row: IvoclarSelloutRow): boolean {
  const country = String(row.suggestedCountry ?? "").trim().toUpperCase();
  const postal = selloutPostalCodeForFile(row).trim();
  return (
    ISO_COUNTRY.test(country) &&
    Boolean(row.article) &&
    Number.isFinite(row.quantity) &&
    Boolean(postal)
  );
}

export function toIvoclarSelloutFileRow(row: IvoclarSelloutRow): IvoclarSelloutFileRow | null {
  if (!isIvoclarSelloutFileRowReady(row)) return null;
  const country = String(row.suggestedCountry).trim().toUpperCase();
  const endUser = row.endUser === "no" ? "no" : IVOCLAR_END_USER_SPEC;
  return {
    Country: country,
    Article: row.article,
    Quantity: row.quantity,
    PostalCode: selloutPostalCodeForFile(row).trim(),
    "End User specification": endUser,
    "Sub-Dealer name": endUser === "no" ? row.subDealerName.trim() : "",
  };
}

export function buildIvoclarSelloutFileRows(rows: IvoclarSelloutRow[]): {
  rows: IvoclarSelloutFileRow[];
  skippedCount: number;
} {
  const out: IvoclarSelloutFileRow[] = [];
  let skippedCount = 0;
  for (const row of rows) {
    const mapped = toIvoclarSelloutFileRow(row);
    if (!mapped) {
      skippedCount += 1;
      continue;
    }
    out.push(mapped);
  }
  return { rows: out, skippedCount };
}

export function isIvoclarInventoryFileRowReady(row: IvoclarInventoryRow): boolean {
  return Boolean(row.article) && Number.isFinite(row.balance) && row.balance > 0;
}

export function toIvoclarInventoryFileRow(row: IvoclarInventoryRow): IvoclarInventoryFileRow | null {
  if (!isIvoclarInventoryFileRowReady(row)) return null;
  return { Article: row.article, Balance: row.balance };
}

export function buildIvoclarInventoryFileRows(rows: IvoclarInventoryRow[]): {
  rows: IvoclarInventoryFileRow[];
  skippedCount: number;
} {
  const mapped = rows
    .map(toIvoclarInventoryFileRow)
    .filter((row): row is IvoclarInventoryFileRow => row != null)
    .sort((a, b) => a.Article.localeCompare(b.Article, "pl", { numeric: true }));
  return { rows: mapped, skippedCount: rows.length - mapped.length };
}

export function selloutDataGaps(input: {
  article: string;
  hasSuffix: boolean;
  inference: IvoclarCountryInference;
}): IvoclarDataGapCode[] {
  const gaps: IvoclarDataGapCode[] = [];
  if (!input.article) gaps.push("empty_article");
  else if (input.hasSuffix) gaps.push("article_suffix");
  if (input.inference.postalShape === "empty" && !input.inference.extractedPostalFromCity) {
    gaps.push("missing_postal");
  } else if (input.inference.postalShape === "other") {
    gaps.push("postal_format");
  }
  if (input.inference.conflict) gaps.push("country_conflict");
  else if (!input.inference.country && input.inference.postalShape !== "empty") {
    gaps.push("unknown_country");
  }
  return gaps;
}

export function selloutApiGaps(inference: IvoclarCountryInference): IvoclarApiGapCode[] {
  return inference.country ? [] : ["country_iso"];
}

export function isBlockingSelloutDataGap(code: IvoclarDataGapCode): boolean {
  return (
    code === "missing_postal" ||
    code === "empty_article" ||
    code === "postal_format" ||
    code === "unknown_country" ||
    code === "country_conflict"
  );
}

export function inventoryNotes(input: {
  article: string;
  hasSuffix: boolean;
  balance: number;
  blocked: boolean;
}): IvoclarInventoryNoteCode[] {
  const notes: IvoclarInventoryNoteCode[] = [];
  if (!input.article) notes.push("empty_article");
  else if (input.hasSuffix) notes.push("article_suffix");
  if (input.blocked) notes.push("blocked");
  if (!(input.balance > 0)) notes.push("zero_stock");
  return notes;
}

export function buildIvoclarSelloutRow(input: {
  dokId: number;
  dokNr: string;
  dokDataWyst: string | null;
  khId: number | null;
  khName: string;
  twId: number | null;
  twSymbol: string | null | undefined;
  twNazwa: string | null | undefined;
  quantity: number;
  postalRaw: string | null | undefined;
  city?: string | null;
  nip?: string | null;
  phone?: string | null;
  email?: string | null;
}): IvoclarSelloutRow {
  const parsed = parseIvoclarArticle(input.twSymbol);
  const inference = inferIvoclarCountry({
    postal: input.postalRaw,
    city: input.city,
    nip: input.nip,
    phone: input.phone,
    email: input.email,
  });
  return {
    dokId: input.dokId,
    dokNr: input.dokNr,
    dokDataWyst: input.dokDataWyst,
    khId: input.khId,
    khName: input.khName,
    twId: input.twId,
    twSymbol: parsed.raw,
    twNazwa: String(input.twNazwa ?? "").trim(),
    article: parsed.article,
    quantity: input.quantity,
    postalCode: inference.postalRaw,
    postalNormalized: inference.postalForFile,
    suggestedCountry: inference.country,
    countrySource: inference.source,
    countryConfidence: inference.confidence,
    countryConflict: inference.conflictCountries,
    dataGaps: selloutDataGaps({
      article: parsed.article,
      hasSuffix: parsed.hasSuffix,
      inference,
    }),
    apiGaps: selloutApiGaps(inference),
    endUser: IVOCLAR_END_USER_SPEC,
    subDealerName: "",
  };
}

export function selloutPostalCodeForFile(row: Pick<IvoclarSelloutRow, "postalNormalized" | "postalCode">): string {
  return row.postalNormalized || row.postalCode;
}

export function buildIvoclarInventoryRow(input: {
  twId: number;
  twSymbol: string | null | undefined;
  twNazwa: string | null | undefined;
  groupName: string | null | undefined;
  balance: number;
  reserved: number;
  blocked: boolean;
}): IvoclarInventoryRow {
  const parsed = parseIvoclarArticle(input.twSymbol);
  const balance = Number.isFinite(input.balance) ? input.balance : 0;
  return {
    twId: input.twId,
    twSymbol: parsed.raw,
    twNazwa: String(input.twNazwa ?? "").trim(),
    groupName: String(input.groupName ?? "").trim(),
    article: parsed.article,
    balance,
    reserved: Number.isFinite(input.reserved) ? input.reserved : 0,
    blocked: input.blocked,
    notes: inventoryNotes({
      article: parsed.article,
      hasSuffix: parsed.hasSuffix,
      balance,
      blocked: input.blocked,
    }),
  };
}

export function summarizeSelloutRows(
  rows: IvoclarSelloutRow[],
  extras: {
    fsHeaderCount: number;
    fsFetchedOk: number;
    fsCancelledSkipped: number;
    fsFetchErrors: number;
    skippedNonIvoclarLines: number;
    skippedZeroQtyLines: number;
    skippedExcludedLines: number;
    emptyDetailCount: number;
  }
): IvoclarSelloutSummary {
  let rowsWithDataGaps = 0;
  let rowsWithBlockingDataGaps = 0;
  let countryResolvedCount = 0;
  let countryUnknownCount = 0;
  let countryMissingAddressCount = 0;
  let countryConflictCount = 0;
  for (const row of rows) {
    if (row.dataGaps.length > 0) rowsWithDataGaps += 1;
    if (row.dataGaps.some(isBlockingSelloutDataGap)) rowsWithBlockingDataGaps += 1;
    if (row.suggestedCountry) {
      countryResolvedCount += 1;
    } else if (row.dataGaps.includes("country_conflict")) {
      countryConflictCount += 1;
    } else if (
      row.dataGaps.includes("missing_postal") &&
      !row.dataGaps.includes("unknown_country")
    ) {
      countryMissingAddressCount += 1;
    } else {
      countryUnknownCount += 1;
    }
  }
  return {
    ...extras,
    ivoclarLineCount: rows.length,
    rowsWithDataGaps,
    rowsWithBlockingDataGaps,
    countryResolvedCount,
    countryUnknownCount,
    countryMissingAddressCount,
    countryConflictCount,
  };
}

export function summarizeInventoryRows(rows: IvoclarInventoryRow[]): IvoclarInventorySummary {
  return {
    skuCount: rows.length,
    zeroStockCount: rows.filter((r) => r.notes.includes("zero_stock")).length,
    blockedCount: rows.filter((r) => r.notes.includes("blocked")).length,
    suffixCount: rows.filter((r) => r.notes.includes("article_suffix")).length,
    emptyArticleCount: rows.filter((r) => r.notes.includes("empty_article")).length,
  };
}

export function sumSelloutQuantityByArticle(
  rows: IvoclarSelloutRow[]
): Array<{ article: string; quantity: number; lineCount: number }> {
  const map = new Map<string, { article: string; quantity: number; lineCount: number }>();
  for (const row of rows) {
    const key = row.article || `?${row.twSymbol}`;
    const prev = map.get(key) ?? { article: row.article || row.twSymbol, quantity: 0, lineCount: 0 };
    prev.quantity += row.quantity;
    prev.lineCount += 1;
    map.set(key, prev);
  }
  return [...map.values()].sort((a, b) => a.article.localeCompare(b.article, "pl"));
}

export type IvoclarFsFetchError = {
  dokId: number;
  dokNr: string;
  message: string;
};

export function tooManyFsHeadersMessage(count: number): string {
  return `W zakresie jest ${count} faktur FS — zawęź daty (limit ${IVOCLAR_MAX_FS_HEADERS}). Miesiąc kalendarzowy często przekracza limit; poprzedni tydzień to zwykle kilkaset.`;
}

export type IvoclarListPageAdvance =
  | { kind: "done" }
  | { kind: "next"; page: number }
  | { kind: "overflow" };

/**
 * Kolejna strona listy Subiekta.
 * Brak pagination.totalPages nie może obciąć wyniku do 1. strony.
 */
export function advanceIvoclarListPage(input: {
  page: number;
  pageSize: number;
  chunkLength: number;
  totalPages: number | null | undefined;
  maxPages: number;
}): IvoclarListPageAdvance {
  if (input.chunkLength <= 0) return { kind: "done" };
  const reported =
    input.totalPages != null && Number.isFinite(input.totalPages)
      ? Math.max(1, Math.trunc(input.totalPages))
      : null;
  const more =
    reported != null ? input.page < reported : input.chunkLength >= input.pageSize;
  if (!more) return { kind: "done" };
  const next = input.page + 1;
  if (next > input.maxPages) return { kind: "overflow" };
  return { kind: "next", page: next };
}
