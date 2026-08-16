/**
 * Formatowanie liczb tylko w UI tabeli szacunku ZD.
 * Nie używać w TSV / hintach — tam zostaje `formatQty`.
 */

export function formatZdEstimateTableQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (Number.isInteger(n)) {
    if (abs >= 1000) {
      return n.toLocaleString("pl-PL", {
        useGrouping: true,
        maximumFractionDigits: 0,
      });
    }
    return String(n);
  }
  return n.toLocaleString("pl-PL", {
    useGrouping: abs >= 1000,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function isZdEstimateTableQtyZero(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n) < 1e-9;
}
