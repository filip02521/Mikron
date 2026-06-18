import type { IndividualOrder } from "@/types/database";
import type { SubiektDocument, SubiektDocumentLine } from "@/lib/subiekt/types";
import { lineTowId } from "@/lib/subiekt/zd-catalog-import";
import { buildZdMatchProfileFromDocument } from "@/lib/warehouse/zd-receive-filter";
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
    if (orderSym.startsWith(`${lineSym} `) || lineSym.startsWith(`${orderSym} `)) {
      return true;
    }
  }
  return false;
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

export function findMatchingZdDocument(
  order: Pick<IndividualOrder, "subiekt_tw_id" | "symbol" | "products" | "mikran_code">,
  docsNewestFirst: SubiektDocument[]
): SubiektDocument | null {
  for (const doc of docsNewestFirst) {
    if (orderMatchesZdDocument(order, doc)) return doc;
  }
  return null;
}
