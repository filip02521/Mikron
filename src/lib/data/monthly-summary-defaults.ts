import type { UserRole, Workspace } from "@/types/database";
import {
  canAccessOperations,
  isAdmin,
  isMagazyn,
  isSalesAccount,
  isZakupy,
  isZakupyZeby,
} from "@/lib/auth-roles";
import type { MonthlySummaryTab } from "@/lib/data/monthly-stats-shared";

/**
 * Domyślna zakładka podsumowania — dział, z którym użytkownik pracuje na co dzień.
 * Jawny `?tab=` w URL zawsze wygrywa.
 *
 * - tor zębów (rola / workspace) → Zęby
 * - admin oraz operacje dostaw → Zakupy
 * - magazyn → Dostawy
 * - handlowcy → Handlowcy
 */
export function defaultMonthlySummaryTabForRole(
  role: UserRole,
  workspaces?: Workspace[]
): MonthlySummaryTab {
  if (isZakupyZeby(role) || (workspaces?.includes("zeby") ?? false)) {
    return "zeby";
  }
  if (isSalesAccount(role)) return "handlowcy";
  if (isMagazyn(role, workspaces)) return "dostawy";
  if (isAdmin(role) || canAccessOperations(role, workspaces) || isZakupy(role)) {
    return "zakupy";
  }
  return "handlowcy";
}

export function isMonthlySummaryTab(value: string | null | undefined): value is MonthlySummaryTab {
  return (
    value === "handlowcy" ||
    value === "dostawy" ||
    value === "zakupy" ||
    value === "zeby"
  );
}
