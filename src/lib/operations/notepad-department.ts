import type { OperationsDepartment, UserRole } from "@/types/database";
import { canAccessOperations, isAdmin, isMagazyn, isZakupy, isZakupyZeby } from "@/lib/auth-roles";

export const OPERATIONS_DEPARTMENT_LABELS: Record<OperationsDepartment, string> = {
  zakupy: "Zakupy",
  magazyn: "Magazyn",
};

export function departmentsForRole(role: UserRole): OperationsDepartment[] {
  if (isAdmin(role)) return ["zakupy", "magazyn"];
  if (isZakupy(role) || isZakupyZeby(role) || canAccessOperations(role)) return ["zakupy"];
  if (isMagazyn(role)) return ["magazyn"];
  return [];
}

export function defaultDepartmentForRole(role: UserRole): OperationsDepartment | null {
  const list = departmentsForRole(role);
  return list[0] ?? null;
}

export function parseOperationsDepartment(
  raw: string | null | undefined,
  role: UserRole
): OperationsDepartment | null {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "zakupy" || normalized === "magazyn") {
    const allowed = departmentsForRole(role);
    return allowed.includes(normalized) ? normalized : null;
  }
  return defaultDepartmentForRole(role);
}

export function canAccessOperationsNotepad(role: UserRole | null): boolean {
  if (!role) return false;
  return departmentsForRole(role).length > 0;
}
