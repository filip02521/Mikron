/** Pełny opis — atrybut title / pomoc w modalu. */
export const PROCUREMENT_GLOWNE_ON_DEMAND_HINT =
  "Dostawca na żądanie — Główne oznacza prośbę bez przesunięcia terminu w planie tygodnia.";

export function procurementGlowneButtonLabel({
  hasInfoViaPanel = false,
  supplierOrderOnDemand = false,
  compact = false,
}: {
  hasInfoViaPanel?: boolean;
  supplierOrderOnDemand?: boolean;
  /** Mniejsze przyciski w bloku wieloosobowym u dostawcy. */
  compact?: boolean;
}): string {
  if (!hasInfoViaPanel && !supplierOrderOnDemand) {
    return "Główne";
  }

  const parts: string[] = [];
  if (hasInfoViaPanel) parts.push("info");
  if (supplierOrderOnDemand) parts.push(compact ? "bez term." : "bez terminu");

  if (compact) {
    if (parts.length === 2) return "Gł. (info · bez term.)";
    if (supplierOrderOnDemand) return "Gł. (bez term.)";
    return "Główne (info)";
  }

  return `Główne (${parts.join(" · ")})`;
}

export function procurementGlowneButtonTitle({
  hasInfoViaPanel = false,
  supplierOrderOnDemand = false,
}: {
  hasInfoViaPanel?: boolean;
  supplierOrderOnDemand?: boolean;
}): string | undefined {
  if (!supplierOrderOnDemand) return undefined;
  if (hasInfoViaPanel) {
    return `${PROCUREMENT_GLOWNE_ON_DEMAND_HINT} Informacja trafi do magazynu po Główne/Uzupełniające w panelu.`;
  }
  return PROCUREMENT_GLOWNE_ON_DEMAND_HINT;
}
