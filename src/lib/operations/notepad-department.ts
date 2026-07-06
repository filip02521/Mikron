import type { OperationsDepartment, UserRole, Workspace } from "@/types/database";
import { canAccessOperations, isAdmin, isMagazyn, isZakupy, isZakupyZeby } from "@/lib/auth-roles";

export const OPERATIONS_DEPARTMENT_LABELS: Record<OperationsDepartment, string> = {
  zakupy: "Zakupy",
  magazyn: "Magazyn",
};

export function departmentsForRole(role: UserRole, workspaces?: Workspace[]): OperationsDepartment[] {
  if (isAdmin(role)) return ["zakupy", "magazyn"];
  if (workspaces && workspaces.length > 0) {
    const deps: OperationsDepartment[] = [];
    if (workspaces.includes("dostawy") || workspaces.includes("zeby")) deps.push("zakupy");
    if (workspaces.includes("magazyn")) deps.push("magazyn");
    return deps;
  }
  if (isZakupy(role) || isZakupyZeby(role) || canAccessOperations(role)) return ["zakupy"];
  if (isMagazyn(role)) return ["magazyn"];
  return [];
}

export function defaultDepartmentForRole(role: UserRole, workspaces?: Workspace[]): OperationsDepartment | null {
  const list = departmentsForRole(role, workspaces);
  return list[0] ?? null;
}

export function parseOperationsDepartment(
  raw: string | null | undefined,
  role: UserRole,
  workspaces?: Workspace[]
): OperationsDepartment | null {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "zakupy" || normalized === "magazyn") {
    const allowed = departmentsForRole(role, workspaces);
    return allowed.includes(normalized) ? normalized : null;
  }
  return defaultDepartmentForRole(role, workspaces);
}

export function canAccessOperationsNotepad(role: UserRole | null, workspaces?: Workspace[]): boolean {
  if (!role) return false;
  return departmentsForRole(role, workspaces).length > 0;
}
