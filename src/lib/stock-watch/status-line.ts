import { polishPlural } from "@/lib/email/polish-plural";
import { buildZdEstimateLaunchHref } from "@/lib/orders/zd-estimate-supplier-scope";
import type {
  StockWatchDashboard,
  StockWatchSupplierBoardRow,
  StockWatchSupplierProposal,
} from "@/lib/stock-watch/dashboard";
import { stockWatchPrepareZdUsesHorizon } from "@/lib/stock-watch/signal";

/**
 * „Przygotuj ZD” z tablicy — Kreator z horyzontem „do kolejnej dostawy”, gdy domyślny zapas
 * nic nie obejmie: lista pusta, a coś skończy się przed dostawą dzisiejszego ZD (jak w panelu
 * dziennym) albo przed kolejną dostawą, którą horyzont faktycznie wydłuża.
 */
export function stockWatchProposalUsesHorizon(
  p: Pick<StockWatchSupplierProposal, "lineCount" | "beforeDeliveryCount" | "beforeNextDeliveryCount" | "horizonExtends">
): boolean {
  return (
    stockWatchPrepareZdUsesHorizon(p) ||
    (p.lineCount === 0 && p.beforeNextDeliveryCount > 0 && p.horizonExtends)
  );
}

export function stockWatchPrepareZdHref(
  p: Pick<
    StockWatchSupplierProposal,
    "supplierId" | "lineCount" | "beforeDeliveryCount" | "beforeNextDeliveryCount" | "horizonExtends"
  >
): string {
  return buildZdEstimateLaunchHref(
    p.supplierId,
    stockWatchProposalUsesHorizon(p) ? { leadTimeHorizon: true } : undefined
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
  /** Towary do zamówienia dziś: pusto bez dostawy + ≤ 48 h + przed dostawą (bez towaru, który już jedzie). */
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
  // Brak z towarem w drodze nie jest „do zamówienia” — tablica pokazuje go jako „Czeka na dostawę”.
  const urgentToday = counts.emptyNoIncoming + counts.critical + counts.beforeDelivery;
  // Brak albo ≤ 48 h z dostawą w drodze, która zdąży — „Czeka na dostawę”, nie do zamówienia.
  const inTransit = counts.outOfStock - counts.emptyNoIncoming + counts.criticalInTransit;
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
      tone: counts.critical > 0 ? "danger" : "warning",
      headline: `${towary(urgentToday)} do zamówienia dziś`,
    };
  }
  if (inTransit > 0) {
    return {
      ...base,
      tone: "warning",
      headline: `${polishPlural(inTransit, "towar czeka", "towary czekają", "towarów czeka")} na dostawę z otwartych ZD`,
    };
  }
  if (counts.warning > 0) {
    return { ...base, tone: "warning", headline: `Nic się dziś nie kończy · ${towary(counts.warning)} poniżej celu` };
  }
  return { ...base, tone: "ok", headline: "Zapas w normie u wszystkich analizowanych dostawców" };
}
