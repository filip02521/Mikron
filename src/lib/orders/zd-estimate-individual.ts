/**
 * Prośby indywidualne (zamówienia) w szacunku ZD — merge, routing, uwagi.
 */

import { isIndividualOrderProcurementReady } from "@/lib/orders/procurement-readiness";
import { activeOrderQuantity } from "@/lib/orders/sales-cancel";
import { ZD_CREATE_MAX_UWAGI_LEN } from "@/lib/orders/zd-estimate-create-zd";
import type { ZdProductBomRef } from "@/lib/orders/zd-estimate-bom";
import {
  indexZdProductPairs,
  type ZdProductPairRef,
} from "@/lib/orders/zd-product-pair-units";
import { extractAlphanumericProductCodeFromName } from "@/lib/subiekt/zd-search-for-product";
import type { IndividualOrder } from "@/types/database";

export type ZdEstimateIndividualRequestRef = {
  orderId: string;
  salesPersonId: string;
  salesPersonName: string;
  qty: number;
  products: string;
  symbol: string | null;
  mikranCode: string | null;
  requestNote: string | null;
};

export type ZdEstimateIndividualTwExtra = {
  extraPieces: number;
  requests: ZdEstimateIndividualRequestRef[];
};

export type ZdEstimateIndividualServiceReason =
  | "no_subiekt"
  | "fetch_failed"
  | "bom_parent"
  | "teeth"
  | "excluded";

export type ZdEstimateIndividualServiceLine = {
  key: string;
  label: string;
  qty: number;
  reason: ZdEstimateIndividualServiceReason;
  requests: ZdEstimateIndividualRequestRef[];
};

export type ZdEstimatePendingIndividualOrder = {
  id: string;
  salesPersonId: string;
  salesPersonName: string;
  products: string;
  symbol: string | null;
  mikranCode: string | null;
  subiektTwId: number | null;
  qty: number;
  requestNote: string | null;
};

export type ZdEstimateIndividualBundle = {
  byTwId: Map<number, ZdEstimateIndividualTwExtra>;
  serviceLines: ZdEstimateIndividualServiceLine[];
  twIdsToFetch: number[];
  meta: {
    orderCount: number;
    extraPiecesSum: number;
    serviceCount: number;
    skippedNoQty: number;
  };
};

export function isZdEstimateIndividualEligible(
  order: IndividualOrder
): boolean {
  if (order.status !== "Nowe") return false;
  if (order.is_teeth) return false;
  if ((order.request_kind ?? "zamowienie") !== "zamowienie") return false;
  if (!order.supplier_id) return false;
  if (!isIndividualOrderProcurementReady(order)) return false;
  const qty = activeOrderQuantity(order);
  return qty != null && qty > 0;
}

export function mapIndividualOrderToPendingDto(
  order: IndividualOrder
): ZdEstimatePendingIndividualOrder | null {
  if (!isZdEstimateIndividualEligible(order)) return null;
  const qty = activeOrderQuantity(order);
  if (qty == null || !(qty > 0)) return null;
  const sp = order.sales_person;
  return {
    id: order.id,
    salesPersonId: order.sales_person_id,
    salesPersonName: (sp?.name ?? "").trim() || "Handlowiec",
    products: (order.products ?? "").trim() || "—",
    symbol: order.symbol?.trim() && order.symbol.trim() !== "-"
      ? order.symbol.trim()
      : null,
    mikranCode: order.mikran_code?.trim() || null,
    subiektTwId:
      order.subiekt_tw_id != null && Number(order.subiekt_tw_id) > 0
        ? Math.trunc(Number(order.subiekt_tw_id))
        : null,
    qty,
    requestNote: order.sales_request_note?.trim() || null,
  };
}

function toRequestRef(
  order: ZdEstimatePendingIndividualOrder
): ZdEstimateIndividualRequestRef {
  return {
    orderId: order.id,
    salesPersonId: order.salesPersonId,
    salesPersonName: order.salesPersonName,
    qty: order.qty,
    products: order.products,
    symbol: order.symbol,
    mikranCode: order.mikranCode,
    requestNote: order.requestNote,
  };
}

function normalizeKey(value: string | null | undefined): string | null {
  const t = value?.trim();
  if (!t || t === "-") return null;
  return t.toLowerCase();
}

function buildLineLookup(lines: readonly { tw_Id: number; tw_Symbol: string; tw_Nazwa?: string }[]) {
  const byTw = new Map<number, { tw_Id: number; tw_Symbol: string }>();
  const bySymbol = new Map<string, number>();
  for (const line of lines) {
    const id = Math.trunc(Number(line.tw_Id)) || 0;
    if (!(id > 0)) continue;
    byTw.set(id, { tw_Id: id, tw_Symbol: line.tw_Symbol });
    const sym = normalizeKey(line.tw_Symbol);
    if (sym && !bySymbol.has(sym)) bySymbol.set(sym, id);
  }
  return { byTw, bySymbol };
}

function mikranCodeForTw(
  twId: number,
  byMikran: Map<string, number>
): string | null {
  for (const [code, tw] of byMikran) {
    if (tw === twId) return code;
  }
  return null;
}

/**
 * Ścisłe dopasowanie prośby → tw_Id w szacunku ZD.
 *
 * NIE używa fuzzy firstToken / marki z nazwy (to doklejało prośby do złych SKU).
 * Kolejność: jawny symbol → PLU/mikran → kod alfanum. z nazwy → subiektTwId
 * (z weryfikacją sprzeczności względem symbolu/PLU).
 */
export function matchZdEstimateTwFromOrder(
  order: ZdEstimatePendingIndividualOrder,
  bySymbol: Map<string, number>,
  byMikran?: Map<string, number>,
  byTw?: Map<number, { tw_Id: number; tw_Symbol: string }>
): number | null {
  const explicitSym = normalizeKey(order.symbol);
  const mikran = normalizeKey(order.mikranCode);
  const storedTw =
    order.subiektTwId != null && order.subiektTwId > 0
      ? Math.trunc(order.subiektTwId)
      : null;

  const symbolHit =
    explicitSym != null ? bySymbol.get(explicitSym) ?? null : null;
  const mikranHit =
    mikran && byMikran ? byMikran.get(mikran) ?? null : null;

  if (
    symbolHit != null &&
    symbolHit > 0 &&
    mikranHit != null &&
    mikranHit > 0 &&
    symbolHit !== mikranHit
  ) {
    // Sprzeczne twarde sygnały — lepiej usługa niż zły towar na ZD.
    return null;
  }

  if (symbolHit != null && symbolHit > 0) return symbolHit;
  if (mikranHit != null && mikranHit > 0) return mikranHit;

  // Kod z nazwy tylko gdy wygląda jak SKU (litery+cyfry) i trafia dokładnie 1 symbol.
  if (!explicitSym) {
    const fromName = extractAlphanumericProductCodeFromName(
      order.products ?? ""
    );
    const codeKey = normalizeKey(fromName);
    if (codeKey) {
      const hit = bySymbol.get(codeKey);
      if (hit != null && hit > 0) return hit;
    }
  }

  if (storedTw == null) return null;

  if (byTw?.has(storedTw)) {
    const lineSym = normalizeKey(byTw.get(storedTw)!.tw_Symbol);
    if (explicitSym && lineSym && explicitSym !== lineSym) {
      return null;
    }
    if (mikran && byMikran) {
      const lineMikran = mikranCodeForTw(storedTw, byMikran);
      if (lineMikran && lineMikran !== mikran) return null;
    }
  }

  return storedTw;
}

function bomParentTwIds(boms: readonly ZdProductBomRef[]): Set<number> {
  const set = new Set<number>();
  for (const bom of boms) {
    const p = Math.trunc(Number(bom.parentTwId)) || 0;
    if (p > 0) set.add(p);
  }
  return set;
}

function serviceLabel(
  reason: ZdEstimateIndividualServiceReason,
  order: ZdEstimatePendingIndividualOrder
): string {
  const base =
    order.symbol ??
    order.mikranCode ??
    order.products.slice(0, 48) ??
    "pozycja";
  switch (reason) {
    case "teeth":
      return `Usługa jednorazowa (zęby): ${base}`;
    case "bom_parent":
      return `Usługa jednorazowa (zestaw): ${base}`;
    case "fetch_failed":
      return `Usługa jednorazowa (brak kartoteki Subiekt): ${base}`;
    case "excluded":
      return `Usługa jednorazowa (wykluczona z ZD): ${base}`;
    default:
      return `Usługa jednorazowa: ${base}`;
  }
}

function pushService(
  list: ZdEstimateIndividualServiceLine[],
  reason: ZdEstimateIndividualServiceReason,
  order: ZdEstimatePendingIndividualOrder
) {
  list.push({
    key: `${reason}:${order.id}`,
    label: serviceLabel(reason, order),
    qty: order.qty,
    reason,
    requests: [toRequestRef(order)],
  });
}

export type BuildIndividualEstimateExtrasInput = {
  orders: readonly ZdEstimatePendingIndividualOrder[];
  lines: readonly { tw_Id: number; tw_Symbol: string; tw_Nazwa?: string }[];
  pairs?: readonly ZdProductPairRef[] | null;
  boms?: readonly ZdProductBomRef[] | null;
  teethTwIds?: ReadonlySet<number> | readonly number[] | null;
  /** Tw_Id, które miały być dociągnięte, ale nie weszły do linii. */
  fetchFailedTwIds?: ReadonlySet<number> | readonly number[] | null;
  /** Opcjonalnie: mikran/PLU → tw (gdy linie mają PLU w przyszłości). */
  mikranByTw?: ReadonlyMap<number, string> | null;
};

/**
 * Buduje rezerwę po tw_Id + linie usług. Piece → pack; parent/zęby → service.
 */
export function buildIndividualEstimateExtras(
  input: BuildIndividualEstimateExtrasInput
): ZdEstimateIndividualBundle {
  const byTwId = new Map<number, ZdEstimateIndividualTwExtra>();
  const serviceLines: ZdEstimateIndividualServiceLine[] = [];
  const twIdsToFetch: number[] = [];
  const fetchSeen = new Set<number>();
  let skippedNoQty = 0;

  const { byTw, bySymbol } = buildLineLookup(input.lines);
  const byMikran = new Map<string, number>();
  if (input.mikranByTw) {
    for (const [tw, code] of input.mikranByTw) {
      const k = normalizeKey(code);
      if (k && !byMikran.has(k)) byMikran.set(k, tw);
    }
  }

  const pairIndex = indexZdProductPairs(input.pairs ?? []);
  const parents = bomParentTwIds(input.boms ?? []);
  const teeth =
    input.teethTwIds instanceof Set
      ? input.teethTwIds
      : new Set(
          [...(input.teethTwIds ?? [])]
            .map((id) => Math.trunc(Number(id)) || 0)
            .filter((id) => id > 0)
        );
  const fetchFailed =
    input.fetchFailedTwIds instanceof Set
      ? input.fetchFailedTwIds
      : new Set(
          [...(input.fetchFailedTwIds ?? [])]
            .map((id) => Math.trunc(Number(id)) || 0)
            .filter((id) => id > 0)
        );

  for (const order of input.orders) {
    if (!(order.qty > 0)) {
      skippedNoQty += 1;
      continue;
    }
    const ref = toRequestRef(order);
    let targetTw = matchZdEstimateTwFromOrder(
      order,
      bySymbol,
      byMikran,
      byTw
    );

    if (targetTw == null) {
      pushService(serviceLines, "no_subiekt", order);
      continue;
    }

    if (teeth.has(targetTw)) {
      pushService(serviceLines, "teeth", order);
      continue;
    }

    if (parents.has(targetTw)) {
      pushService(serviceLines, "bom_parent", order);
      continue;
    }

    const pairHit = pairIndex.get(targetTw);
    if (pairHit?.role === "piece") {
      targetTw = pairHit.pair.packTwId;
    }

    if (fetchFailed.has(targetTw)) {
      pushService(serviceLines, "fetch_failed", order);
      continue;
    }

    if (!byTw.has(targetTw)) {
      if (!fetchSeen.has(targetTw)) {
        fetchSeen.add(targetTw);
        twIdsToFetch.push(targetTw);
      }
      // Still accumulate extras — after fetch the line will appear.
    }

    const prev = byTwId.get(targetTw);
    if (prev) {
      prev.extraPieces += order.qty;
      prev.requests.push(ref);
    } else {
      byTwId.set(targetTw, {
        extraPieces: order.qty,
        requests: [ref],
      });
    }
  }

  let extraPiecesSum = 0;
  for (const v of byTwId.values()) extraPiecesSum += v.extraPieces;

  return {
    byTwId,
    serviceLines,
    twIdsToFetch,
    meta: {
      orderCount: input.orders.length - skippedNoQty,
      extraPiecesSum,
      serviceCount: serviceLines.length,
      skippedNoQty,
    },
  };
}

/** Mapa tw → extraPieces do resolve / filter / preview. */
export function individualExtraPiecesMap(
  bundle: Pick<ZdEstimateIndividualBundle, "byTwId"> | null | undefined
): Map<number, number> {
  const map = new Map<number, number>();
  if (!bundle) return map;
  for (const [tw, extra] of bundle.byTwId) {
    if (extra.extraPieces > 0) map.set(tw, extra.extraPieces);
  }
  return map;
}

/**
 * OrderIds, które realnie weszły na ZD (katalog) i/lub do uwag (usługi).
 * `serviceOrderIds` — tylko te, które faktycznie zmieściły się w uwagach.
 */
export function collectIndividualOrderIdsForZdCreate(input: {
  byTwId: ReadonlyMap<number, ZdEstimateIndividualTwExtra>;
  serviceLines?: readonly ZdEstimateIndividualServiceLine[];
  createdTwIds: ReadonlySet<number> | readonly number[];
  includeServiceUwagi?: boolean;
  /** Preferowane: orderIds usług włączonych do uwag (po truncate). */
  serviceOrderIds?: readonly string[] | null;
}): string[] {
  const ids = new Set<string>();
  const created =
    input.createdTwIds instanceof Set
      ? input.createdTwIds
      : new Set(
          [...input.createdTwIds]
            .map((id) => Math.trunc(Number(id)) || 0)
            .filter((id) => id > 0)
        );

  for (const [tw, extra] of input.byTwId) {
    if (!created.has(tw)) continue;
    for (const r of extra.requests) ids.add(r.orderId);
  }

  if (input.serviceOrderIds?.length) {
    for (const id of input.serviceOrderIds) {
      const t = String(id ?? "").trim();
      if (t) ids.add(t);
    }
  } else if (input.includeServiceUwagi) {
    for (const line of input.serviceLines ?? []) {
      for (const r of line.requests) ids.add(r.orderId);
    }
  }

  return [...ids];
}

export function countExcludedWithIndividualRequests(
  byTwId: ReadonlyMap<number, ZdEstimateIndividualTwExtra>,
  excludedTwIds: ReadonlySet<number> | readonly number[] | null | undefined
): number {
  const excluded =
    excludedTwIds instanceof Set
      ? excludedTwIds
      : new Set(excludedTwIds ?? []);
  let n = 0;
  for (const [tw, extra] of byTwId) {
    if (!excluded.has(tw)) continue;
    n += extra.requests.length;
  }
  return n;
}

/**
 * Prośby na wykluczonych tw → usługi w uwagach (żeby nie ginęły bez Główne).
 */
export function reclassifyExcludedTwExtrasToServices(
  bundle: ZdEstimateIndividualBundle,
  excludedTwIds: ReadonlySet<number> | readonly number[] | null | undefined
): ZdEstimateIndividualBundle {
  const excluded =
    excludedTwIds instanceof Set
      ? excludedTwIds
      : new Set(
          [...(excludedTwIds ?? [])]
            .map((id) => Math.trunc(Number(id)) || 0)
            .filter((id) => id > 0)
        );
  if (!excluded.size) return bundle;

  const byTwId = new Map(bundle.byTwId);
  const serviceLines = [...bundle.serviceLines];

  for (const [tw, extra] of [...byTwId.entries()]) {
    if (!excluded.has(tw)) continue;
    byTwId.delete(tw);
    for (const req of extra.requests) {
      serviceLines.push({
        key: `excluded:${req.orderId}`,
        label: `Usługa jednorazowa (wykluczona z ZD): ${
          req.symbol ?? req.products.slice(0, 48)
        }`,
        qty: req.qty,
        reason: "excluded",
        requests: [req],
      });
    }
  }

  let extraPiecesSum = 0;
  for (const v of byTwId.values()) extraPiecesSum += v.extraPieces;

  return {
    byTwId,
    serviceLines,
    twIdsToFetch: bundle.twIdsToFetch.filter((tw) => !excluded.has(tw)),
    meta: {
      orderCount: bundle.meta.orderCount,
      extraPiecesSum,
      serviceCount: serviceLines.length,
      skippedNoQty: bundle.meta.skippedNoQty,
    },
  };
}

export function formatIndividualSalesPeopleShort(
  requests: readonly ZdEstimateIndividualRequestRef[]
): string {
  const names = [
    ...new Set(requests.map((r) => r.salesPersonName.trim()).filter(Boolean)),
  ];
  if (names.length === 0) return "Handlowiec";
  if (names.length <= 2) return names.join(", ");
  return `${names.length} handl.`;
}

export function buildIndividualServiceUwagiBlock(
  serviceLines: readonly ZdEstimateIndividualServiceLine[],
  maxLen: number
): {
  text: string;
  omittedCount: number;
  includedOrderIds: string[];
  omittedOrderIds: string[];
} {
  if (!serviceLines.length || maxLen <= 0) {
    return {
      text: "",
      omittedCount: 0,
      includedOrderIds: [],
      omittedOrderIds: serviceLines.flatMap((l) =>
        l.requests.map((r) => r.orderId)
      ),
    };
  }
  const parts: string[] = [];
  const partOrderIds: string[][] = [];
  for (const line of serviceLines) {
    const who = formatIndividualSalesPeopleShort(line.requests);
    const chunk = `${who} ${line.qty}× ${line.label.replace(/^Usługa jednorazowa(\s*\([^)]*\))?:\s*/i, "")}`;
    parts.push(chunk);
    partOrderIds.push(line.requests.map((r) => r.orderId));
  }
  const prefix = "Usługi: ";
  const text = prefix + parts.join("; ");
  if (text.length <= maxLen) {
    return {
      text,
      omittedCount: 0,
      includedOrderIds: partOrderIds.flat(),
      omittedOrderIds: [],
    };
  }
  const kept: string[] = [];
  const keptIds: string[] = [];
  let omitted = parts.length;
  for (let i = 0; i < parts.length; i++) {
    const trial = prefix + [...kept, parts[i]!].join("; ");
    const suffixBudget = 12;
    if (trial.length + suffixBudget > maxLen && kept.length > 0) {
      omitted = parts.length - kept.length;
      break;
    }
    kept.push(parts[i]!);
    keptIds.push(...(partOrderIds[i] ?? []));
    omitted = parts.length - kept.length;
  }
  if (kept.length === 0) {
    const bare = (prefix + parts[0]!).slice(0, Math.max(0, maxLen - 8));
    return {
      text: bare + (parts.length > 1 ? " (+…)" : ""),
      omittedCount: Math.max(0, parts.length - 1),
      includedOrderIds: partOrderIds[0] ?? [],
      omittedOrderIds: partOrderIds.slice(1).flat(),
    };
  }
  const body = prefix + kept.join("; ");
  const suffix = omitted > 0 ? ` (+${omitted})` : "";
  return {
    text: (body + suffix).slice(0, maxLen),
    omittedCount: omitted,
    includedOrderIds: keptIds,
    omittedOrderIds: partOrderIds.slice(kept.length).flat(),
  };
}

/**
 * Usuwa blok „Usługi: …” z uwag (np. gdy UI kiedyś wkleiło go do textarea).
 * Serwer zawsze dokłada usługi sam — baza bez bloku usług.
 */
export function stripZdCreateUwagiServiceBlock(uwagi: string): string {
  const raw = (uwagi ?? "").trim();
  if (!raw) return "";
  const sepIdx = raw.search(/\s*[·•|]\s*Usługi:\s*/i);
  if (sepIdx >= 0) return raw.slice(0, sepIdx).trim();
  if (/^Usługi:\s*/i.test(raw)) return "";
  return raw;
}

export function composeZdCreateUwagiWithServices(input: {
  baseUwagi: string;
  serviceLines: readonly ZdEstimateIndividualServiceLine[];
  maxLen?: number;
  /**
   * Najpierw rezerwuje miejsce na usługi, potem skraca bazę.
   * Bez tego długa baza może wyzerować budżet usług.
   */
  prioritizeServices?: boolean;
}): {
  uwagi: string;
  omittedServiceCount: number;
  includedServiceOrderIds: string[];
  baseTruncated: boolean;
} {
  const max = input.maxLen ?? ZD_CREATE_MAX_UWAGI_LEN;
  const baseRaw = stripZdCreateUwagiServiceBlock(input.baseUwagi);
  if (!input.serviceLines.length) {
    return {
      uwagi: baseRaw.slice(0, max),
      omittedServiceCount: 0,
      includedServiceOrderIds: [],
      baseTruncated: baseRaw.length > max,
    };
  }

  if (input.prioritizeServices) {
    // 1) Ile zajmują usługi same (maksymalnie w max).
    const servicesOnly = buildIndividualServiceUwagiBlock(
      input.serviceLines,
      max
    );
    if (!servicesOnly.text) {
      return {
        uwagi: baseRaw.slice(0, max),
        omittedServiceCount: input.serviceLines.length,
        includedServiceOrderIds: [],
        baseTruncated: baseRaw.length > max,
      };
    }
    const sep = baseRaw ? " · " : "";
    const baseBudget = Math.max(
      0,
      max - servicesOnly.text.length - sep.length
    );
    const base = baseRaw.slice(0, baseBudget);
    const merged = (base + (base ? sep : "") + servicesOnly.text).slice(0, max);
    return {
      uwagi: merged,
      omittedServiceCount: servicesOnly.omittedCount,
      includedServiceOrderIds: servicesOnly.includedOrderIds,
      baseTruncated: base.length < baseRaw.length,
    };
  }

  const sep = baseRaw ? " · " : "";
  const base = baseRaw.slice(0, max);
  const budget = Math.max(0, max - base.length - sep.length);
  const block = buildIndividualServiceUwagiBlock(input.serviceLines, budget);
  if (!block.text) {
    return {
      uwagi: base.slice(0, max),
      omittedServiceCount: input.serviceLines.length,
      includedServiceOrderIds: [],
      baseTruncated: baseRaw.length > max,
    };
  }
  const merged = (base + sep + block.text).slice(0, max);
  return {
    uwagi: merged,
    omittedServiceCount: block.omittedCount,
    includedServiceOrderIds: block.includedOrderIds,
    baseTruncated: baseRaw.length > max,
  };
}

/** Max długość bazy uwag, gdy usługi mają pierwszeństwo (podgląd UI). */
export function zdCreateUwagiBaseBudgetForServices(input: {
  serviceLines: readonly ZdEstimateIndividualServiceLine[];
  maxLen?: number;
}): number {
  const max = input.maxLen ?? ZD_CREATE_MAX_UWAGI_LEN;
  if (!input.serviceLines.length) return max;
  const servicesOnly = buildIndividualServiceUwagiBlock(
    input.serviceLines,
    max
  );
  if (!servicesOnly.text) return max;
  const sep = 3; // " · "
  return Math.max(0, max - servicesOnly.text.length - sep);
}

export function reclassifyMissingTwExtrasToServices(
  bundle: ZdEstimateIndividualBundle,
  presentTwIds: ReadonlySet<number> | readonly number[]
): ZdEstimateIndividualBundle {
  const present =
    presentTwIds instanceof Set
      ? presentTwIds
      : new Set(
          [...presentTwIds]
            .map((id) => Math.trunc(Number(id)) || 0)
            .filter((id) => id > 0)
        );
  const byTwId = new Map(bundle.byTwId);
  const serviceLines = [...bundle.serviceLines];

  for (const [tw, extra] of [...byTwId.entries()]) {
    if (present.has(tw)) continue;
    byTwId.delete(tw);
    for (const req of extra.requests) {
      serviceLines.push({
        key: `fetch_failed:${req.orderId}`,
        label: `Usługa jednorazowa (brak kartoteki Subiekt): ${
          req.symbol ?? req.products.slice(0, 48)
        }`,
        qty: req.qty,
        reason: "fetch_failed",
        requests: [req],
      });
    }
  }

  let extraPiecesSum = 0;
  for (const v of byTwId.values()) extraPiecesSum += v.extraPieces;

  return {
    byTwId,
    serviceLines,
    twIdsToFetch: [],
    meta: {
      orderCount: bundle.meta.orderCount,
      extraPiecesSum,
      serviceCount: serviceLines.length,
      skippedNoQty: bundle.meta.skippedNoQty,
    },
  };
}

/** Buduje mapę mikran/PLU → tw_Id z linii szacunku. */
export function buildMikranByTwFromEstimateLines(
  lines: readonly { tw_Id: number; tw_PLU?: string | null }[]
): Map<number, string> {
  const map = new Map<number, string>();
  for (const line of lines) {
    const plu = String(line.tw_PLU ?? "").trim();
    if (!plu || plu === "-") continue;
    const tw = Math.trunc(Number(line.tw_Id)) || 0;
    if (tw > 0) map.set(tw, plu);
  }
  return map;
}

export function individualServiceReasonLabel(
  reason: ZdEstimateIndividualServiceReason
): string {
  switch (reason) {
    case "teeth":
      return "Produkt zębowy";
    case "bom_parent":
      return "Zestaw (parent)";
    case "fetch_failed":
      return "Brak w Subiekcie";
    case "excluded":
      return "Wykluczona z ZD";
    default:
      return "Brak kartoteki";
  }
}

/** Preflight: czy da się oznaczyć te orderIds jako Główne (interwał + status). */
export function filterPendingOrdersByIds(
  orders: readonly ZdEstimatePendingIndividualOrder[],
  ids: readonly string[]
): ZdEstimatePendingIndividualOrder[] {
  const want = new Set(ids.map((id) => String(id).trim()).filter(Boolean));
  return orders.filter((o) => want.has(o.id));
}
