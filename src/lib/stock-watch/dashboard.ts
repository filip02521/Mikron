import {
  compareStockWatchAlerts,
  computeStockHealthScore,
} from "@/lib/stock-watch/analysis";
import type { StockWatchItem, StockWatchSupplierOrder } from "@/lib/stock-watch/data";

/** Wiersz przekazywany do klienta — tylko pola używane w UI. */
export type StockWatchRowView = Pick<
  StockWatchItem,
  | "subiektTwId"
  | "supplierId"
  | "supplierName"
  | "twSymbol"
  | "twNazwa"
  | "availableQty"
  | "stockQty"
  | "reservedQty"
  | "openZdQty"
  | "openZkUnreservedQty"
  | "salesPeriodQty"
  | "salesPeriodDays"
  | "velocityDaily"
  | "daysOfCover"
  | "runOutDate"
  | "targetQty"
  | "minStockQty"
  | "inOrder"
  | "orderZdUnits"
  | "orderUnitLabel"
  | "orderPieces"
  | "unitPriceNet"
  | "dailyValue"
  | "deliveryRisk"
  | "status"
  | "rule"
  | "ruleNote"
  | "grtNazwa"
>;

/** Lista „Do ZD” dostawcy z nocnego przebiegu silnika — ta sama co w Kreatorze ZD. */
export type StockWatchSupplierProposal = {
  supplierId: string;
  supplierName: string;
  /** Pozycje na liście „Do ZD” (jak licznik w Kreatorze). */
  lineCount: number;
  zdUnitsSum: number;
  /** Szacunek tylko z pozycji z ceną z ZD. */
  orderValue: number;
  unpricedCount: number;
  outOfStockCount: number;
  criticalCount: number;
  mostUrgent: { twSymbol: string | null; twNazwa: string; daysOfCover: number | null } | null;
  dniZapasu: number;
  dataOd: string;
  dataDo: string;
  computedAt: string;
  /** Czas dostawy (dni) i kolejne planowe zamówienie — z nocnego przebiegu. */
  leadDays: number | null;
  leadSource: string | null;
  nextOrderDate: string | null;
  nextOrderDays: number | null;
  /** Towary (Standard), które skończą się przed dostawą zamówienia złożonego dziś. */
  beforeDeliveryCount: number;
  /** …przed dostawą z kolejnego planowego zamówienia. */
  beforeNextDeliveryCount: number;
  /** Kreator pokaże pustą listę albo zablokuje „Utwórz ZD” — wymaga uwagi w Kreatorze. */
  warnings: string[];
};

export type StockWatchDashboard = {
  health: { score: number; active: number; ok: number };
  counts: {
    outOfStock: number;
    critical: number;
    warning: number;
    ok: number;
    noSales: number;
    /**
     * Skończy się przed dostawą zamówienia złożonego dziś — poza brakami i ≤ 48 h
     * (sygnał, bez wpływu na ilość).
     */
    beforeDelivery: number;
    beforeNextDelivery: number;
  };
  alerts: StockWatchRowView[];
  proposals: StockWatchSupplierProposal[];
  topVelocity: StockWatchRowView[];
  flagged: StockWatchRowView[];
  totals: { proposalValue: number; proposalLines: number; itemCount: number; supplierCount: number };
};

export const STOCK_WATCH_ALERT_LIMIT = 60;
export const STOCK_WATCH_TOP_VELOCITY = 20;

export function toStockWatchRowView(item: StockWatchItem): StockWatchRowView {
  return {
    subiektTwId: item.subiektTwId,
    supplierId: item.supplierId,
    supplierName: item.supplierName,
    twSymbol: item.twSymbol,
    twNazwa: item.twNazwa,
    availableQty: item.availableQty,
    stockQty: item.stockQty,
    reservedQty: item.reservedQty,
    openZdQty: item.openZdQty,
    openZkUnreservedQty: item.openZkUnreservedQty,
    salesPeriodQty: item.salesPeriodQty,
    salesPeriodDays: item.salesPeriodDays,
    velocityDaily: item.velocityDaily,
    daysOfCover: item.daysOfCover,
    runOutDate: item.runOutDate,
    targetQty: item.targetQty,
    minStockQty: item.minStockQty,
    inOrder: item.inOrder,
    orderZdUnits: item.orderZdUnits,
    orderUnitLabel: item.orderUnitLabel,
    orderPieces: item.orderPieces,
    unitPriceNet: item.unitPriceNet,
    dailyValue: item.dailyValue,
    deliveryRisk: item.deliveryRisk,
    status: item.status,
    rule: item.rule,
    ruleNote: item.ruleNote,
    grtNazwa: item.grtNazwa,
  };
}

/**
 * Jeden wiersz na towar do sygnałów (alerty, zdrowie, rotacja) — ten sam towar
 * bywa w liście dwóch dostawców (wspólny zakres). Wygrywa wiersz z pozycją „Do ZD”.
 */
function uniqueByProduct(items: readonly StockWatchItem[]): StockWatchItem[] {
  const byTw = new Map<number, StockWatchItem>();
  for (const item of items) {
    const prev = byTw.get(item.subiektTwId);
    if (!prev || (!prev.inOrder && item.inOrder)) byTw.set(item.subiektTwId, item);
  }
  return [...byTw.values()];
}

function proposalWarnings(order: StockWatchSupplierOrder): string[] {
  const out: string[] = [];
  if (order.explodeBomIncomplete) out.push("Brakuje danych kompletów (BOM) - Kreator pokaże pustą listę.");
  if (order.historyFetchFailed) out.push("Nie wczytano historii ZD - cięcia historyczne mogły nie wejść.");
  if (order.pendingIndividualsError) out.push("Nie wczytano próśb handlowców.");
  if (order.truncated) out.push("Lista z Subiekta niepełna (limit stron).");
  return out;
}

/**
 * Model panelu. Propozycje = lista „Do ZD” z silnika (jak Kreator). Reguły
 * „Wyklucz” / „Na prośbę” działają od razu; zdjęcie reguły (powrót do Standard)
 * dokłada towar dopiero przy kolejnym przeliczeniu — albo od razu w Kreatorze.
 */
export function buildStockWatchDashboard(
  items: readonly StockWatchItem[],
  supplierOrders: readonly StockWatchSupplierOrder[]
): StockWatchDashboard {
  const products = uniqueByProduct(items);
  const counts = {
    outOfStock: 0,
    critical: 0,
    warning: 0,
    ok: 0,
    noSales: 0,
    beforeDelivery: 0,
    beforeNextDelivery: 0,
  };
  const standard = products.filter((i) => i.rule === "standard");
  for (const item of standard) {
    if (item.status === "out_of_stock") counts.outOfStock += 1;
    else if (item.status === "critical") counts.critical += 1;
    else if (item.status === "warning") counts.warning += 1;
    else if (item.status === "ok") counts.ok += 1;
    else counts.noSales += 1;
    // Bez dublowania z „brak” i „≤ 48 h” — te są już wyżej w liczbach.
    if (
      item.deliveryRisk === "before_delivery" &&
      item.status !== "out_of_stock" &&
      item.status !== "critical"
    ) {
      counts.beforeDelivery += 1;
    }
    else if (item.deliveryRisk === "before_next_delivery") counts.beforeNextDelivery += 1;
  }

  // Czerwona strefa: brak i ≤ 48 h (limit) + osobno „przed dostawą” (własny limit) —
  // inaczej przy setkach braków sygnał czasu dostawy nigdy by się nie zmieścił.
  const isOutOrCritical = (i: StockWatchItem) =>
    i.status === "out_of_stock" || i.status === "critical";
  const alerts = [
    ...standard.filter(isOutOrCritical).sort(compareStockWatchAlerts).slice(0, STOCK_WATCH_ALERT_LIMIT),
    ...standard
      .filter((i) => !isOutOrCritical(i) && i.deliveryRisk === "before_delivery")
      .sort(compareStockWatchAlerts)
      .slice(0, STOCK_WATCH_ALERT_LIMIT),
  ].map(toStockWatchRowView);

  const itemsBySupplier = new Map<string, StockWatchItem[]>();
  for (const item of items) {
    const list = itemsBySupplier.get(item.supplierId) ?? [];
    list.push(item);
    itemsBySupplier.set(item.supplierId, list);
  }

  const proposals: StockWatchSupplierProposal[] = [];
  for (const order of supplierOrders) {
    // Reguły na żywo jak w Kreatorze: wykluczone wypadają, „na prośbę” zostaje
    // tylko z ilością z prośby handlowca.
    const lines = (itemsBySupplier.get(order.supplierId) ?? []).filter(
      (i) =>
        i.inOrder &&
        i.rule !== "excluded" &&
        (i.rule !== "on_request" || i.orderIndividualPieces > 0)
    );
    const warnings = proposalWarnings(order);
    const hasRisk = (itemsBySupplier.get(order.supplierId) ?? []).some(
      (i) => i.rule === "standard" && i.deliveryRisk === "before_delivery"
    );
    if (lines.length === 0 && warnings.length === 0 && !hasRisk) continue;
    let orderValue = 0;
    let unpricedCount = 0;
    let zdUnitsSum = 0;
    let outOfStockCount = 0;
    let criticalCount = 0;
    let mostUrgent: StockWatchSupplierProposal["mostUrgent"] = null;
    for (const line of lines) {
      zdUnitsSum += line.orderZdUnits;
      if (line.orderZdUnits > 0) {
        if (line.orderValue != null) orderValue += line.orderValue;
        else unpricedCount += 1;
      }
      if (line.status === "out_of_stock") outOfStockCount += 1;
      else if (line.status === "critical") criticalCount += 1;
      const cover = line.daysOfCover;
      const best = mostUrgent?.daysOfCover;
      if (mostUrgent == null || (cover != null && (best == null || cover < best))) {
        mostUrgent = { twSymbol: line.twSymbol, twNazwa: line.twNazwa, daysOfCover: cover };
      }
    }
    let beforeDeliveryCount = 0;
    let beforeNextDeliveryCount = 0;
    for (const i of itemsBySupplier.get(order.supplierId) ?? []) {
      if (i.rule !== "standard") continue;
      if (i.deliveryRisk === "before_delivery") beforeDeliveryCount += 1;
      else if (i.deliveryRisk === "before_next_delivery") beforeNextDeliveryCount += 1;
    }
    proposals.push({
      supplierId: order.supplierId,
      supplierName: order.supplierName ?? "Dostawca",
      lineCount: lines.length,
      zdUnitsSum,
      orderValue: Math.round(orderValue * 100) / 100,
      unpricedCount,
      outOfStockCount,
      criticalCount,
      mostUrgent,
      dniZapasu: order.dniZapasu,
      dataOd: order.dataOd,
      dataDo: order.dataDo,
      computedAt: order.computedAt,
      leadDays: order.leadDays,
      leadSource: order.leadSource,
      nextOrderDate: order.nextOrderDate,
      nextOrderDays: order.nextOrderDays,
      beforeDeliveryCount,
      beforeNextDeliveryCount,
      warnings,
    });
  }
  proposals.sort(
    (a, b) =>
      b.outOfStockCount + b.criticalCount - (a.outOfStockCount + a.criticalCount) ||
      b.beforeDeliveryCount - a.beforeDeliveryCount ||
      (a.mostUrgent?.daysOfCover ?? Infinity) - (b.mostUrgent?.daysOfCover ?? Infinity) ||
      b.orderValue - a.orderValue
  );

  const topVelocity = products
    .filter((i) => i.rule !== "excluded" && i.velocityDaily > 0)
    .sort((a, b) => b.velocityDaily - a.velocityDaily)
    .slice(0, STOCK_WATCH_TOP_VELOCITY)
    .map(toStockWatchRowView);

  const flagged = products
    .filter((i) => i.rule !== "standard")
    .sort((a, b) => (a.twSymbol ?? "").localeCompare(b.twSymbol ?? "", "pl"))
    .map(toStockWatchRowView);

  return {
    health: computeStockHealthScore(products),
    counts,
    alerts,
    proposals,
    topVelocity,
    flagged,
    totals: {
      proposalValue:
        Math.round(proposals.reduce((s, p) => s + p.orderValue, 0) * 100) / 100,
      proposalLines: proposals.reduce((s, p) => s + p.lineCount, 0),
      itemCount: products.length,
      supplierCount: new Set(items.map((i) => i.supplierId)).size,
    },
  };
}
