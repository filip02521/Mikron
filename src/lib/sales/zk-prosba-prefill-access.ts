import type { UserRole } from "@/types/database";

export const ZK_PROSBA_PREFILL_OWN_REQUIRED =
  "Brak uprawnień do prośby tego handlowca.";

export const ZK_PROSBA_PREFILL_SALES_ROLE_REQUIRED =
  "Brak uprawnień handlowca";

/**
 * Decyzja dostępu do prefill ZK / prośby dla wskazanej karty handlowca.
 * Własna karta zawsze OK — `canAccessSalesPerson` dotyczy tylko scope kierownika/admina.
 */
export function resolveZkProsbaPrefillSalesPersonAccess(input: {
  role: UserRole;
  ownSalesPersonId: string | null | undefined;
  requestedSalesPersonId: string;
  /** Wynik canAccessSalesPerson (kierownik/admin); ignorowane dla własnej karty. */
  canAccessRequested: boolean;
}): { ok: true } | { ok: false; message: string } {
  const requested = input.requestedSalesPersonId.trim();
  if (!requested) {
    return { ok: false, message: ZK_PROSBA_PREFILL_OWN_REQUIRED };
  }
  if (input.ownSalesPersonId === requested) {
    return { ok: true };
  }
  if (input.role === "sales") {
    return { ok: false, message: ZK_PROSBA_PREFILL_OWN_REQUIRED };
  }
  if (!input.canAccessRequested) {
    return { ok: false, message: ZK_PROSBA_PREFILL_OWN_REQUIRED };
  }
  return { ok: true };
}
