/**
 * Pierwsze Policz (brak listy) → panel postępu;
 * re-Policz (lista już jest) → overlay na liście.
 */
export function shouldUseZdEstimateProgressShell(input: {
  hasLines: boolean;
}): boolean {
  return !input.hasLines;
}
