import {
  compareStockWatchAlerts,
  computeStockHealthScore,
} from "@/lib/stock-watch/analysis";
import type { StockWatchItem } from "@/lib/stock-watch/data";

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
  | "sales30d"
  | "velocityDaily"
  | "velocityTrend"
  | "daysOfCover"
  | "runOutDate"
  | "bufferDays"
  | "safetyStockQty"
  | "minStockQty"
  | "suggestedQty"
  | "unitPriceNet"
  | "dailyValue"
  | "status"
  | "rule"
  | "ruleNote"
  | "grtNazwa"
>;

export type StockWatchSupplierProposal = {
  supplierId: string;
  supplierName: string;
  skuCount: number;
  outOfStockCount: number;
  criticalCount: number;
  warningCount: number;
  /** Szacunek tylko z pozycji z ceną z ZD. */
  estimatedValue: number;
  unpricedCount: number;
  mostUrgent: { twSymbol: string | null; twNazwa: string; daysOfCover: number | null } | null;
  openDraftId: string | null;
};

export type StockWatchDashboard = {
  health: { score: number; active: number; ok: number };
  counts: { outOfStock: number; critical: number; warning: number; ok: number; noSales: number };
  alerts: StockWatchRowView[];
  proposals: StockWatchSupplierProposal[];
  topVelocity: StockWatchRowView[];
  flagged: StockWatchRowView[];
  totals: { proposalValue: number; proposalSkus: number; itemCount: number; supplierCount: number };
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
    sales30d: item.sales30d,
    velocityDaily: item.velocityDaily,
    velocityTrend: item.velocityTrend,
    daysOfCover: item.daysOfCover,
    runOutDate: item.runOutDate,
    bufferDays: item.bufferDays,
    safetyStockQty: item.safetyStockQty,
    minStockQty: item.minStockQty,
    suggestedQty: item.suggestedQty,
    unitPriceNet: item.unitPriceNet,
    dailyValue: item.dailyValue,
    status: item.status,
    rule: item.rule,
    ruleNote: item.ruleNote,
    grtNazwa: item.grtNazwa,
  };
}

/**
 * Model panelu z wyników analizy. Reguły („Wyklucz” / „Na prośbę”) liczone
 * na żywo z tabel kreatora — zmiana działa od razu, bez nocnego przebiegu.
 */
export function buildStockWatchDashboard(
  items: readonly StockWatchItem[],
  openDraftBySupplier: ReadonlyMap<string, string>
): StockWatchDashboard {
  const counts = { outOfStock: 0, critical: 0, warning: 0, ok: 0, noSales: 0 };
  const standard = items.filter((i) => i.rule === "standard");
  for (const item of standard) {
    if (item.status === "out_of_stock") counts.outOfStock += 1;
    else if (item.status === "critical") counts.critical += 1;
    else if (item.status === "warning") counts.warning += 1;
    else if (item.status === "ok") counts.ok += 1;
    else counts.noSales += 1;
  }

  const alerts = standard
    .filter((i) => i.status === "out_of_stock" || i.status === "critical")
    .sort(compareStockWatchAlerts)
    .slice(0, STOCK_WATCH_ALERT_LIMIT)
    .map(toStockWatchRowView);

  const bySupplier = new Map<string, StockWatchSupplierProposal>();
  for (const item of standard) {
    if (item.suggestedQty <= 0 || !item.supplierId) continue;
    let p = bySupplier.get(item.supplierId);
    if (!p) {
      p = {
        supplierId: item.supplierId,
        supplierName: item.supplierName ?? "Dostawca",
        skuCount: 0,
        outOfStockCount: 0,
        criticalCount: 0,
        warningCount: 0,
        estimatedValue: 0,
        unpricedCount: 0,
        mostUrgent: null,
        openDraftId: openDraftBySupplier.get(item.supplierId) ?? null,
      };
      bySupplier.set(item.supplierId, p);
    }
    p.skuCount += 1;
    if (item.status === "out_of_stock") p.outOfStockCount += 1;
    else if (item.status === "critical") p.criticalCount += 1;
    else if (item.status === "warning") p.warningCount += 1;
    if (item.unitPriceNet != null) p.estimatedValue += item.suggestedQty * item.unitPriceNet;
    else p.unpricedCount += 1;
    const cover = item.daysOfCover;
    const best = p.mostUrgent?.daysOfCover;
    if (
      p.mostUrgent == null ||
      (cover != null && (best == null || cover < best))
    ) {
      p.mostUrgent = { twSymbol: item.twSymbol, twNazwa: item.twNazwa, daysOfCover: cover };
    }
  }
  const proposals = [...bySupplier.values()]
    .map((p) => ({ ...p, estimatedValue: Math.round(p.estimatedValue * 100) / 100 }))
    .sort(
      (a, b) =>
        b.outOfStockCount + b.criticalCount - (a.outOfStockCount + a.criticalCount) ||
        (a.mostUrgent?.daysOfCover ?? Infinity) - (b.mostUrgent?.daysOfCover ?? Infinity) ||
        b.estimatedValue - a.estimatedValue
    );

  const topVelocity = items
    .filter((i) => i.rule !== "excluded" && i.velocityDaily > 0)
    .sort((a, b) => b.velocityDaily - a.velocityDaily)
    .slice(0, STOCK_WATCH_TOP_VELOCITY)
    .map(toStockWatchRowView);

  const flagged = items
    .filter((i) => i.rule !== "standard")
    .sort((a, b) => (a.twSymbol ?? "").localeCompare(b.twSymbol ?? "", "pl"))
    .map(toStockWatchRowView);

  return {
    health: computeStockHealthScore(items),
    counts,
    alerts,
    proposals,
    topVelocity,
    flagged,
    totals: {
      proposalValue:
        Math.round(proposals.reduce((s, p) => s + p.estimatedValue, 0) * 100) / 100,
      proposalSkus: proposals.reduce((s, p) => s + p.skuCount, 0),
      itemCount: items.length,
      supplierCount: new Set(items.map((i) => i.supplierId)).size,
    },
  };
}
