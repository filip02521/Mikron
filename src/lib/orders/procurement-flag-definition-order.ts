import type { ProcurementFlagDefinition } from "@/lib/orders/procurement-request-flag";

export type ReorderActiveFlagDefinitionsResult = {
  definitions: ProcurementFlagDefinition[];
  /** Pełna kolejność id (aktywne w nowym porządku, potem nieaktywne). */
  orderedIds: string[];
};

/**
 * Przesuwa aktywną flagę o jedną pozycję — kolejność = kolejność torów w panelu.
 */
export function reorderActiveFlagDefinitions(
  definitions: ProcurementFlagDefinition[],
  fromActiveIndex: number,
  dir: -1 | 1
): ReorderActiveFlagDefinitionsResult | null {
  const active = [...definitions]
    .filter((d) => d.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pl"));
  const inactive = [...definitions]
    .filter((d) => !d.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pl"));

  const to = fromActiveIndex + dir;
  if (fromActiveIndex < 0 || fromActiveIndex >= active.length) return null;
  if (to < 0 || to >= active.length) return null;

  const nextActive = [...active];
  const [row] = nextActive.splice(fromActiveIndex, 1);
  if (!row) return null;
  nextActive.splice(to, 0, row);

  const ordered = [...nextActive, ...inactive];
  const definitionsNext = ordered.map((d, i) => ({ ...d, sortOrder: i }));
  return {
    definitions: definitionsNext,
    orderedIds: ordered.map((d) => d.id),
  };
}

export function activeFlagDefinitionIndex(
  definitions: ProcurementFlagDefinition[],
  flagId: string
): number {
  const key = flagId.toLowerCase();
  const active = [...definitions]
    .filter((d) => d.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pl"));
  return active.findIndex((d) => d.id.toLowerCase() === key);
}
