import type { UserRole } from "@/types/database";

/**
 * Czy viewer może odczytać podgląd zębów dla ZK danego handlowca
 * (własny notatnik, delegacja urlopowa, manager/admin z dostępem do karty).
 */
export function canReadZkWatchTeethPreview(input: {
  watchSalesPersonId: string;
  ownSalesPersonId: string | null;
  isActiveDelegate: boolean;
  /** Wynik canAccessSalesPerson(viewer, watchSalesPersonId) — admin i manager zespołu. */
  canAccessWatchOwner: boolean;
}): boolean {
  const watchId = input.watchSalesPersonId.trim();
  if (!watchId) return false;
  if (input.ownSalesPersonId?.trim() === watchId) return true;
  if (input.isActiveDelegate) return true;
  if (input.canAccessWatchOwner) return true;
  return false;
}

/** Role, dla których własny profil handlowca jest źródłem dostępu do notatnika. */
export function zkTeethPreviewUsesOwnSalesPerson(role: UserRole): boolean {
  return role === "sales" || role === "sales_manager";
}
