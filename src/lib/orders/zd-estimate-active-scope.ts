/**
 * Etykiety zakresu w UI kreatora — zawsze preferuj aktualny wybór
 * (grupa/cecha), nie stary handoff z `launch` (Dziś / podsumowanie).
 */

export function resolveZdEstimateActiveScopeLabel(input: {
  scopeMode: "grupa" | "cecha";
  selectedGroupName?: string | null;
  selectedCechaName?: string | null;
  /** Tylko gdy tryb launch nadal zgadza się z scopeMode (nie po przełączeniu Grupa↔Cecha). */
  launchMode?: "grupa" | "cecha" | null;
  launchLabel?: string | null;
}): string | null {
  const current =
    input.scopeMode === "cecha"
      ? input.selectedCechaName?.trim() || null
      : input.selectedGroupName?.trim() || null;
  if (current) return current;
  if (input.launchMode && input.launchMode === input.scopeMode) {
    return input.launchLabel?.trim() || null;
  }
  return null;
}

export function resolveZdEstimateActiveSupplierName(input: {
  selectedSupplierName?: string | null;
  launchSupplierName?: string | null;
}): string | null {
  return (
    input.selectedSupplierName?.trim() ||
    input.launchSupplierName?.trim() ||
    null
  );
}
