/**
 * Prośby indywidualne (zamówienia) w kreatorze ZD — merge, routing, uwagi.
 */

import { isIndividualOrderProcurementReady } from "@/lib/orders/procurement-readiness";
import { activeOrderQuantity } from "@/lib/orders/sales-cancel";
import { ZD_CREATE_MAX_UWAGI_LEN } from "@/lib/orders/zd-estimate-create-zd";
import type { ZdProductBomRef } from "@/lib/orders/zd-estimate-bom";
import {
  normalizeDemandAllocation,
  normalizePurchaseTarget,
  purchaseTargetBlocksComponents,
} from "@/lib/orders/zd-estimate-bom-policy";
import {
  indexZdProductPairs,
  type ZdProductPairRef,
} from "@/lib/orders/zd-product-pair-units";
import { extractAlphanumericProductCodeFromName } from "@/lib/subiekt/zd-search-for-product";
import type { IndividualOrder } from "@/types/database";
import type { ZdEstimateProsbaOverlapContribution } from "@/lib/orders/zd-estimate-prosba-reservation-overlap";

export type ZdEstimateIndividualRequestRef = {
  orderId: string;
  salesPersonId: string;
  salesPersonName: string;
  qty: number;
  products: string;
  symbol: string | null;
  mikranCode: string | null;
  requestNote: string | null;
  /** kh_Id klienta — do dedupe vs rez. ZK. */
  salesClientKhId?: number | null;
  sourceZkNumber?: string | null;
};

export type ZdEstimateIndividualTwExtra = {
  extraPieces: number;
  requests: ZdEstimateIndividualRequestRef[];
  /** Wkład próśb po retarget/explode — do dedupe vs rezerwacje ZK. */
  overlapContributions?: ZdEstimateProsbaOverlapContribution[];
};

export type ZdEstimateIndividualServiceReason =
  | "no_subiekt"
  | "fetch_failed"
  | "bom_parent"
  | "bom_component_not_purchased"
  | "bom_explode_incomplete"
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
  /** kh_Id odbiorcy z Subiekta — match do dok_OdbiorcaId na ZK. */
  salesClientKhId?: number | null;
  /** Numer ZK przy złożeniu prośby — zapasowy match gdy brak kh_Id. */
  sourceZkNumber?: string | null;
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
  const salesClientKhId =
    order.sales_client_kh_id != null && Number(order.sales_client_kh_id) > 0
      ? Math.trunc(Number(order.sales_client_kh_id))
      : null;
  const sourceZkNumber = order.source_zk_number?.trim() || null;
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
    salesClientKhId,
    sourceZkNumber,
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
    salesClientKhId: order.salesClientKhId ?? null,
    sourceZkNumber: order.sourceZkNumber ?? null,
  };
}

function toOverlapContribution(
  order: ZdEstimatePendingIndividualOrder,
  qty: number
): ZdEstimateProsbaOverlapContribution {
  return {
    orderId: order.id,
    qty,
    salesClientKhId: order.salesClientKhId ?? null,
    sourceZkNumber: order.sourceZkNumber ?? null,
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
 * Ścisłe dopasowanie prośby → tw_Id w kreatorze ZD.
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

type BomTwKind =
  | { kind: "assembled_parent"; bom: ZdProductBomRef }
  | { kind: "purchased_kit"; bom: ZdProductBomRef }
  | { kind: "kit_only_component"; bom: ZdProductBomRef };

function indexBomTwKinds(boms: readonly ZdProductBomRef[]): Map<number, BomTwKind> {
  const map = new Map<number, BomTwKind>();
  const explodeComponentIds = new Set<number>();

  // 1) Parenty + zbierz składniki z explode (wygrywają nad kit_only).
  for (const bom of boms) {
    const parent = Math.trunc(Number(bom.parentTwId)) || 0;
    if (!(parent > 0)) continue;
    const allocation = normalizeDemandAllocation(bom.demandAllocation);
    const target = normalizePurchaseTarget(bom.purchaseTarget);
    if (allocation === "explode" && target === "components") {
      map.set(parent, { kind: "assembled_parent", bom });
      for (const c of bom.components ?? []) {
        const cid = Math.trunc(Number(c.componentTwId)) || 0;
        if (cid > 0) explodeComponentIds.add(cid);
      }
    } else if (bom.components?.length) {
      map.set(parent, { kind: "purchased_kit", bom });
    }
  }

  // 2) kit_only / kit_from_components components — pomiń parentów oraz składniki objęte explode.
  for (const bom of boms) {
    const target = normalizePurchaseTarget(bom.purchaseTarget);
    if (!purchaseTargetBlocksComponents(target)) continue;
    for (const c of bom.components ?? []) {
      const cid = Math.trunc(Number(c.componentTwId)) || 0;
      if (!(cid > 0)) continue;
      if (map.has(cid)) continue;
      if (explodeComponentIds.has(cid)) continue;
      map.set(cid, { kind: "kit_only_component", bom });
    }
  }
  return map;
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
      return `Usługa jednorazowa (zestaw składamy): ${base}`;
    case "bom_component_not_purchased":
      return `Usługa jednorazowa (składnik poza zakupem kompletu): ${base}`;
    case "bom_explode_incomplete":
      return `Usługa jednorazowa (brak składnika zestawu): ${base}`;
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
 * Buduje rezerwę po tw_Id + linie usług.
 * Assembled K → explode na składniki; purchased kit → rezerwa na K;
 * kit_only component → service;
 * kit_from_components component → rezerwa na rodzicu (MAX kit-equiv po składnikach).
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
  const bomKinds = indexBomTwKinds(input.boms ?? []);
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

  /** parentTw → sumy kit-equiv per składnik + zamówienia (MAX po składnikach jak sprzedaż). */
  const kitFromComponentsPending = new Map<
    number,
    {
      byComponent: Map<number, number>;
      requests: ReturnType<typeof toRequestRef>[];
      overlapContributions: ReturnType<typeof toOverlapContribution>[];
    }
  >();

  function addExtra(targetTw: number, order: ZdEstimatePendingIndividualOrder, qty: number) {
    let tw = targetTw;
    const pairHit = pairIndex.get(tw);
    if (pairHit?.role === "piece") {
      tw = pairHit.pair.packTwId;
    }
    if (fetchFailed.has(tw)) {
      pushService(serviceLines, "fetch_failed", order);
      return;
    }
    if (!byTw.has(tw)) {
      if (!fetchSeen.has(tw)) {
        fetchSeen.add(tw);
        twIdsToFetch.push(tw);
      }
    }
    const prev = byTwId.get(tw);
    const contribution = toOverlapContribution(order, qty);
    if (prev) {
      prev.extraPieces += qty;
      prev.requests.push(toRequestRef(order));
      if (!prev.overlapContributions) prev.overlapContributions = [];
      prev.overlapContributions.push(contribution);
    } else {
      byTwId.set(tw, {
        extraPieces: qty,
        requests: [toRequestRef(order)],
        overlapContributions: [contribution],
      });
    }
  }

  function noteKitFromComponentsExtra(
    parentTwId: number,
    componentTwId: number,
    kitEquiv: number,
    order: ZdEstimatePendingIndividualOrder
  ) {
    const kits = Math.max(0, Math.ceil(kitEquiv));
    if (!(kits > 0) || !(parentTwId > 0)) {
      pushService(serviceLines, "bom_component_not_purchased", order);
      return;
    }
    if (fetchFailed.has(parentTwId)) {
      pushService(serviceLines, "fetch_failed", order);
      return;
    }
    if (!byTw.has(parentTwId) && !fetchSeen.has(parentTwId)) {
      fetchSeen.add(parentTwId);
      twIdsToFetch.push(parentTwId);
    }
    const prev = kitFromComponentsPending.get(parentTwId);
    const contribution = toOverlapContribution(order, kits);
    const req = toRequestRef(order);
    if (!prev) {
      kitFromComponentsPending.set(parentTwId, {
        byComponent: new Map([[componentTwId, kits]]),
        requests: [req],
        overlapContributions: [contribution],
      });
      return;
    }
    prev.byComponent.set(
      componentTwId,
      (prev.byComponent.get(componentTwId) ?? 0) + kits
    );
    prev.requests.push(req);
    prev.overlapContributions.push(contribution);
  }

  function routeBlockedComponentExtra(
    bomHit: Extract<BomTwKind, { kind: "kit_only_component" }>,
    componentTwId: number,
    order: ZdEstimatePendingIndividualOrder,
    factor: number
  ) {
    const target = normalizePurchaseTarget(bomHit.bom.purchaseTarget);
    if (target === "kit_from_components") {
      const parentTwId = Math.trunc(Number(bomHit.bom.parentTwId)) || 0;
      const comp = (bomHit.bom.components ?? []).find(
        (c) => Math.trunc(Number(c.componentTwId)) === componentTwId
      );
      const qtyPer = Math.trunc(Number(comp?.qtyPerParent)) || 0;
      if (!(parentTwId > 0) || qtyPer < 1) {
        pushService(serviceLines, "bom_component_not_purchased", order);
        return;
      }
      noteKitFromComponentsExtra(
        parentTwId,
        componentTwId,
        (order.qty * factor) / qtyPer,
        order
      );
      return;
    }
    pushService(serviceLines, "bom_component_not_purchased", order);
  }

  /** Explode prośby przez nested zestawy „Składamy” aż do liścia (z qty). */
  function addExtraExplodingBom(
    targetTw: number,
    order: ZdEstimatePendingIndividualOrder,
    factor: number,
    depth = 0
  ) {
    if (!(factor > 0) || depth > 32) return;
    const bomHit = bomKinds.get(targetTw);
    if (bomHit?.kind === "assembled_parent") {
      const comps = bomHit.bom.components ?? [];
      if (!comps.length) {
        pushService(serviceLines, "bom_explode_incomplete", order);
        return;
      }
      for (const c of comps) {
        const cid = Math.trunc(Number(c.componentTwId)) || 0;
        const q = Math.trunc(Number(c.qtyPerParent)) || 0;
        if (!(cid > 0) || q < 1) {
          pushService(serviceLines, "bom_explode_incomplete", order);
          return;
        }
      }
      for (const c of comps) {
        const cid = Math.trunc(Number(c.componentTwId)) || 0;
        const q = Math.trunc(Number(c.qtyPerParent)) || 0;
        addExtraExplodingBom(cid, order, factor * q, depth + 1);
      }
      return;
    }
    if (bomHit?.kind === "kit_only_component") {
      routeBlockedComponentExtra(bomHit, targetTw, order, factor);
      return;
    }
    addExtra(targetTw, order, order.qty * factor);
  }

  for (const order of input.orders) {
    if (!(order.qty > 0)) {
      skippedNoQty += 1;
      continue;
    }
    const targetTw = matchZdEstimateTwFromOrder(
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

    const bomHit = bomKinds.get(targetTw);
    if (bomHit?.kind === "assembled_parent") {
      addExtraExplodingBom(targetTw, order, 1);
      continue;
    }

    if (bomHit?.kind === "kit_only_component") {
      routeBlockedComponentExtra(bomHit, targetTw, order, 1);
      continue;
    }

    // purchased_kit parent i zwykłe SKU — rezerwa katalogowa (z pair retarget w addExtra).
    addExtra(targetTw, order, order.qty);
  }

  for (const [parentTwId, agg] of kitFromComponentsPending) {
    let kitEquiv = 0;
    for (const n of agg.byComponent.values()) {
      kitEquiv = Math.max(kitEquiv, n);
    }
    if (!(kitEquiv > 0)) continue;
    const prev = byTwId.get(parentTwId);
    if (prev) {
      prev.extraPieces += kitEquiv;
      prev.requests.push(...agg.requests);
      if (!prev.overlapContributions) prev.overlapContributions = [];
      prev.overlapContributions.push(...agg.overlapContributions);
    } else {
      byTwId.set(parentTwId, {
        extraPieces: kitEquiv,
        requests: agg.requests,
        overlapContributions: agg.overlapContributions,
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
      orderCount: input.orders.length,
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
 * Katalog: orderId tylko gdy WSZYSTKIE tw z byTwId dla tej prośby są w createdTwIds
 * (explode A+B — nie markuj przy samym A).
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

  const requiredTwByOrder = new Map<string, Set<number>>();
  for (const [tw, extra] of input.byTwId) {
    if (!(extra.extraPieces > 0)) continue;
    for (const r of extra.requests) {
      const orderId = String(r.orderId ?? "").trim();
      if (!orderId) continue;
      const set = requiredTwByOrder.get(orderId) ?? new Set<number>();
      set.add(tw);
      requiredTwByOrder.set(orderId, set);
    }
  }
  for (const [orderId, tws] of requiredTwByOrder) {
    let allCreated = true;
    for (const tw of tws) {
      if (!created.has(tw)) {
        allCreated = false;
        break;
      }
    }
    if (allCreated) ids.add(orderId);
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

  // Atomowo: jeśli którakolwiek składowa prośby (np. explode A+B) jest poza listą,
  // cała prośba idzie do usług — bez częściowego marku katalogu.
  const ordersWithMissing = new Set<string>();
  for (const [tw, extra] of byTwId) {
    if (present.has(tw)) continue;
    for (const req of extra.requests) {
      const id = String(req.orderId ?? "").trim();
      if (id) ordersWithMissing.add(id);
    }
  }

  if (ordersWithMissing.size) {
    for (const [tw, extra] of [...byTwId.entries()]) {
      const keep: ZdEstimateIndividualRequestRef[] = [];
      let removedPieces = 0;
      for (const req of extra.requests) {
        const id = String(req.orderId ?? "").trim();
        if (id && ordersWithMissing.has(id)) {
          removedPieces += Math.max(0, req.qty);
          serviceLines.push({
            key: `fetch_failed:${req.orderId}`,
            label: `Usługa jednorazowa (brak kartoteki Subiekt): ${
              req.symbol ?? req.products.slice(0, 48)
            }`,
            qty: req.qty,
            reason: "fetch_failed",
            requests: [req],
          });
        } else {
          keep.push(req);
        }
      }
      if (!keep.length) {
        byTwId.delete(tw);
        continue;
      }
      // Tylko gdy coś usunęliśmy z tego tw — nie przepisuj innych tw
      // przy okazji globalnego ordersWithMissing (regresja overlap).
      if (!(removedPieces > 0)) continue;

      const keepOrderIds = new Set(
        keep.map((r) => String(r.orderId ?? "").trim()).filter(Boolean)
      );
      const nextContributions = (extra.overlapContributions ?? []).filter(
        (c) => keepOrderIds.has(String(c.orderId ?? "").trim())
      );
      // Preferuj sumę contribution (poprawne po BOM explode); fallback: req.qty.
      const nextPieces =
        (extra.overlapContributions?.length ?? 0) > 0
          ? nextContributions.reduce(
              (sum, c) => sum + Math.max(0, Number(c.qty) || 0),
              0
            )
          : Math.max(0, extra.extraPieces - removedPieces);
      if (!(nextPieces > 0)) {
        byTwId.delete(tw);
      } else {
        byTwId.set(tw, {
          extraPieces: nextPieces,
          requests: keep,
          overlapContributions: nextContributions,
        });
      }
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

/** Rozszerza present o partnerów pary — extra po piece→pack nie spada do usług. */
export function expandPresentTwIdsWithPairPartners(
  presentTwIds: ReadonlySet<number> | readonly number[],
  pairs: readonly { packTwId: number; pieceTwId: number }[] | null | undefined
): Set<number> {
  const present =
    presentTwIds instanceof Set
      ? new Set(
          [...presentTwIds]
            .map((id) => Math.trunc(Number(id)) || 0)
            .filter((id) => id > 0)
        )
      : new Set(
          [...(presentTwIds ?? [])]
            .map((id) => Math.trunc(Number(id)) || 0)
            .filter((id) => id > 0)
        );
  if (!pairs?.length) return present;
  for (const pair of pairs) {
    const pack = Math.trunc(Number(pair.packTwId)) || 0;
    const piece = Math.trunc(Number(pair.pieceTwId)) || 0;
    if (!(pack > 0 && piece > 0)) continue;
    if (present.has(pack) || present.has(piece)) {
      present.add(pack);
      present.add(piece);
    }
  }
  return present;
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
      return "Zestaw (składamy)";
    case "bom_component_not_purchased":
      return "Składnik poza zakupem kompletu";
    case "bom_explode_incomplete":
      return "Brak składnika zestawu";
    case "fetch_failed":
      return "Brak w Subiekcie";
    case "excluded":
      return "Wykluczona z ZD";
    default:
      return "Brak kartoteki";
  }
}

/** Filtr próśb po id (create / freeze) — bez side-effects. */
export function filterPendingOrdersByIds(
  orders: readonly ZdEstimatePendingIndividualOrder[],
  ids: readonly string[]
): ZdEstimatePendingIndividualOrder[] {
  const want = new Set(ids.map((id) => String(id).trim()).filter(Boolean));
  return orders.filter((o) => want.has(o.id));
}
