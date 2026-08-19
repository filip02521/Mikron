import {
  advanceIvoclarListPage,
  buildIvoclarInventoryRow,
  buildIvoclarSelloutRow,
  isCancelledSubiektStatus,
  isIvoclarReportExcludedSymbol,
  isSubiektProductBlocked,
  IVOCLAR_CECHA_ID,
  IVOCLAR_FS_DETAIL_CONCURRENCY,
  IVOCLAR_LIST_PAGE_SIZE,
  IVOCLAR_MAX_FS_HEADERS,
  normalizeIvoclarTwSymbol,
  parseIvoclarArticle,
  summarizeInventoryRows,
  summarizeSelloutRows,
  tooManyFsHeadersMessage,
  type IvoclarInventoryRow,
  type IvoclarInventorySummary,
  type IvoclarSelloutRow,
  type IvoclarSelloutSummary,
  type IvoclarFsFetchError,
} from "@/lib/orders/ivoclar-report";
import {
  getSubiektOrdersFs,
  searchSubiektOrdersFs,
  searchSubiektOrdersProducts,
} from "@/lib/subiekt/api";
import { formatSubiektKontrahentLabel } from "@/lib/subiekt/match-supplier";
import type { SubiektDocument, SubiektKontrahent, SubiektListEnvelope, SubiektProduct } from "@/lib/subiekt/types";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

const MAX_PRODUCT_PAGES = 20;
const IVOCLAR_CATALOG_TTL_MS = 5 * 60 * 1000;

type IvoclarCatalogCache = {
  at: number;
  value: IvoclarInventoryFetchResult;
};

let catalogCache: IvoclarCatalogCache | null = null;
let catalogInflight: Promise<IvoclarInventoryFetchResult> | null = null;

export function resetIvoclarInventoryCatalogCache(): void {
  catalogCache = null;
  catalogInflight = null;
}

export type IvoclarLineCatalog = {
  twIds: ReadonlySet<number>;
  twSymbols: ReadonlySet<string>;
  articles: ReadonlySet<string>;
};

export function ivoclarLineCatalogFromRows(rows: IvoclarInventoryRow[]): IvoclarLineCatalog {
  const twIds = new Set<number>();
  const twSymbols = new Set<string>();
  const articles = new Set<string>();
  for (const row of rows) {
    twIds.add(row.twId);
    const symbol = normalizeIvoclarTwSymbol(row.twSymbol);
    if (symbol) twSymbols.add(symbol);
    if (row.article) articles.add(row.article);
  }
  return { twIds, twSymbols, articles };
}

function resolveIvoclarLineCatalog(
  input: ReadonlySet<number> | IvoclarLineCatalog
): IvoclarLineCatalog {
  if ("twIds" in input) {
    return input;
  }
  return { twIds: input, twSymbols: new Set(), articles: new Set() };
}

export type IvoclarInventoryFetchResult = {
  rows: IvoclarInventoryRow[];
  summary: IvoclarInventorySummary;
  cechaId: number;
};

export type IvoclarSelloutFetchResult = {
  rows: IvoclarSelloutRow[];
  summary: IvoclarSelloutSummary;
  fetchErrors: IvoclarFsFetchError[];
};

async function fetchAllPages<T>(
  load: (page: number, pageSize: number) => Promise<SubiektListEnvelope<T>>,
  options: { pageSize: number; maxPages: number; label: string }
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (true) {
    const res = await load(page, options.pageSize);
    const chunk = Array.isArray(res.data) ? res.data : [];
    all.push(...chunk);
    const step = advanceIvoclarListPage({
      page,
      pageSize: options.pageSize,
      chunkLength: chunk.length,
      totalPages: res.pagination?.totalPages,
      maxPages: options.maxPages,
    });
    if (step.kind === "overflow") {
      throw new Error(`Zbyt wiele stron ${options.label} — przerwano po ${options.maxPages}.`);
    }
    if (step.kind === "done") break;
    page = step.page;
  }
  return all;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const concurrency = Math.max(1, limit);
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]!);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

function asFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function documentDateKey(doc: SubiektDocument): string | null {
  const raw = String(doc.dok_DataWyst ?? "").trim();
  if (!raw) return null;
  return raw.slice(0, 10);
}

function documentStatusName(doc: SubiektDocument): string {
  return String(doc.dok_StatusNazwa ?? "").trim();
}

type IvoclarGeo = {
  postal: string;
  city: string;
  nip: string;
  phone: string;
  email: string;
};

function geoFromKontrahent(kh: SubiektKontrahent | null | undefined): IvoclarGeo {
  if (!kh) {
    return { postal: "", city: "", nip: "", phone: "", email: "" };
  }
  const postal = typeof kh.adr_Kod === "string" ? kh.adr_Kod.trim() : "";
  const cityRaw = typeof kh.adr_Miejscowosc === "string" ? kh.adr_Miejscowosc.trim() : "";
  const poczta = typeof kh.adr_Poczta === "string" ? kh.adr_Poczta.trim() : "";
  const city = cityRaw || poczta;
  const nip = typeof kh.adr_NIP === "string" ? kh.adr_NIP.trim() : "";
  const phone =
    (typeof kh.adr_Telefon === "string" ? kh.adr_Telefon.trim() : "") ||
    (typeof kh.kh_Telefon === "string" ? kh.kh_Telefon.trim() : "");
  const email = typeof kh.kh_EMail === "string" ? kh.kh_EMail.trim() : "";
  return { postal, city, nip, phone, email };
}

function firstFilledString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function firstFilledKhId(...values: unknown[]): number | undefined {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function mergeKontrahent(
  header: SubiektKontrahent | null | undefined,
  detail: SubiektKontrahent | null | undefined
): SubiektKontrahent | undefined {
  if (!header && !detail) return undefined;
  if (!detail) return header ?? undefined;
  if (!header) return detail;
  const khId = firstFilledKhId(detail.kh_Id, header.kh_Id) ?? header.kh_Id ?? detail.kh_Id;
  return {
    ...header,
    ...detail,
    kh_Id: khId,
    kh_Symbol: firstFilledString(detail.kh_Symbol, header.kh_Symbol) ?? detail.kh_Symbol,
    kh_EMail: firstFilledString(detail.kh_EMail, header.kh_EMail),
    adr_Telefon: firstFilledString(detail.adr_Telefon, header.adr_Telefon),
    kh_Telefon: firstFilledString(detail.kh_Telefon, header.kh_Telefon),
    adr_Nazwa: firstFilledString(detail.adr_Nazwa, header.adr_Nazwa),
    adr_NazwaPelna: firstFilledString(detail.adr_NazwaPelna, header.adr_NazwaPelna),
    adr_NIP: firstFilledString(detail.adr_NIP, header.adr_NIP),
    adr_Miejscowosc: firstFilledString(detail.adr_Miejscowosc, header.adr_Miejscowosc),
    adr_Kod: firstFilledString(detail.adr_Kod, header.adr_Kod),
    adr_Poczta: firstFilledString(detail.adr_Poczta, header.adr_Poczta),
    adr_Ulica: firstFilledString(detail.adr_Ulica, header.adr_Ulica),
  };
}

function mergeGeo(primary: IvoclarGeo, fallback: IvoclarGeo): IvoclarGeo {
  return {
    postal: primary.postal || fallback.postal,
    city: primary.city || fallback.city,
    nip: primary.nip || fallback.nip,
    phone: primary.phone || fallback.phone,
    email: primary.email || fallback.email,
  };
}

function geoFromFsHeader(doc: SubiektDocument): IvoclarGeo {
  return mergeGeo(
    geoFromKontrahent(doc.kh__Kontrahent_Odbiorca),
    geoFromKontrahent(doc.kh__Kontrahent_Platnik)
  );
}

function customerFromFsHeader(doc: SubiektDocument): { khId: number | null; khName: string } {
  const kh = doc.kh__Kontrahent_Odbiorca ?? doc.kh__Kontrahent_Platnik;
  const khIdRaw = asFiniteNumber(doc.dok_OdbiorcaId) ?? asFiniteNumber(kh?.kh_Id);
  const khId = khIdRaw != null && khIdRaw > 0 ? khIdRaw : null;
  const khName = kh ? formatSubiektKontrahentLabel(kh) : khId != null ? `Kontrahent (id ${khId})` : "—";
  return { khId, khName };
}

/** Szczegół FS często nie powtarza kontrahenta z listy — bez merge gubimy kod pocztowy. */
export function mergeIvoclarFsHeaderIntoDetail(
  header: SubiektDocument,
  detail: SubiektDocument
): SubiektDocument {
  return {
    ...header,
    ...detail,
    dok_Pozycja: detail.dok_Pozycja ?? header.dok_Pozycja,
    dok_OdbiorcaId: detail.dok_OdbiorcaId ?? header.dok_OdbiorcaId,
    dok_StatusNazwa: detail.dok_StatusNazwa ?? header.dok_StatusNazwa,
    dok_DataWyst: detail.dok_DataWyst ?? header.dok_DataWyst,
    dok_NrPelny: detail.dok_NrPelny ?? header.dok_NrPelny,
    kh__Kontrahent_Odbiorca: mergeKontrahent(
      header.kh__Kontrahent_Odbiorca,
      detail.kh__Kontrahent_Odbiorca
    ),
    kh__Kontrahent_Platnik: mergeKontrahent(
      header.kh__Kontrahent_Platnik,
      detail.kh__Kontrahent_Platnik
    ),
  };
}

export function extractIvoclarSelloutFromFs(
  doc: SubiektDocument,
  ivoclarTwIdsOrCatalog: ReadonlySet<number> | IvoclarLineCatalog
): {
  cancelled: boolean;
  rows: IvoclarSelloutRow[];
  skippedNonIvoclar: number;
  skippedZeroQty: number;
  skippedExcluded: number;
  emptyDetail: boolean;
} {
  if (isCancelledSubiektStatus(documentStatusName(doc))) {
    return {
      cancelled: true,
      rows: [],
      skippedNonIvoclar: 0,
      skippedZeroQty: 0,
      skippedExcluded: 0,
      emptyDetail: false,
    };
  }
  const pozycje = Array.isArray(doc.dok_Pozycja) ? doc.dok_Pozycja : [];
  if (pozycje.length === 0) {
    return {
      cancelled: false,
      rows: [],
      skippedNonIvoclar: 0,
      skippedZeroQty: 0,
      skippedExcluded: 0,
      emptyDetail: true,
    };
  }
  const catalog = resolveIvoclarLineCatalog(ivoclarTwIdsOrCatalog);
  const dokId = asFiniteNumber(doc.dok_Id) ?? 0;
  const dokNr = String(doc.dok_NrPelny ?? "").trim() || `FS/${dokId}`;
  const dokDataWyst = documentDateKey(doc);
  const { khId, khName } = customerFromFsHeader(doc);
  const geo = geoFromFsHeader(doc);
  const rows: IvoclarSelloutRow[] = [];
  let skippedNonIvoclar = 0;
  let skippedZeroQty = 0;
  let skippedExcluded = 0;
  for (const line of pozycje) {
    const twId = asFiniteNumber(line.ob_TowId);
    const twSymbol = line.tw_Symbol;
    if (isIvoclarReportExcludedSymbol(twSymbol)) {
      skippedExcluded += 1;
      continue;
    }
    if (!isIvoclarFsLine(twId, twSymbol, catalog)) {
      skippedNonIvoclar += 1;
      continue;
    }
    const quantity = asFiniteNumber(line.ob_Ilosc);
    // 0 i brak ilości pomijamy; ujemne (korekta FS) zostają w sellout.
    if (quantity == null || quantity === 0) {
      skippedZeroQty += 1;
      continue;
    }
    rows.push(
      buildIvoclarSelloutRow({
        dokId,
        dokNr,
        dokDataWyst,
        khId,
        khName,
        twId,
        twSymbol,
        twNazwa: line.tw_Nazwa,
        quantity,
        postalRaw: geo.postal,
        city: geo.city,
        nip: geo.nip,
        phone: geo.phone,
        email: geo.email,
      })
    );
  }
  return { cancelled: false, rows, skippedNonIvoclar, skippedZeroQty, skippedExcluded, emptyDetail: false };
}

function isIvoclarFsLine(
  twId: number | null,
  twSymbol: string | null | undefined,
  catalog: IvoclarLineCatalog
): boolean {
  if (twId != null) return catalog.twIds.has(twId);
  const symbol = normalizeIvoclarTwSymbol(twSymbol);
  if (symbol && catalog.twSymbols.has(symbol)) return true;
  const article = parseIvoclarArticle(twSymbol).article;
  return Boolean(article && catalog.articles.has(article));
}

export async function fetchIvoclarInventoryCatalog(): Promise<IvoclarInventoryFetchResult> {
  if (catalogCache && Date.now() - catalogCache.at < IVOCLAR_CATALOG_TTL_MS) {
    return catalogCache.value;
  }
  if (catalogInflight) return catalogInflight;
  catalogInflight = loadIvoclarInventoryCatalog()
    .then((value) => {
      catalogCache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      catalogInflight = null;
    });
  return catalogInflight;
}

async function loadIvoclarInventoryCatalog(): Promise<IvoclarInventoryFetchResult> {
  const products = await fetchAllPages<SubiektProduct>(
    (page, pageSize) =>
      searchSubiektOrdersProducts({
        page,
        pageSize,
        cechaId: IVOCLAR_CECHA_ID,
        includeBlocked: true,
      }),
    {
      pageSize: IVOCLAR_LIST_PAGE_SIZE,
      maxPages: MAX_PRODUCT_PAGES,
      label: "towarów Ivoclar",
    }
  );
  if (products.length === 0) {
    throw new Error(`Cecha Ivoclar (${IVOCLAR_CECHA_ID}) nie zwróciła towarów.`);
  }
  if (products.length > 4000) {
    throw new Error(
      "Filtr cechy Ivoclar nie zadziałał — API zwróciło za dużo SKU. Sprawdź parametr cechaId."
    );
  }
  const rows = products
    .map((p) => {
      const twId = asFiniteNumber(p.tw_Id);
      if (twId == null || twId <= 0) return null;
      return buildIvoclarInventoryRow({
        twId,
        twSymbol: p.tw_Symbol,
        twNazwa: p.tw_Nazwa,
        groupName: p.grt_Nazwa,
        balance: asFiniteNumber(p.tw_Stan) ?? 0,
        reserved: asFiniteNumber(p.tw_StanRez) ?? 0,
        blocked: isSubiektProductBlocked(p.tw_Zablokowany),
      });
    })
    .filter((row): row is IvoclarInventoryRow => row != null)
    .filter((row) => !isIvoclarReportExcludedSymbol(row.twSymbol))
    .sort((a, b) => a.twSymbol.localeCompare(b.twSymbol, "pl"));
  return {
    rows,
    summary: summarizeInventoryRows(rows),
    cechaId: IVOCLAR_CECHA_ID,
  };
}

export async function fetchIvoclarSelloutFromFs(input: {
  dataOd: string;
  dataDo: string;
  catalog: IvoclarLineCatalog;
}): Promise<IvoclarSelloutFetchResult> {
  const headers = await fetchAllPages<SubiektDocument>(
    (page, pageSize) =>
      searchSubiektOrdersFs({
        page,
        pageSize,
        dataOd: input.dataOd,
        dataDo: input.dataDo,
      }),
    {
      pageSize: IVOCLAR_LIST_PAGE_SIZE,
      maxPages: Math.ceil(IVOCLAR_MAX_FS_HEADERS / IVOCLAR_LIST_PAGE_SIZE) + 1,
      label: "faktur FS",
    }
  );
  if (headers.length > IVOCLAR_MAX_FS_HEADERS) {
    throw new Error(tooManyFsHeadersMessage(headers.length));
  }

  const rows: IvoclarSelloutRow[] = [];
  const fetchErrors: IvoclarFsFetchError[] = [];
  let fsFetchedOk = 0;
  let fsCancelledSkipped = 0;
  let skippedNonIvoclarLines = 0;
  let skippedZeroQtyLines = 0;
  let skippedExcludedLines = 0;
  let emptyDetailCount = 0;

  const details = await mapPool(headers, IVOCLAR_FS_DETAIL_CONCURRENCY, async (header) => {
    const dokId = asFiniteNumber(header.dok_Id) ?? 0;
    const dokNr = String(header.dok_NrPelny ?? "").trim() || `FS/${dokId}`;
    if (!(dokId > 0)) {
      return { kind: "error" as const, dokId, dokNr, message: "Brak dok_Id." };
    }
    if (isCancelledSubiektStatus(documentStatusName(header))) {
      return { kind: "cancelled" as const };
    }
    try {
      const detail = await getSubiektOrdersFs(dokId);
      return {
        kind: "ok" as const,
        doc: mergeIvoclarFsHeaderIntoDetail(header, detail),
      };
    } catch (e) {
      return {
        kind: "error" as const,
        dokId,
        dokNr,
        message: userFacingErrorText(e, "Nie udało się pobrać pozycji FS."),
      };
    }
  });

  for (const item of details) {
    if (item.kind === "cancelled") {
      fsCancelledSkipped += 1;
      continue;
    }
    if (item.kind === "error") {
      fetchErrors.push({ dokId: item.dokId, dokNr: item.dokNr, message: item.message });
      continue;
    }
    fsFetchedOk += 1;
    const extracted = extractIvoclarSelloutFromFs(item.doc, input.catalog);
    if (extracted.cancelled) {
      fsCancelledSkipped += 1;
      fsFetchedOk -= 1;
      continue;
    }
    if (extracted.emptyDetail) emptyDetailCount += 1;
    skippedNonIvoclarLines += extracted.skippedNonIvoclar;
    skippedZeroQtyLines += extracted.skippedZeroQty;
    skippedExcludedLines += extracted.skippedExcluded;
    rows.push(...extracted.rows);
  }

  rows.sort((a, b) => {
    const byDate = String(a.dokDataWyst ?? "").localeCompare(String(b.dokDataWyst ?? ""));
    if (byDate !== 0) return byDate;
    const byNr = a.dokNr.localeCompare(b.dokNr, "pl");
    if (byNr !== 0) return byNr;
    return a.article.localeCompare(b.article, "pl");
  });

  return {
    rows,
    fetchErrors,
    summary: summarizeSelloutRows(rows, {
      fsHeaderCount: headers.length,
      fsFetchedOk,
      fsCancelledSkipped,
      fsFetchErrors: fetchErrors.length,
      skippedNonIvoclarLines,
      skippedZeroQtyLines,
      skippedExcludedLines,
      emptyDetailCount,
    }),
  };
}
