import { formatPlDate } from "@/lib/display-labels";
import { parseDateOnly, formatDateString } from "@/lib/orders/dates";
import { isPastExpectedDate } from "@/lib/orders/delivery-eta";
import { searchSubiektZd } from "@/lib/subiekt/api";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { looksLikeProductSymbol, productSearchParams } from "@/lib/subiekt/product-pick";
import type { SubiektDocument, SubiektDocumentLine } from "@/lib/subiekt/types";

export type SubiektZdEta = {
  realizationDate: string;
  documentNumber: string | null;
  matchedBy: "symbol" | "name";
};

export type OrderZdLookupInput = {
  id: string;
  symbol: string;
  products: string;
  status: string;
  request_kind?: string | null;
  supplier?: { name: string } | null;
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasMeaningfulSymbol(symbol: string): boolean {
  const s = symbol.trim();
  return s.length > 0 && s !== "-";
}

function hasMeaningfulProduct(product: string): boolean {
  const p = product.trim();
  return p.length > 0 && p !== "Do uzupełnienia";
}

export function orderSearchQuery(order: OrderZdLookupInput): string | null {
  if (hasMeaningfulSymbol(order.symbol)) return order.symbol.trim();
  if (hasMeaningfulProduct(order.products)) return order.products.trim();
  return null;
}

/** Data realizacji z dokumentu ZD — pierwsze rozpoznane pole daty. */
export function extractZdRealizationDate(doc: SubiektDocument): string | null {
  const raw = [
    doc.dok_DataRealizacji,
    doc.dok_TerminRealizacji,
    doc.dok_Termin,
    doc.dok_DataOdbioru,
    doc.dok_DataMag,
  ];

  for (const value of raw) {
    if (value == null || value === "") continue;
    const parsed = parseDateOnly(String(value));
    if (parsed) return formatDateString(parsed);
  }

  return null;
}

function kontrahentNames(doc: SubiektDocument): string[] {
  const parts: (string | null | undefined)[] = [];
  for (const k of [doc.kh__Kontrahent_Platnik, doc.kh__Kontrahent_Odbiorca]) {
    if (!k) continue;
    parts.push(k.adr_NazwaPelna, k.adr_Nazwa, k.kh_Symbol);
  }
  return parts.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
}

export function supplierMatchesZd(
  doc: SubiektDocument,
  supplierName: string | null | undefined
): boolean {
  const sn = supplierName?.trim();
  if (!sn) return true;
  const target = normalizeText(sn);
  return kontrahentNames(doc).some((name) => {
    const n = normalizeText(name);
    return n === target || n.includes(target) || target.includes(n);
  });
}

export function zdLineMatchesOrder(
  line: SubiektDocumentLine,
  symbol: string,
  product: string
): "symbol" | "name" | null {
  const sym = hasMeaningfulSymbol(symbol) ? normalizeText(symbol) : "";
  const prod = hasMeaningfulProduct(product) ? normalizeText(product) : "";
  const lineSym = line.tw_Symbol ? normalizeText(String(line.tw_Symbol)) : "";
  const lineName = line.tw_Nazwa ? normalizeText(String(line.tw_Nazwa)) : "";

  if (sym && lineSym && (lineSym === sym || lineSym.includes(sym) || sym.includes(lineSym))) {
    return "symbol";
  }
  if (prod && lineName) {
    if (lineName === prod || lineName.includes(prod) || prod.includes(lineName)) {
      return "name";
    }
  }
  return null;
}

export function pickZdForOrder(
  order: OrderZdLookupInput,
  documents: SubiektDocument[]
): SubiektZdEta | null {
  const supplierName = order.supplier?.name;
  let best: { eta: SubiektZdEta; sortKey: string } | null = null;

  for (const doc of documents) {
    if (!supplierMatchesZd(doc, supplierName)) continue;
    const realizationDate = extractZdRealizationDate(doc);
    if (!realizationDate) continue;

    const lines = doc.dok_Pozycja ?? [];
    for (const line of lines) {
      const matchedBy = zdLineMatchesOrder(line, order.symbol, order.products);
      if (!matchedBy) continue;

      const eta: SubiektZdEta = {
        realizationDate,
        documentNumber: doc.dok_NrPelny?.trim() ?? null,
        matchedBy,
      };
      const sortKey = `${realizationDate}|${doc.dok_DataWyst ?? ""}|${doc.dok_Id}`;
      if (!best || sortKey > best.sortKey) {
        best = { eta, sortKey };
      }
    }
  }

  return best?.eta ?? null;
}

async function fetchZdCandidates(query: string): Promise<SubiektDocument[]> {
  const params = productSearchParams(query);
  const res = await searchSubiektZd({
    search: params.search,
    symbol: params.symbol,
    name: params.name,
    pageSize: 25,
    page: 1,
  });
  return res.data;
}

const ZD_LOOKUP_STATUSES = new Set(["Nowe", "Zamowione", "Czesciowo_zrealizowane"]);

/** Dla listy zamówień handlowca — dopasowanie ZD + termin realizacji (best-effort). */
export async function resolveSubiektZdEtasForOrders(
  orders: OrderZdLookupInput[]
): Promise<Record<string, SubiektZdEta>> {
  if (!(await isSubiektReachable())) return {};

  const eligible = orders.filter(
    (o) =>
      o.request_kind !== "informacja" &&
      ZD_LOOKUP_STATUSES.has(o.status) &&
      orderSearchQuery(o)
  );

  const result: Record<string, SubiektZdEta> = {};
  const docCache = new Map<string, SubiektDocument[]>();

  for (const order of eligible) {
    const query = orderSearchQuery(order);
    if (!query) continue;

    try {
      let docs = docCache.get(query);
      if (docs === undefined) {
        docs = await fetchZdCandidates(query);
        docCache.set(query, docs);
      }
      const match = pickZdForOrder(order, docs);
      if (match) result[order.id] = match;
    } catch {
      docCache.set(query, []);
    }
  }

  return result;
}

export function formatSubiektZdTimingLabel(eta: SubiektZdEta): string | null {
  const date = parseDateOnly(eta.realizationDate);
  if (!date) return null;
  const label = formatPlDate(eta.realizationDate) ?? eta.realizationDate;
  const nr = eta.documentNumber;
  const base = nr ? `Termin ZD ${nr}: ${label}` : `Termin z ZD: ${label}`;
  return isPastExpectedDate(date) ? `${base} · po terminie` : base;
}

export function subiektZdStatusHint(eta: SubiektZdEta): string {
  const label = formatPlDate(eta.realizationDate) ?? eta.realizationDate;
  const nr = eta.documentNumber ? ` (${eta.documentNumber})` : "";
  return `W Subiekcie jest ZD${nr} — termin realizacji ok. ${label}.`;
}
