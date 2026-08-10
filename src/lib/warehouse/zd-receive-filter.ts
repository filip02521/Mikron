import type { IndividualOrder } from "@/types/database";
import type { SubiektDocument, SubiektDocumentLine } from "@/lib/subiekt/types";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import { findSupplierBySubiektKhId } from "@/lib/subiekt/match-supplier";
import { extractDocKhIds } from "@/lib/subiekt/zd-document-kh";
import { lineTowId } from "@/lib/subiekt/zd-catalog-import";
import { filterOrdersBySupplier } from "@/lib/orders/supplier-filter-summary";
import {
  resolveOrderMatchSymbols,
  type ZdPairMatchIndex,
} from "@/lib/subiekt/match-order-to-zd";
import { twinTwIdsForPairMatch } from "@/lib/orders/zd-product-pair-units";
import { loadZdPairMatchIndex } from "@/lib/orders/zd-product-pair-stock";

export type ZdMatchLinePreview = {
  towId: number | null;
  /** Twin pack/piece (gdy mapa par). */
  twinTwIds?: number[];
  symbol: string | null;
  name: string | null;
};

export type ZdMatchProfile = {
  twIds: number[];
  symbols: string[];
  lineCount: number;
  docNumber: string;
  lines?: ZdMatchLinePreview[];
};

export type ZdReceiveFilterState = {
  dokId: number;
  docNumber: string;
  supplierId: string;
  supplierName: string;
  profile: ZdMatchProfile;
};

function normalizeSymbol(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "-") return null;
  return trimmed.toLowerCase();
}

function lineSymbol(line: SubiektDocumentLine): string | null {
  return normalizeSymbol(line.tw_Symbol ?? null);
}

export function buildZdMatchProfileFromDocument(
  doc: SubiektDocument,
  pairs?: ZdPairMatchIndex | null
): ZdMatchProfile {
  const lines = doc.dok_Pozycja ?? [];
  const twIdSet = new Set<number>();
  const symbolSet = new Set<string>();

  const preview: ZdMatchLinePreview[] = lines.map((line) => {
    const towId = lineTowId(line);
    const twinTwIds =
      towId != null && pairs ? twinTwIdsForPairMatch(towId, pairs) : [];
    if (towId != null) {
      twIdSet.add(towId);
      for (const t of twinTwIds) twIdSet.add(t);
    }
    const symbol = lineSymbol(line);
    if (symbol) symbolSet.add(symbol);
    return {
      towId,
      twinTwIds: twinTwIds.length > 1 ? twinTwIds.filter((id) => id !== towId) : [],
      symbol: line.tw_Symbol?.trim() || null,
      name: line.tw_Nazwa?.trim() || null,
    };
  });

  return {
    twIds: [...twIdSet],
    symbols: [...symbolSet],
    lineCount: lines.length,
    docNumber: doc.dok_NrPelny?.trim() || `ZD #${doc.dok_Id}`,
    lines: preview,
  };
}

function orderTwMatchesLine(
  orderTw: number | null | undefined,
  lineTow: number | null | undefined,
  lineTwinTwIds: readonly number[] | undefined,
  pairs?: ZdPairMatchIndex | null
): boolean {
  if (orderTw == null || !(orderTw > 0) || lineTow == null || !(lineTow > 0)) {
    return false;
  }
  const o = Math.trunc(orderTw);
  const l = Math.trunc(lineTow);
  if (o === l) return true;
  if (lineTwinTwIds?.includes(o)) return true;
  if (pairs) {
    const twins = twinTwIdsForPairMatch(l, pairs);
    if (twins.includes(o)) return true;
  }
  return false;
}

/** Dopasowanie pozycji kolejki do profilu linii ZD (tw_Id, twin pary, symbol). */
export function matchOrderToZdProfile(
  order: IndividualOrder,
  profile: ZdMatchProfile,
  pairs?: ZdPairMatchIndex | null
): boolean {
  const twId = order.subiekt_tw_id;
  if (twId != null && twId > 0 && profile.twIds.includes(Math.trunc(twId))) {
    return true;
  }
  if (twId != null && twId > 0 && pairs) {
    const twins = twinTwIdsForPairMatch(twId, pairs);
    if (twins.some((id) => profile.twIds.includes(id))) return true;
  }

  const orderSymbols = resolveOrderMatchSymbols(order);
  if (orderSymbols.some((symbol) => profile.symbols.includes(symbol))) {
    return true;
  }

  const mikran = normalizeSymbol(order.mikran_code);
  if (mikran && profile.symbols.includes(mikran)) {
    return true;
  }

  return false;
}

export function filterOrdersByZdProfile(
  orders: IndividualOrder[],
  profile: ZdMatchProfile | null | undefined,
  pairs?: ZdPairMatchIndex | null
): IndividualOrder[] {
  if (!profile) return orders;
  return orders.filter((order) => matchOrderToZdProfile(order, profile, pairs));
}

/** Filtr dostawcy, potem ZD (AND). */
export function filterReceiveQueueBySupplierAndZd(
  orders: IndividualOrder[],
  supplierFilter: string,
  zdProfile: ZdMatchProfile | null | undefined,
  pairs?: ZdPairMatchIndex | null
): IndividualOrder[] {
  const bySupplier = filterOrdersBySupplier(orders, supplierFilter);
  return filterOrdersByZdProfile(bySupplier, zdProfile, pairs);
}

export function countZdMatches(
  orders: IndividualOrder[],
  profile: ZdMatchProfile,
  pairs?: ZdPairMatchIndex | null
): number {
  return orders.filter((order) => matchOrderToZdProfile(order, profile, pairs))
    .length;
}

export function countUnmatchedZdLines(
  profile: ZdMatchProfile,
  orders: IndividualOrder[],
  pairs?: ZdPairMatchIndex | null
): number {
  if (!profile.lines?.length) return 0;
  return profile.lines.filter(
    (line) =>
      !orders.some((order) => {
        if (
          orderTwMatchesLine(
            order.subiekt_tw_id,
            line.towId,
            line.twinTwIds,
            pairs
          )
        ) {
          return true;
        }
        const symbol = normalizeSymbol(order.symbol);
        const lineSym = normalizeSymbol(line.symbol);
        return Boolean(symbol && lineSym && symbol === lineSym);
      })
  ).length;
}

export function zdFilterToolbarLabel(
  matchedCount: number,
  supplierScopedCount: number
): string {
  return `${matchedCount} / ${supplierScopedCount} pozycji (filtr ZD)`;
}

export function zdFilterUnmatchedLinesLabel(unmatchedCount: number): string | null {
  if (unmatchedCount <= 0) return null;
  if (unmatchedCount === 1) {
    return "1 linia ZD nie ma jeszcze odpowiednika w kolejce przyjęcia.";
  }
  return `${unmatchedCount} linii ZD nie ma jeszcze odpowiednika w kolejce przyjęcia.`;
}

/** Ustala dostawcę aplikacji na podstawie indeksu ZD lub kontrahenta z dokumentu. */
export function resolveSupplierForZdDocument(
  doc: SubiektDocument,
  suppliers: AppSupplierRef[],
  indexSupplierId?: string | null
): AppSupplierRef | null {
  if (indexSupplierId) {
    const fromIndex = suppliers.find((s) => s.id === indexSupplierId);
    if (fromIndex) return fromIndex;
  }

  for (const khId of extractDocKhIds(doc)) {
    const matched = findSupplierBySubiektKhId(khId, suppliers);
    if (matched) return matched;
  }

  return null;
}

export function buildZdReceiveFilterState(input: {
  dokId: number;
  doc: SubiektDocument;
  supplier: AppSupplierRef;
  pairs?: ZdPairMatchIndex | null;
}): ZdReceiveFilterState {
  const profile = buildZdMatchProfileFromDocument(input.doc, input.pairs);
  return {
    dokId: Math.trunc(input.dokId),
    docNumber: profile.docNumber,
    supplierId: input.supplier.id,
    supplierName: input.supplier.name,
    profile,
  };
}

/** Buduje filtr przyjęcia z mapą par (twin pack↔piece). */
export async function buildZdReceiveFilterStateWithPairs(input: {
  dokId: number;
  doc: SubiektDocument;
  supplier: AppSupplierRef;
}): Promise<ZdReceiveFilterState> {
  const pairs = await loadZdPairMatchIndex();
  return buildZdReceiveFilterState({ ...input, pairs });
}
