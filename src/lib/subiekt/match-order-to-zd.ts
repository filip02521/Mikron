import type { IndividualOrder } from "@/types/database";
import type { SubiektDocument, SubiektDocumentLine } from "@/lib/subiekt/types";
import { getDeliveryProgress } from "@/lib/orders/individual";
import { lineTowId } from "@/lib/subiekt/zd-catalog-import";
import { buildZdMatchProfileFromDocument } from "@/lib/warehouse/zd-receive-filter";
import { parseZdFulfillmentDeadline } from "@/lib/subiekt/zd-fulfillment-date";
import {
  effectiveProductSymbol,
  extractAlphanumericProductCodeFromName,
} from "@/lib/subiekt/zd-search-for-product";

function normalizeSymbol(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "-") return null;
  return trimmed.toLowerCase();
}

function addMatchSymbol(
  out: Set<string>,
  value: string | null | undefined
): void {
  const normalized = normalizeSymbol(value);
  if (normalized) out.add(normalized);
}

/** Warianty symbolu do dopasowania ZD (pełny symbol, kod bazowy, wyciągnięty z nazwy). */
export function resolveOrderMatchSymbols(
  order: Pick<IndividualOrder, "symbol" | "products">
): string[] {
  const symbols = new Set<string>();

  addMatchSymbol(symbols, order.symbol);
  addMatchSymbol(
    symbols,
    effectiveProductSymbol({
      tw_Id: 0,
      tw_Symbol: order.symbol ?? "",
      tw_Nazwa: order.products ?? "",
    })
  );

  for (const src of [order.symbol, order.products]) {
    addMatchSymbol(symbols, extractAlphanumericProductCodeFromName(src ?? ""));
    const firstToken = src?.trim().split(/\s+/)[0];
    addMatchSymbol(symbols, firstToken);
  }

  return [...symbols];
}

/** Symbol do dopasowania ZD — pierwszy wariant z {@link resolveOrderMatchSymbols}. */
export function resolveOrderMatchSymbol(
  order: Pick<IndividualOrder, "symbol" | "products">
): string | null {
  return resolveOrderMatchSymbols(order)[0] ?? null;
}

function orderSymbolsMatchLine(orderSymbols: readonly string[], lineSym: string): boolean {
  if (!lineSym) return false;
  for (const orderSym of orderSymbols) {
    if (orderSym === lineSym) return true;
    if (orderSym.length >= 4 && orderSym.startsWith(`${lineSym} `)) return true;
    if (lineSym.length >= 4 && lineSym.startsWith(`${orderSym} `)) return true;
  }
  return false;
}

function zdLineQuantity(line: SubiektDocumentLine): number | null {
  const raw = line.ob_Ilosc;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Pozostała ilość u dostawcy (null gdy brak liczbowej ilości w prośbie). */
export function orderRemainingQuantity(
  order: Pick<IndividualOrder, "quantity" | "delivered_quantity">
): number | null {
  const progress = getDeliveryProgress(
    order.quantity ?? "-",
    order.delivered_quantity ?? "-"
  );
  return progress.hasNumericQty ? progress.remaining : null;
}

/** Dopasowanie pozycji prośby do linii ZD (tw_Id, symbol, kod Mikran). */
export function matchOrderToZdLine(
  order: Pick<IndividualOrder, "subiekt_tw_id" | "symbol" | "products" | "mikran_code">,
  line: SubiektDocumentLine
): boolean {
  const towId = lineTowId(line);
  const orderTw = order.subiekt_tw_id;
  if (
    orderTw != null &&
    orderTw > 0 &&
    towId != null &&
    Math.trunc(orderTw) === towId
  ) {
    return true;
  }

  const lineSym = normalizeSymbol(line.tw_Symbol ?? null);
  const orderSymbols = resolveOrderMatchSymbols(order);
  if (lineSym && orderSymbolsMatchLine(orderSymbols, lineSym)) {
    return true;
  }

  const orderMikran = normalizeSymbol(order.mikran_code);
  if (orderMikran && lineSym && orderMikran === lineSym) {
    return true;
  }

  return false;
}

export function orderMatchesZdDocument(
  order: Pick<IndividualOrder, "subiekt_tw_id" | "symbol" | "products" | "mikran_code">,
  doc: SubiektDocument
): boolean {
  const profile = buildZdMatchProfileFromDocument(doc);
  const twId = order.subiekt_tw_id;
  if (twId != null && twId > 0 && profile.twIds.includes(Math.trunc(twId))) {
    return true;
  }

  const orderSymbols = resolveOrderMatchSymbols(order);
  if (orderSymbols.some((symbol) => profile.symbols.includes(symbol))) {
    return true;
  }

  const mikran = normalizeSymbol(order.mikran_code);
  if (mikran && profile.symbols.includes(mikran)) {
    return true;
  }

  return (doc.dok_Pozycja ?? []).some((line) => matchOrderToZdLine(order, line));
}

function matchingLineQuantities(
  order: Pick<
    IndividualOrder,
    "subiekt_tw_id" | "symbol" | "products" | "mikran_code" | "quantity" | "delivered_quantity"
  >,
  doc: SubiektDocument
): number[] {
  const quantities: number[] = [];
  for (const line of doc.dok_Pozycja ?? []) {
    if (!matchOrderToZdLine(order, line)) continue;
    const qty = zdLineQuantity(line);
    if (qty != null) quantities.push(qty);
  }
  return quantities;
}

function bestMatchingLineQuantity(
  order: Pick<
    IndividualOrder,
    "subiekt_tw_id" | "symbol" | "products" | "mikran_code" | "quantity" | "delivered_quantity"
  >,
  doc: SubiektDocument
): { coversRemaining: boolean; tightness: number | null } {
  const remaining = orderRemainingQuantity(order);
  const quantities = matchingLineQuantities(order, doc);
  if (remaining == null || quantities.length === 0) {
    return { coversRemaining: true, tightness: null };
  }

  const covering = quantities.filter((qty) => qty >= remaining);
  if (covering.length === 0) {
    return { coversRemaining: false, tightness: null };
  }

  const tightest = Math.min(...covering.map((qty) => qty - remaining));
  return { coversRemaining: true, tightness: tightest };
}

function compareNullableDates(a: string | null, b: string | null): number {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

/** Wybiera najtrafniejszy ZD — ilość reszty, termin, wcześniejszy zapis dok_Id. */
export function findBestMatchingZdDocument(
  order: Pick<
    IndividualOrder,
    | "subiekt_tw_id"
    | "symbol"
    | "products"
    | "mikran_code"
    | "quantity"
    | "delivered_quantity"
    | "zd_fulfillment_dok_id"
  >,
  docs: SubiektDocument[]
): SubiektDocument | null {
  const persistedDokId =
    order.zd_fulfillment_dok_id != null && order.zd_fulfillment_dok_id > 0
      ? Math.trunc(order.zd_fulfillment_dok_id)
      : null;

  const candidates = docs.filter((doc) => orderMatchesZdDocument(order, doc));
  if (!candidates.length) return null;

  const ranked = candidates
    .map((doc) => {
      const qty = bestMatchingLineQuantity(order, doc);
      return {
        doc,
        persisted: persistedDokId != null && Math.trunc(Number(doc.dok_Id)) === persistedDokId,
        coversRemaining: qty.coversRemaining,
        tightness: qty.tightness,
        deadline: parseZdFulfillmentDeadline(doc),
        issueDate: (doc.dok_DataWyst ?? "").slice(0, 10),
      };
    })
    .sort((a, b) => {
      const aPersist =
        a.persisted && a.coversRemaining ? 1 : 0;
      const bPersist =
        b.persisted && b.coversRemaining ? 1 : 0;
      if (aPersist !== bPersist) return bPersist - aPersist;
      if (a.coversRemaining !== b.coversRemaining) return a.coversRemaining ? -1 : 1;
      if (a.tightness != null && b.tightness != null && a.tightness !== b.tightness) {
        return a.tightness - b.tightness;
      }
      const deadlineCmp = compareNullableDates(a.deadline, b.deadline);
      if (deadlineCmp !== 0) return deadlineCmp;
      return b.issueDate.localeCompare(a.issueDate);
    });

  return ranked[0]?.doc ?? null;
}

export function findMatchingZdDocument(
  order: Pick<
    IndividualOrder,
    | "subiekt_tw_id"
    | "symbol"
    | "products"
    | "mikran_code"
    | "quantity"
    | "delivered_quantity"
    | "zd_fulfillment_dok_id"
  >,
  docsNewestFirst: SubiektDocument[]
): SubiektDocument | null {
  return findBestMatchingZdDocument(order, docsNewestFirst);
}
