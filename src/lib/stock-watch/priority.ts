/**
 * Priorytet dostawcy na tablicy braków — co zamówić najpierw.
 *
 * Kolejność progów (pierwszy pasujący wygrywa):
 * 1. now      — pusta półka bez dostawy w drodze albo stan na ≤ 48 h,
 * 2. today    — skończy się przed dostawą zamówienia złożonego dziś,
 * 3. soon     — skończy się przed dostawą z kolejnego planowego zamówienia,
 * 4. restock  — lista „Do ZD” niepusta (poniżej celu zapasu),
 * 5. waiting  — brak na stanie, ale wszystko już jedzie (nie zamawiać drugi raz),
 * 6. attention — nic do zamówienia, ale Kreator zgłasza problem z danymi (np. brak BOM → pusta lista).
 */

export type StockWatchPriority = "now" | "today" | "soon" | "restock" | "waiting" | "attention";

export const STOCK_WATCH_PRIORITY_ORDER: readonly StockWatchPriority[] = [
  "now",
  "today",
  "soon",
  "restock",
  "waiting",
  "attention",
];

export type StockWatchSupplierCounts = {
  /** Brak na stanie i nic na otwartych ZD. */
  emptyNoIncoming: number;
  /** Stan dostępny ≤ 0 (także z towarem w drodze). */
  outOfStock: number;
  /** Starczy na ≤ 48 h. */
  critical: number;
  /** Skończy się przed dostawą dzisiejszego ZD (poza brakiem i ≤ 48 h). */
  beforeDelivery: number;
  beforeNextDelivery: number;
  /** Poniżej celu zapasu. */
  warning: number;
  /** Pozycje na liście „Do ZD”. */
  lineCount: number;
  /** Ostrzeżenia nocnego przebiegu dla Kreatora (BOM, historia ZD, prośby, limit stron). */
  dataWarnings: number;
};

export function stockWatchSupplierPriority(c: StockWatchSupplierCounts): StockWatchPriority | null {
  if (c.emptyNoIncoming > 0 || c.critical > 0) return "now";
  if (c.beforeDelivery > 0) return "today";
  if (c.beforeNextDelivery > 0) return "soon";
  if (c.lineCount > 0) return "restock";
  if (c.outOfStock > 0) return "waiting";
  if (c.dataWarnings > 0) return "attention";
  return null;
}

/** Waga w obrębie progu — najpierw najwięcej dziur, potem ryzyko dostawy, potem wartość. */
export function compareStockWatchSupplierUrgency(
  a: StockWatchSupplierCounts & { priority: StockWatchPriority; orderValue: number },
  b: StockWatchSupplierCounts & { priority: StockWatchPriority; orderValue: number }
): number {
  const rank = (p: StockWatchPriority) => STOCK_WATCH_PRIORITY_ORDER.indexOf(p);
  return (
    rank(a.priority) - rank(b.priority) ||
    b.emptyNoIncoming - a.emptyNoIncoming ||
    b.critical - a.critical ||
    b.beforeDelivery - a.beforeDelivery ||
    b.beforeNextDelivery - a.beforeNextDelivery ||
    b.outOfStock - a.outOfStock ||
    b.orderValue - a.orderValue
  );
}
