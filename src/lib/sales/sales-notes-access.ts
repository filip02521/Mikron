/**
 * Kto czyta notatki handlowca (sales_notes): autor, kierownik z handlowcem w zakresie
 * (canAccessSalesPerson), admin oraz aktywny zastępca (delegacja urlopowa).
 * Zapis notatek zostaje tylko dla autora (salesPersonIdForAction).
 */
export function canReadSalesNotes(input: {
  isOwner: boolean;
  isAdmin: boolean;
  isManagerInScope: boolean;
  isActiveDelegate: boolean;
}): boolean {
  return input.isOwner || input.isAdmin || input.isManagerInScope || input.isActiveDelegate;
}
