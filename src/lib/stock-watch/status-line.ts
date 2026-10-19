import { polishPlural } from "@/lib/email/polish-plural";
import { buildZdEstimateLaunchHref } from "@/lib/orders/zd-estimate-supplier-scope";
import type {
  StockWatchDashboard,
  StockWatchSupplierBoardRow,
  StockWatchSupplierProposal,
} from "@/lib/stock-watch/dashboard";
import { stockWatchPrepareZdUsesHorizon } from "@/lib/stock-watch/signal";

/** „Przygotuj ZD” — Kreator z gotową listą; horyzont „do kolejnej dostawy”, gdy sam zapas nic nie obejmie. */
export function stockWatchPrepareZdHref(
  p: Pick<StockWatchSupplierProposal, "supplierId" | "lineCount" | "beforeDeliveryCount">
): string {
  return buildZdEstimateLaunchHref(
    p.supplierId,
    stockWatchPrepareZdUsesHorizon(p) ? { leadTimeHorizon: true } : undefined
  );
}

/** Link „Przygotuj ZD” z wiersza tablicy — bez propozycji zwykły start Kreatora. */
export function stockWatchSupplierRowHref(row: Pick<StockWatchSupplierBoardRow, "supplierId" | "proposal">): string {
  return row.proposal ? stockWatchPrepareZdHref(row.proposal) : buildZdEstimateLaunchHref(row.supplierId);
}

export type StockWatchStatusLine = {
  tone: "danger" | "warning" | "ok";
  /** Zdanie stanu z liczbą — pierwsze, co widać na ekranie. */
  headline: string;
  /** Towary do zamówienia dziś: brak + ≤ 48 h + przed dostawą (bez dublowania). */
  urgentToday: number;
  /** Dostawcy z priorytetem „Teraz” albo „Dziś”. */
  urgentSuppliers: number;
  /** Najpilniejszy dostawca — pierwszy wiersz tablicy, główna akcja panelu. */
  focus: { supplierId: string; supplierName: string; href: string } | null;
};

/** Panel stanu nad tablicą: co zrobić teraz, z liczbą (DESIGN.md → Status Panel). */
export function buildStockWatchStatusLine(dashboard: StockWatchDashboard): StockWatchStatusLine {
  const { counts, suppliers } = dashboard;
  const towary = (n: number) => polishPlural(n, "towar", "towary", "towarów");
  const urgentToday = counts.outOfStock + counts.critical + counts.beforeDelivery;
  const urgent = suppliers.filter((s) => s.priority === "now" || s.priority === "today");
  // Tablica jest posortowana od najpilniejszego (buildStockWatchDashboard).
  const top = urgent[0] ?? null;
  const focus = top
    ? { supplierId: top.supplierId, supplierName: top.supplierName, href: stockWatchSupplierRowHref(top) }
    : null;
  const base = { urgentToday, urgentSuppliers: urgent.length, focus };

  if (counts.emptyNoIncoming > 0) {
    return { ...base, tone: "danger", headline: `${towary(counts.emptyNoIncoming)} bez stanu i bez dostawy w drodze` };
  }
  if (urgentToday > 0) {
    return {
      ...base,
      tone: counts.outOfStock + counts.critical > 0 ? "danger" : "warning",
      headline: `${towary(urgentToday)} do zamówienia dziś`,
    };
  }
  if (counts.warning > 0) {
    return { ...base, tone: "warning", headline: `Nic się dziś nie kończy · ${towary(counts.warning)} poniżej celu` };
  }
  return { ...base, tone: "ok", headline: "Zapas w normie u wszystkich analizowanych dostawców" };
}
