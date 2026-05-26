import { formatPlDate } from "@/lib/display-labels";
import { parseDateOnly, formatDateString } from "@/lib/orders/dates";
import { isPastExpectedDate } from "@/lib/orders/delivery-eta";
import type { SubiektListParams } from "@/lib/subiekt/api";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import {
  defaultZdSearchDataOd,
  getSubiektDocumentCached,
  searchSubiektZdCached,
} from "@/lib/subiekt/subiekt-runtime-cache";
import { parseSubiektKhId } from "@/lib/subiekt/parse-kh-id";
import { zdSearchPlansForOrderInput } from "@/lib/subiekt/zd-search-for-product";
import type { SubiektDocument, SubiektDocumentLine } from "@/lib/subiekt/types";

export { parseSubiektKhId } from "@/lib/subiekt/parse-kh-id";

export type SubiektZdEta = {
  realizationDate: string;
  documentNumber: string | null;
  matchedBy: "symbol" | "name" | "subiekt";
};

export type OrderZdLookupInput = {
  id: string;
  symbol: string;
  products: string;
  status: string;
  request_kind?: string | null;
  supplier?: { name: string; subiekt_kh_id?: number | null } | null;
  subiekt_kh_id?: number | null;
  subiekt_tw_id?: number | null;
};

/** Statusy, dla których ma sens szukanie terminu w ZD Subiekta. */
export const ZD_LOOKUP_STATUSES = new Set([
  "Nowe",
  "Zamowione",
  "Czesciowo_zrealizowane",
  "Zrealizowane",
]);

const MAX_ZD_BRIEFS_PER_PLAN = 6;
const MAX_ZD_DETAIL_FETCH_TOTAL = 24;
const ZD_FETCH_CONCURRENCY = 3;

type ZdDetailFetchBudget = { remaining: number };

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

/** kh_Id dostawcy z prośby — tylko jawne powiązanie z Subiektem. */
export function orderSubiektKhId(order: OrderZdLookupInput): number | null {
  return parseSubiektKhId(order.subiekt_kh_id ?? order.supplier?.subiekt_kh_id);
}

export function orderSearchQuery(order: OrderZdLookupInput): string | null {
  if (hasMeaningfulSymbol(order.symbol)) return order.symbol.trim();
  if (hasMeaningfulProduct(order.products)) return order.products.trim();
  return null;
}

export function isOrderEligibleForZdLookup(order: OrderZdLookupInput): boolean {
  return (
    order.request_kind !== "informacja" &&
    ZD_LOOKUP_STATUSES.has(order.status) &&
    orderSubiektKhId(order) != null &&
    zdSearchPlansForOrderInput({
      symbol: order.symbol,
      products: order.products,
      subiekt_tw_id: order.subiekt_tw_id,
      subiekt_kh_id: orderSubiektKhId(order),
    }).length > 0
  );
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

/** ZD należy do kontrahenta wybranego przy prośbie (kh_Id z listy dostawców). */
export function zdDocumentMatchesSupplierKh(
  doc: SubiektDocument,
  subiektKhId: number
): boolean {
  const target = subiektKhId;
  const ids: number[] = [];

  const platnikId = doc.dok_PlatnikId;
  const odbiorcaId = doc.dok_OdbiorcaId;
  if (platnikId != null) ids.push(Number(platnikId));
  if (odbiorcaId != null) ids.push(Number(odbiorcaId));

  for (const k of [doc.kh__Kontrahent_Platnik, doc.kh__Kontrahent_Odbiorca]) {
    if (k?.kh_Id != null) ids.push(Number(k.kh_Id));
  }

  return ids.some((id) => Number.isFinite(id) && id === target);
}

/** @deprecated Użyj zdDocumentMatchesSupplierKh — zostawione dla testów kompatybilności. */
export function supplierMatchesZd(
  doc: SubiektDocument,
  supplierName: string | null | undefined,
  subiektKhId?: number | null
): boolean {
  const khId = subiektKhId ?? null;
  if (khId != null) return zdDocumentMatchesSupplierKh(doc, khId);

  const sn = supplierName?.trim();
  if (!sn) return false;
  const target = normalizeText(sn);
  const names: string[] = [];
  for (const k of [doc.kh__Kontrahent_Platnik, doc.kh__Kontrahent_Odbiorca]) {
    if (!k) continue;
    for (const p of [k.adr_NazwaPelna, k.adr_Nazwa, k.kh_Symbol]) {
      if (typeof p === "string" && p.trim()) names.push(p);
    }
  }
  return names.some((name) => {
    const n = normalizeText(name);
    return n === target || n.includes(target) || target.includes(n);
  });
}

export function zdLineMatchesOrder(
  line: SubiektDocumentLine,
  symbol: string,
  product: string,
  subiektTwId?: number | null
): "symbol" | "name" | "subiekt" | null {
  const twId =
    typeof subiektTwId === "number" && Number.isFinite(subiektTwId) && subiektTwId > 0
      ? subiektTwId
      : null;
  const lineTowId = line.ob_TowId;

  if (twId != null && lineTowId != null && Number(lineTowId) === twId) {
    return "subiekt";
  }

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

function pickZdFromDocuments(
  order: OrderZdLookupInput,
  documents: SubiektDocument[],
  subiektKhId: number
): SubiektZdEta | null {
  let best: { eta: SubiektZdEta; sortKey: string } | null = null;

  for (const doc of documents) {
    if (!zdDocumentMatchesSupplierKh(doc, subiektKhId)) continue;
    const realizationDate = extractZdRealizationDate(doc);
    if (!realizationDate) continue;

    const lines = doc.dok_Pozycja ?? [];
    for (const line of lines) {
      const matchedBy = zdLineMatchesOrder(
        line,
        order.symbol,
        order.products,
        order.subiekt_tw_id
      );
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

export function pickZdForOrder(
  order: OrderZdLookupInput,
  documents: SubiektDocument[]
): SubiektZdEta | null {
  const subiektKhId = orderSubiektKhId(order);
  if (subiektKhId == null) return null;
  return pickZdFromDocuments(order, documents, subiektKhId);
}

export function pickBestZdEtaForOrders(
  orderIds: string[],
  zdEtaByOrderId: Record<string, SubiektZdEta>
): SubiektZdEta | null {
  let best: { eta: SubiektZdEta; sortKey: string } | null = null;

  for (const id of orderIds) {
    const eta = zdEtaByOrderId[id];
    if (!eta) continue;
    const sortKey = eta.realizationDate;
    if (!best || sortKey > best.sortKey) {
      best = { eta, sortKey };
    }
  }

  return best?.eta ?? null;
}

function dedupeZdSearchPlans(plans: SubiektListParams[]): SubiektListParams[] {
  const dataOd = defaultZdSearchDataOd();
  const seen = new Set<string>();
  const out: SubiektListParams[] = [];
  for (const plan of plans) {
    const key = `${plan.search ?? ""}|${plan.khId ?? ""}|${plan.dataOd ?? dataOd}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...plan, dataOd: plan.dataOd ?? dataOd });
  }
  return out;
}

async function resolveZdEtasForSupplierGroup(
  khId: number,
  groupOrders: OrderZdLookupInput[],
  docCache: Map<number, SubiektDocument>,
  budget: ZdDetailFetchBudget
): Promise<Record<string, SubiektZdEta>> {
  const pending = new Set(groupOrders.map((o) => o.id));
  const result: Record<string, SubiektZdEta> = {};
  const docs: SubiektDocument[] = [];

  const plans = dedupeZdSearchPlans(
    groupOrders.flatMap((order) =>
      zdSearchPlansForOrderInput({
        symbol: order.symbol,
        products: order.products,
        subiekt_tw_id: order.subiekt_tw_id,
        subiekt_kh_id: khId,
      })
    )
  );

  for (const plan of plans) {
    if (pending.size === 0 || budget.remaining <= 0) break;

    const batch = await loadZdDocumentsForPlans([plan], docCache, khId, budget);
    if (!batch.length) continue;
    docs.push(...batch);

    for (const order of groupOrders) {
      if (!pending.has(order.id)) continue;
      const match = pickZdForOrder(order, docs);
      if (match) {
        result[order.id] = match;
        pending.delete(order.id);
      }
    }
  }

  return result;
}

async function loadZdDocumentsForPlans(
  plans: SubiektListParams[],
  docCache: Map<number, SubiektDocument>,
  subiektKhId: number,
  budget: ZdDetailFetchBudget
): Promise<SubiektDocument[]> {
  const out: SubiektDocument[] = [];
  const seen = new Set<number>();

  for (const plan of plans) {
    if (budget.remaining <= 0) break;

    let list;
    try {
      list = await searchSubiektZdCached(plan);
    } catch {
      continue;
    }

    let briefsThisPlan = 0;
    for (const brief of list.data) {
      if (briefsThisPlan >= MAX_ZD_BRIEFS_PER_PLAN) break;
      if (budget.remaining <= 0) break;
      if (!zdDocumentMatchesSupplierKh(brief, subiektKhId)) continue;
      if (seen.has(brief.dok_Id)) continue;
      seen.add(brief.dok_Id);
      briefsThisPlan++;
      budget.remaining--;

      let doc = docCache.get(brief.dok_Id);
      if (!doc) {
        try {
          doc = await getSubiektDocumentCached(brief.dok_Id);
          docCache.set(brief.dok_Id, doc);
        } catch {
          continue;
        }
      }
      if (!zdDocumentMatchesSupplierKh(doc, subiektKhId)) continue;
      out.push(doc);
    }
  }

  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await mapper(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

/** Dla listy zamówień handlowca — dopasowanie ZD + termin realizacji (pełne dokumenty z pozycjami). */
export async function resolveSubiektZdEtasForOrders(
  orders: OrderZdLookupInput[]
): Promise<Record<string, SubiektZdEta>> {
  if (!(await isSubiektReachable())) return {};

  const eligible = orders.filter(isOrderEligibleForZdLookup);
  const result: Record<string, SubiektZdEta> = {};
  const docCache = new Map<number, SubiektDocument>();
  const fetchBudget: ZdDetailFetchBudget = { remaining: MAX_ZD_DETAIL_FETCH_TOTAL };

  const byKhId = new Map<number, OrderZdLookupInput[]>();
  for (const order of eligible) {
    const khId = orderSubiektKhId(order)!;
    const group = byKhId.get(khId) ?? [];
    group.push(order);
    byKhId.set(khId, group);
  }

  const groups = [...byKhId.entries()];

  await mapWithConcurrency(groups, ZD_FETCH_CONCURRENCY, async ([khId, groupOrders]) => {
    const groupResult = await resolveZdEtasForSupplierGroup(
      khId,
      groupOrders,
      docCache,
      fetchBudget
    );
    Object.assign(result, groupResult);
  });

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
